import { supabase } from '../lib/supabase';
import type { GoogleCalendarEvent } from '../types';

interface GoogleEventFilters {
  startDate?: string;
  endDate?: string;
  userIds?: string[];
  googleCalendarIds?: string[];
}

export async function getGoogleCalendarEvents(
  organizationId: string,
  userId: string,
  filters: GoogleEventFilters = {}
): Promise<GoogleCalendarEvent[]> {
  let query = supabase
    .from('google_calendar_events')
    .select('*')
    .eq('org_id', organizationId)
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true });

  if (filters.startDate) query = query.gte('end_time', filters.startDate);
  if (filters.endDate) query = query.lte('start_time', filters.endDate);
  if (filters.googleCalendarIds?.length) {
    query = query.in('google_calendar_id', filters.googleCalendarIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getTeamGoogleCalendarEvents(
  organizationId: string,
  userIds: string[],
  filters: GoogleEventFilters = {}
): Promise<GoogleCalendarEvent[]> {
  if (userIds.length === 0) return [];

  let query = supabase
    .from('google_calendar_events')
    .select('*')
    .eq('org_id', organizationId)
    .in('user_id', userIds)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true });

  if (filters.startDate) query = query.gte('end_time', filters.startDate);
  if (filters.endDate) query = query.lte('start_time', filters.endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getAllOrgGoogleCalendarEvents(
  organizationId: string,
  filters: GoogleEventFilters = {}
): Promise<GoogleCalendarEvent[]> {
  let query = supabase
    .from('google_calendar_events')
    .select('*')
    .eq('org_id', organizationId)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true });

  if (filters.startDate) query = query.gte('end_time', filters.startDate);
  if (filters.endDate) query = query.lte('start_time', filters.endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function syncGoogleCalendar(): Promise<{ synced: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync/sync`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Sync failed' }));
    throw new Error(err.error?.message || 'Google Calendar sync failed');
  }

  const result = await response.json();
  return result.data || { synced: 0 };
}

export async function updateGoogleCalendarEvent(
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    location?: string;
    start_time?: string;
    end_time?: string;
    all_day?: boolean;
    timezone?: string;
  }
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync/update-event`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ eventId, updates }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Update failed' }));
    throw new Error(err.error?.message || 'Failed to update event');
  }
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync/delete-event`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ eventId }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(err.error?.message || 'Failed to delete event');
  }
}

export async function hasGoogleCalendarConnection(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('google_calendar_connections')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
}
