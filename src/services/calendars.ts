import { supabase } from '../lib/supabase';
import type {
  Calendar,
  CalendarMember,
  CalendarType,
  CalendarSettings,
  User,
  CalendarFilters,
} from '../types';
import { logAudit } from './audit';

export interface CreateCalendarData {
  type: CalendarType;
  name: string;
  slug: string;
  department_id?: string | null;
  owner_user_id?: string | null;
  settings?: Partial<CalendarSettings>;
}

export interface UpdateCalendarData {
  name?: string;
  slug?: string;
  department_id?: string | null;
  settings?: Partial<CalendarSettings>;
}

export async function getCalendars(
  organizationId: string,
  filters: CalendarFilters & { activeOnly?: boolean } = {}
): Promise<Calendar[]> {
  let query = supabase
    .from('calendars')
    .select(`
      *,
      owner:users!calendars_owner_user_id_fkey(id, name, email, avatar_url),
      department:departments(*),
      members:calendar_members(
        *,
        user:users(id, name, email, avatar_url)
      ),
      appointment_types(id, name, slug, duration_minutes, active)
    `)
    .eq('org_id', organizationId)
    .order('created_at', { ascending: false });

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.departmentId) {
    query = query.eq('department_id', filters.departmentId);
  }

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  if (filters.activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

export async function getCalendarById(id: string): Promise<Calendar | null> {
  const { data, error } = await supabase
    .from('calendars')
    .select(`
      *,
      owner:users!calendars_owner_user_id_fkey(id, name, email, avatar_url),
      department:departments(*),
      members:calendar_members(
        *,
        user:users(id, name, email, avatar_url)
      ),
      appointment_types(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCalendarBySlug(
  organizationId: string,
  slug: string
): Promise<Calendar | null> {
  const { data, error } = await supabase
    .from('calendars')
    .select(`
      *,
      owner:users!calendars_owner_user_id_fkey(id, name, email, avatar_url),
      department:departments(*),
      members:calendar_members(
        *,
        user:users(id, name, email, avatar_url)
      ),
      appointment_types(*)
    `)
    .eq('org_id', organizationId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCalendar(
  organizationId: string,
  calendarData: CreateCalendarData,
  currentUser: User
): Promise<Calendar> {
  const settings: CalendarSettings = {
    assignment_mode: 'round_robin',
    last_assigned_index: 0,
    ...calendarData.settings,
  };

  const { data, error } = await supabase
    .from('calendars')
    .insert({
      org_id: organizationId,
      type: calendarData.type,
      name: calendarData.name,
      slug: calendarData.slug,
      department_id: calendarData.department_id || null,
      owner_user_id: calendarData.type === 'user' ? calendarData.owner_user_id : null,
      settings,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'create',
    entityType: 'calendar',
    entityId: data.id,
    afterState: data,
  });

  return data;
}

export async function updateCalendar(
  id: string,
  updates: UpdateCalendarData,
  currentUser: User
): Promise<Calendar> {
  const { data: before } = await supabase
    .from('calendars')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.slug !== undefined) updateData.slug = updates.slug;
  if (updates.department_id !== undefined) updateData.department_id = updates.department_id;
  if (updates.settings !== undefined) {
    updateData.settings = { ...before?.settings, ...updates.settings };
  }

  const { data, error } = await supabase
    .from('calendars')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'update',
    entityType: 'calendar',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data;
}

export async function deleteCalendar(id: string, currentUser: User): Promise<void> {
  const { data: before } = await supabase
    .from('calendars')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('calendars').delete().eq('id', id);
  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'delete',
    entityType: 'calendar',
    entityId: id,
    beforeState: before,
  });
}

export async function addCalendarMember(
  calendarId: string,
  userId: string,
  options: { weight?: number; priority?: number } = {}
): Promise<CalendarMember> {
  const { data, error } = await supabase
    .from('calendar_members')
    .insert({
      calendar_id: calendarId,
      user_id: userId,
      weight: options.weight || 1,
      priority: options.priority || 5,
      active: true,
    })
    .select(`
      *,
      user:users(id, name, email, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateCalendarMember(
  memberId: string,
  updates: { weight?: number; priority?: number; active?: boolean }
): Promise<CalendarMember> {
  const { data, error } = await supabase
    .from('calendar_members')
    .update(updates)
    .eq('id', memberId)
    .select(`
      *,
      user:users(id, name, email, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function removeCalendarMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('calendar_members').delete().eq('id', memberId);
  if (error) throw error;
}

export async function getCalendarMembers(calendarId: string): Promise<CalendarMember[]> {
  const { data, error } = await supabase
    .from('calendar_members')
    .select(`
      *,
      user:users(id, name, email, avatar_url)
    `)
    .eq('calendar_id', calendarId)
    .order('priority', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function enableCalendar(id: string, currentUser: User): Promise<Calendar> {
  const { data: before } = await supabase
    .from('calendars')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('calendars')
    .update({ active: true })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'enable',
    entityType: 'calendar',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data;
}

export async function disableCalendar(id: string, currentUser: User): Promise<Calendar> {
  const { data: before } = await supabase
    .from('calendars')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('calendars')
    .update({ active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'disable',
    entityType: 'calendar',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
