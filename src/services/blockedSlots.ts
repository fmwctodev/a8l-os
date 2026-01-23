import { supabase } from '../lib/supabase';
import type { BlockedSlot, BlockedSlotFilters, User } from '../types';
import { logAudit } from './audit';

export interface CreateBlockedSlotData {
  calendar_id: string;
  user_id?: string | null;
  title: string;
  start_at_utc: string;
  end_at_utc: string;
  all_day?: boolean;
  recurring?: boolean;
  recurrence_rule?: string | null;
}

export interface UpdateBlockedSlotData {
  title?: string;
  start_at_utc?: string;
  end_at_utc?: string;
  all_day?: boolean;
  recurring?: boolean;
  recurrence_rule?: string | null;
}

export async function getBlockedSlots(
  organizationId: string,
  filters: BlockedSlotFilters = {}
): Promise<BlockedSlot[]> {
  let query = supabase
    .from('blocked_slots')
    .select(`
      *,
      calendar:calendars(id, name, slug, type),
      user:users!blocked_slots_user_id_fkey(id, name, email, avatar_url),
      created_by_user:users!blocked_slots_created_by_fkey(id, name, email)
    `)
    .eq('org_id', organizationId)
    .order('start_at_utc', { ascending: true });

  if (filters.calendarId) {
    query = query.eq('calendar_id', filters.calendarId);
  }

  if (filters.calendarIds && filters.calendarIds.length > 0) {
    query = query.in('calendar_id', filters.calendarIds);
  }

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters.userIds && filters.userIds.length > 0) {
    query = query.in('user_id', filters.userIds);
  }

  if (filters.startDate) {
    query = query.gte('start_at_utc', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('start_at_utc', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

export async function getBlockedSlotById(id: string): Promise<BlockedSlot | null> {
  const { data, error } = await supabase
    .from('blocked_slots')
    .select(`
      *,
      calendar:calendars(id, name, slug, type),
      user:users!blocked_slots_user_id_fkey(id, name, email, avatar_url),
      created_by_user:users!blocked_slots_created_by_fkey(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createBlockedSlot(
  data: CreateBlockedSlotData,
  currentUser: User
): Promise<BlockedSlot> {
  const { data: calendar } = await supabase
    .from('calendars')
    .select('org_id')
    .eq('id', data.calendar_id)
    .single();

  if (!calendar) throw new Error('Calendar not found');

  const { data: blockedSlot, error } = await supabase
    .from('blocked_slots')
    .insert({
      org_id: calendar.org_id,
      calendar_id: data.calendar_id,
      user_id: data.user_id || null,
      title: data.title,
      start_at_utc: data.start_at_utc,
      end_at_utc: data.end_at_utc,
      all_day: data.all_day || false,
      recurring: data.recurring || false,
      recurrence_rule: data.recurrence_rule || null,
      created_by: currentUser.id,
    })
    .select(`
      *,
      calendar:calendars(id, name, slug, type),
      user:users!blocked_slots_user_id_fkey(id, name, email, avatar_url),
      created_by_user:users!blocked_slots_created_by_fkey(id, name, email)
    `)
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'blocked_slot.created',
    entityType: 'blocked_slot',
    entityId: blockedSlot.id,
    afterState: blockedSlot,
  });

  return blockedSlot;
}

export async function updateBlockedSlot(
  id: string,
  data: UpdateBlockedSlotData,
  currentUser: User
): Promise<BlockedSlot> {
  const existing = await getBlockedSlotById(id);
  if (!existing) throw new Error('Blocked slot not found');

  const { data: blockedSlot, error } = await supabase
    .from('blocked_slots')
    .update(data)
    .eq('id', id)
    .select(`
      *,
      calendar:calendars(id, name, slug, type),
      user:users!blocked_slots_user_id_fkey(id, name, email, avatar_url),
      created_by_user:users!blocked_slots_created_by_fkey(id, name, email)
    `)
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'blocked_slot.updated',
    entityType: 'blocked_slot',
    entityId: id,
    beforeState: existing,
    afterState: blockedSlot,
  });

  return blockedSlot;
}

export async function deleteBlockedSlot(
  id: string,
  currentUser: User
): Promise<void> {
  const existing = await getBlockedSlotById(id);
  if (!existing) throw new Error('Blocked slot not found');

  const { error } = await supabase
    .from('blocked_slots')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'blocked_slot.deleted',
    entityType: 'blocked_slot',
    entityId: id,
    beforeState: existing,
  });
}
