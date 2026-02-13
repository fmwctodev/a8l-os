import { supabase } from '../lib/supabase';

async function getFreshSession() {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
      throw new Error('Unable to get session. Please log in again.');
    }

    if (!session) {
      const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed) {
        console.error('Refresh error:', refreshError);
        throw new Error('Session expired. Please log in again.');
      }
      return refreshed;
    }

    const expiresAt = session.expires_at;
    if (!expiresAt || expiresAt * 1000 < Date.now() + 300_000) {
      const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed) {
        console.error('Refresh error:', refreshError);
        throw new Error('Session expired. Please log in again.');
      }
      return refreshed;
    }

    return session;
  } catch (err) {
    console.error('getFreshSession failed:', err);
    throw err;
  }
}

async function callSyncApi(action: string, body: Record<string, unknown>) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`;
  const payload = JSON.stringify({ action, ...body });

  let session;
  try {
    session = await getFreshSession();
  } catch (err) {
    console.error('Failed to get fresh session:', err);
    throw new Error('Authentication failed. Please refresh the page and try again.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('No user found after getting session');
    throw new Error('Not authenticated. Please log in again.');
  }

  console.log('[GoogleCalendarSync] Calling edge function:', action);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: payload,
  });

  console.log('[GoogleCalendarSync] Response status:', response.status);

  if (response.status === 401) {
    console.warn('[GoogleCalendarSync] Received 401, checking connection status...');

    const { data: connection } = await supabase
      .from('google_calendar_connections')
      .select('id, email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!connection) {
      throw new Error('Google Calendar is not connected. Please connect your Google Calendar first.');
    }

    console.warn('[GoogleCalendarSync] Connection exists, attempting to refresh session and retry...');

    try {
      const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error('[GoogleCalendarSync] Session refresh failed:', refreshError);
        throw new Error('Your session has expired. Please refresh the page and try again.');
      }

      if (!refreshed) {
        throw new Error('Your session has expired. Please refresh the page and try again.');
      }

      console.log('[GoogleCalendarSync] Session refreshed, retrying request...');

      const retry = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshed.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: payload,
      });

      console.log('[GoogleCalendarSync] Retry response status:', retry.status);

      if (retry.status === 401) {
        const errDetail = await retry.json().catch(() => ({}));
        console.error('[GoogleCalendarSync] Retry still failed with 401:', errDetail);
        throw new Error('Authentication failed after retry. Please log out and log back in to refresh your session.');
      }

      if (!retry.ok) {
        const err = await retry.json().catch(() => ({}));
        const errObj = (err as Record<string, unknown>).error;
        const errMsg = typeof errObj === 'string'
          ? errObj
          : (errObj as Record<string, string>)?.message || 'Sync failed';
        console.error('[GoogleCalendarSync] Retry failed:', errMsg);
        throw new Error(errMsg);
      }

      console.log('[GoogleCalendarSync] Retry succeeded');
      return retry.json();
    } catch (err) {
      console.error('[GoogleCalendarSync] Retry after 401 failed:', err);
      throw err;
    }
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const errObj = (err as Record<string, unknown>).error;
    const errMsg = typeof errObj === 'string'
      ? errObj
      : (errObj as Record<string, string>)?.message || 'Sync failed';
    console.error('[GoogleCalendarSync] Request failed:', errMsg, err);
    throw new Error(errMsg);
  }

  console.log('[GoogleCalendarSync] Request succeeded');
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
