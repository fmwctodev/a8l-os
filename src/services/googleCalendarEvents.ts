import { supabase } from '../lib/supabase';
import { callEdgeFunction, parseEdgeFunctionError } from '../lib/edgeFunction';
import type { GoogleCalendarEvent } from '../types';

interface GoogleEventFilters {
  startDate?: string;
  endDate?: string;
  userIds?: string[];
  googleCalendarIds?: string[];
}

async function callGoogleCalendarApi(action: string, body?: Record<string, unknown>) {
  const response = await callEdgeFunction('google-calendar-sync', { action, ...body });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(parseEdgeFunctionError(err, 'Google Calendar API call failed'));
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

export async function triggerIncrementalSync(): Promise<{ processed: number; errors?: string[] }> {
  const result = await callGoogleCalendarApi('sync-incremental');
  const data = result.data || result;
  if (data.errors?.length) {
    console.warn('Google Calendar incremental sync errors:', data.errors);
  }
  return data;
}

export async function triggerManualSync(): Promise<{ synced: number; errors?: string[] }> {
  return syncGoogleCalendar();
}

export async function getSyncStatus(userId: string): Promise<{
  connected: boolean;
  syncEnabled: boolean;
  lastFullSync: string | null;
  lastIncrementalSync: string | null;
  pendingJobs: number;
}> {
  const { data: connection } = await supabase
    .from('google_calendar_connections')
    .select('id, sync_enabled, last_full_sync_at, last_incremental_sync_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!connection) {
    return { connected: false, syncEnabled: false, lastFullSync: null, lastIncrementalSync: null, pendingJobs: 0 };
  }

  const { count } = await supabase
    .from('google_calendar_sync_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('connection_id', connection.id)
    .in('status', ['queued', 'processing']);

  return {
    connected: true,
    syncEnabled: connection.sync_enabled ?? false,
    lastFullSync: connection.last_full_sync_at || null,
    lastIncrementalSync: connection.last_incremental_sync_at || null,
    pendingJobs: count || 0,
  };
}

export async function getSyncLogs(
  connectionId: string,
  limit = 50
): Promise<{ id: string; level: string; message: string; calendar_id: string | null; meta: Record<string, unknown> | null; created_at: string }[]> {
  const { data, error } = await supabase
    .from('calendar_sync_logs')
    .select('id, level, message, calendar_id, meta, created_at')
    .eq('connection_id', connectionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getEventMap(
  connectionId: string,
  appointmentId?: string
): Promise<{ google_event_id: string; appointment_id: string | null; sync_direction: string; sync_status: string; is_deleted: boolean; last_google_updated_at: string | null; last_crm_updated_at: string | null }[]> {
  let query = supabase
    .from('calendar_event_map')
    .select('google_event_id, appointment_id, sync_direction, sync_status, is_deleted, last_google_updated_at, last_crm_updated_at')
    .eq('connection_id', connectionId)
    .eq('is_deleted', false);

  if (appointmentId) {
    query = query.eq('appointment_id', appointmentId);
  }

  const { data, error } = await query.order('updated_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
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
