import { supabase } from '../lib/supabase';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-oauth`;

async function getHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (!refreshed) throw new Error('Session expired. Please log in again.');
    return {
      'Authorization': `Bearer ${refreshed.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
  }

  if (session.expires_at && session.expires_at * 1000 < Date.now() + 300_000) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (!refreshed) throw new Error('Session expired. Please log in again.');
    return {
      'Authorization': `Bearer ${refreshed.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
  }

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

export interface GoogleConnection {
  connected: boolean;
  email?: string;
  selectedCalendarIds?: string[];
  tokenExpired?: boolean;
  connectedAt?: string;
}

export interface GoogleCalendarItem {
  id: string;
  name: string;
  primary: boolean;
  accessRole: string;
}

export interface TeamConnectionItem {
  userId: string;
  userName: string;
  userEmail: string;
  connected: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
}

export interface TestSyncResult {
  success: boolean;
  busyBlockCount?: number;
  message?: string;
  error?: string;
  tokenExpired?: boolean;
}

export async function getGoogleConnection(): Promise<GoogleConnection> {
  const response = await fetch(`${EDGE_FUNCTION_URL}/connection`, {
    headers: await getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get connection status');
  }

  return response.json();
}

export async function initiateGoogleOAuth(): Promise<string> {
  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-oauth/callback`;

  const appOrigin = window.location.origin;

  const response = await fetch(
    `${EDGE_FUNCTION_URL}/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}&app_origin=${encodeURIComponent(appOrigin)}`,
    { headers: await getHeaders() }
  );

  if (!response.ok) {
    throw new Error('Failed to get auth URL');
  }

  const data = await response.json();
  return data.authUrl;
}

export async function disconnectGoogle(): Promise<void> {
  const response = await fetch(`${EDGE_FUNCTION_URL}/disconnect`, {
    method: 'POST',
    headers: await getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to disconnect');
  }
}

export async function getGoogleCalendarList(): Promise<{
  calendars: GoogleCalendarItem[];
  selectedCalendarIds: string[];
}> {
  const response = await fetch(`${EDGE_FUNCTION_URL}/calendars`, {
    headers: await getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get calendars');
  }

  return response.json();
}

export async function updateSelectedCalendars(calendarIds: string[]): Promise<void> {
  const response = await fetch(`${EDGE_FUNCTION_URL}/calendars`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify({ calendarIds }),
  });

  if (!response.ok) {
    throw new Error('Failed to update selected calendars');
  }
}

export async function testGoogleSync(): Promise<TestSyncResult> {
  const response = await fetch(`${EDGE_FUNCTION_URL}/test-sync`, {
    method: 'POST',
    headers: await getHeaders(),
  });

  return response.json();
}

export async function getTeamConnections(): Promise<TeamConnectionItem[]> {
  const response = await fetch(`${EDGE_FUNCTION_URL}/team-connections`, {
    headers: await getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get team connections');
  }

  const data = await response.json();
  return data.connections;
}

export function openGoogleOAuthPopup(authUrl: string): Promise<{ success: boolean; email?: string; error?: string }> {
  return new Promise((resolve) => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'google-oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-oauth-success') {
        window.removeEventListener('message', handleMessage);
        resolve({ success: true, email: event.data.email });
      } else if (event.data?.type === 'google-oauth-error') {
        window.removeEventListener('message', handleMessage);
        resolve({ success: false, error: event.data.error });
      }
    };

    window.addEventListener('message', handleMessage);

    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        resolve({ success: false, error: 'Popup closed' });
      }
    }, 500);
  });
}
