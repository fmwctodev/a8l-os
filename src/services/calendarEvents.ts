import { supabase } from '../lib/supabase';
import type { CalendarEvent, CalendarEventFilters, User } from '../types';
import { logAudit } from './audit';
import { syncCalendarEventToGoogle } from './googleCalendarOutboundSync';

export interface CreateCalendarEventData {
  calendar_id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start_at_utc: string;
  end_at_utc: string;
  all_day?: boolean;
  timezone?: string;
  attendees?: { email?: string; name?: string }[];
  generate_meet?: boolean;
  color?: string | null;
  status?: 'confirmed' | 'tentative';
}

export interface UpdateCalendarEventData {
  title?: string;
  description?: string | null;
  location?: string | null;
  start_at_utc?: string;
  end_at_utc?: string;
  all_day?: boolean;
  timezone?: string;
  attendees?: { email?: string; name?: string }[];
  color?: string | null;
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

const SELECT_FIELDS = `
  *,
  calendar:calendars(id, name, slug, type),
  user:users!calendar_events_user_id_fkey(id, name, email, avatar_url)
`;

export async function getCalendarEvents(
  organizationId: string,
  filters: CalendarEventFilters = {}
): Promise<CalendarEvent[]> {
  let query = supabase
    .from('calendar_events')
    .select(SELECT_FIELDS)
    .eq('org_id', organizationId)
    .neq('status', 'cancelled')
    .order('start_at_utc', { ascending: true });

  if (filters.calendarId) query = query.eq('calendar_id', filters.calendarId);
  if (filters.calendarIds?.length) query = query.in('calendar_id', filters.calendarIds);
  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.userIds?.length) query = query.in('user_id', filters.userIds);
  if (filters.startDate) query = query.gte('start_at_utc', filters.startDate);
  if (filters.endDate) query = query.lte('start_at_utc', filters.endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCalendarEventById(id: string): Promise<CalendarEvent | null> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCalendarEvent(
  organizationId: string,
  eventData: CreateCalendarEventData,
  currentUser: User
): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      org_id: organizationId,
      calendar_id: eventData.calendar_id,
      user_id: currentUser.id,
      title: eventData.title,
      description: eventData.description || null,
      location: eventData.location || null,
      start_at_utc: eventData.start_at_utc,
      end_at_utc: eventData.end_at_utc,
      all_day: eventData.all_day || false,
      timezone: eventData.timezone || 'UTC',
      attendees: eventData.attendees || [],
      color: eventData.color || null,
      status: eventData.status || 'confirmed',
      created_by: currentUser.id,
    })
    .select(SELECT_FIELDS)
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'calendar_event.created',
    entityType: 'calendar_event',
    entityId: data.id,
    afterState: data,
  });

  syncCalendarEventToGoogle(data.id, 'create', eventData.generate_meet).catch(() => {});

  return data;
}

export async function updateCalendarEvent(
  id: string,
  updates: UpdateCalendarEventData,
  currentUser: User
): Promise<CalendarEvent> {
  const existing = await getCalendarEventById(id);
  if (!existing) throw new Error('Calendar event not found');

  const { data, error } = await supabase
    .from('calendar_events')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'calendar_event.updated',
    entityType: 'calendar_event',
    entityId: id,
    beforeState: existing,
    afterState: data,
  });

  syncCalendarEventToGoogle(id, 'update').catch(() => {});

  return data;
}

export async function deleteCalendarEvent(
  id: string,
  currentUser: User
): Promise<void> {
  const existing = await getCalendarEventById(id);
  if (!existing) throw new Error('Calendar event not found');

  const { error } = await supabase
    .from('calendar_events')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'calendar_event.deleted',
    entityType: 'calendar_event',
    entityId: id,
    beforeState: existing,
  });

  syncCalendarEventToGoogle(id, 'delete').catch(() => {});
}
