import { fetchEdge } from '../lib/edgeFunction';

const SLUG = 'google-calendar-oauth';

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
  const response = await fetchEdge(SLUG, { method: 'GET', path: '/connection' });
  if (!response.ok) throw new Error('Failed to get connection status');
  return response.json();
}

export async function initiateGoogleOAuth(): Promise<string> {
  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${SLUG}/callback`;
  const appOrigin = window.location.origin;

  const response = await fetchEdge(SLUG, {
    method: 'GET',
    path: '/auth-url',
    params: {
      redirect_uri: redirectUri,
      app_origin: appOrigin,
    },
  });

  if (!response.ok) throw new Error('Failed to get auth URL');
  const data = await response.json();
  return data.authUrl;
}

export async function disconnectGoogle(): Promise<void> {
  const response = await fetchEdge(SLUG, { method: 'POST', path: '/disconnect' });
  if (!response.ok) throw new Error('Failed to disconnect');
}

export async function getGoogleCalendarList(): Promise<{
  calendars: GoogleCalendarItem[];
  selectedCalendarIds: string[];
}> {
  const response = await fetchEdge(SLUG, { method: 'GET', path: '/calendars' });
  if (!response.ok) throw new Error('Failed to get calendars');
  return response.json();
}

export async function updateSelectedCalendars(calendarIds: string[]): Promise<void> {
  const response = await fetchEdge(SLUG, {
    method: 'POST',
    path: '/calendars',
    body: { calendarIds },
  });
  if (!response.ok) throw new Error('Failed to update selected calendars');
}

export async function testGoogleSync(): Promise<TestSyncResult> {
  const response = await fetchEdge(SLUG, { method: 'POST', path: '/test-sync' });
  return response.json();
}

export async function getTeamConnections(): Promise<TeamConnectionItem[]> {
  const response = await fetchEdge(SLUG, { method: 'GET', path: '/team-connections' });
  if (!response.ok) throw new Error('Failed to get team connections');
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
