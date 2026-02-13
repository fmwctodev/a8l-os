import { supabase } from '../lib/supabase';

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

  return session;
}

async function callSyncApi(action: string, body: Record<string, unknown>) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`;
  const payload = JSON.stringify({ action, ...body });

  const session = await getFreshSession();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: payload,
  });

  if (response.status === 401) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (!refreshed) throw new Error('Authentication failed. Please log in again.');

    const retry = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${refreshed.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: payload,
    });

    if (!retry.ok) {
      const err = await retry.json().catch(() => ({}));
      throw new Error((err as Record<string, string>).error || 'Sync failed');
    }
    return retry.json();
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as Record<string, string>).error || 'Sync failed');
  }

  return response.json();
}

export async function syncAppointmentToGoogle(
  appointmentId: string,
  operation: 'create' | 'update' | 'reschedule' | 'delete' = 'create'
): Promise<{ synced: boolean; googleEventId?: string; meetLink?: string }> {
  try {
    const result = await callSyncApi('sync-appointment', { appointmentId, operation });
    return result.data || result;
  } catch (err) {
    console.error('Appointment sync failed:', err);
    return { synced: false };
  }
}

export async function syncBlockedSlotToGoogle(
  blockedSlotId: string,
  operation: 'create' | 'update' | 'delete' = 'create'
): Promise<{ synced: boolean; googleEventId?: string }> {
  try {
    const result = await callSyncApi('sync-blocked-slot', { blockedSlotId, operation });
    return result.data || result;
  } catch (err) {
    console.error('Blocked slot sync failed:', err);
    return { synced: false };
  }
}

export async function syncCalendarEventToGoogle(
  calendarEventId: string,
  operation: 'create' | 'update' | 'delete' = 'create',
  generateMeet = false
): Promise<{ synced: boolean; googleEventId?: string; meetLink?: string }> {
  try {
    const result = await callSyncApi('sync-calendar-event', { calendarEventId, operation, generateMeet });
    return result.data || result;
  } catch (err) {
    console.error('Calendar event sync failed:', err);
    return { synced: false };
  }
}

export async function syncTaskToGoogle(
  taskId: string,
  operation: 'create' | 'update' | 'delete' = 'create'
): Promise<{ synced: boolean; googleEventId?: string }> {
  try {
    const result = await callSyncApi('sync-task', { taskId, operation });
    return result.data || result;
  } catch (err) {
    console.error('Task sync failed:', err);
    return { synced: false };
  }
}
