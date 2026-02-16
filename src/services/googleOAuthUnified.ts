import { supabase } from '../lib/supabase';

const UNIFIED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-unified`;

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

export interface UnifiedGoogleConnection {
  connected: boolean;
  legacy?: boolean;
  email: string | null;
  gmail: boolean;
  calendar: boolean;
  drive: boolean;
  scopes: string[];
  connectedAt?: string;
  tokenExpired?: boolean;
}

export async function getUnifiedGoogleConnection(): Promise<UnifiedGoogleConnection> {
  const response = await fetch(`${UNIFIED_URL}/connection`, {
    headers: await getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get Google connection status');
  }

  return response.json();
}

export async function initiateUnifiedGoogleOAuth(): Promise<string> {
  const appOrigin = window.location.origin;

  const response = await fetch(`${UNIFIED_URL}/start?app_origin=${encodeURIComponent(appOrigin)}`, {
    method: 'POST',
    headers: await getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start Google OAuth');
  }

  const data = await response.json();
  return data.authUrl;
}

export async function disconnectUnifiedGoogle(): Promise<void> {
  const response = await fetch(`${UNIFIED_URL}/disconnect`, {
    method: 'POST',
    headers: await getHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to disconnect Google');
  }
}

export function openUnifiedGoogleOAuthPopup(authUrl: string): Promise<{ success: boolean; email?: string; error?: string }> {
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
