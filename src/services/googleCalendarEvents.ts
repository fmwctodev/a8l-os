import { supabase } from '../lib/supabase';
import type { GoogleCalendarEvent } from '../types';

interface GoogleEventFilters {
  startDate?: string;
  endDate?: string;
  userIds?: string[];
  googleCalendarIds?: string[];
}

async function getFreshSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (!refreshed) throw new Error('Session expired. Please log in again.');
    return refreshed;
  }

  const expiresAt = session.expires_at;
  if (!expiresAt || expiresAt * 1000 < Date.now() + 300_000) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (!refreshed) throw new Error('Session expired. Please log in again.');
    return refreshed;
  }

  const { error: validateError } = await supabase.auth.getUser(session.access_token);
  if (validateError) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (!refreshed) throw new Error('Session expired. Please log in again.');
    return refreshed;
  }

  return session;
}

async function callGoogleCalendarApi(action: string, body?: Record<string, unknown>) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`;
  const payload = JSON.stringify({ action, ...body });

  const attempt = async (session: { access_token: string }) => {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: payload,
    });
  };

  let session = await getFreshSession();
  let response = await attempt(session);

  if (response.status === 401) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (refreshed) {
      session = refreshed;
      response = await attempt(session);
    }
    if (response.status === 401) {
      throw new Error('Authentication failed. Please log in again.');
    }
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const errObj = (err as Record<string, unknown>).error;
    const errMsg = typeof errObj === 'string'
      ? errObj
      : (errObj as Record<string, string>)?.message
        || (err as Record<string, string>).message
        || 'Google Calendar API call failed';
    throw new Error(errMsg);
  }

  return response.json();
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

export async function syncGoogleCalendar(): Promise<{ synced: number; errors?: string[] }> {
  const result = await callGoogleCalendarApi('sync');
  const data = result.data || result;
  if (data.errors?.length) {
    console.warn('Google Calendar sync errors:', data.errors);
  }
  return data;
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
  await callGoogleCalendarApi('update-event', { eventId, updates });
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  await callGoogleCalendarApi('delete-event', { eventId });
}

export async function rsvpGoogleCalendarEvent(
  eventId: string,
  response: 'accepted' | 'declined' | 'tentative'
): Promise<void> {
  await callGoogleCalendarApi('rsvp', { eventId, response });
}

export async function hasGoogleCalendarConnection(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('google_calendar_connections')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
}
