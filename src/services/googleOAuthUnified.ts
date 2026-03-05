import { fetchEdge } from '../lib/edgeFunction';

const SLUG = 'google-oauth-unified';

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
  const response = await fetchEdge(SLUG, { method: 'GET', path: '/connection' });
  if (!response.ok) throw new Error('Failed to get Google connection status');
  return response.json();
}

export async function initiateUnifiedGoogleOAuth(): Promise<string> {
  const appOrigin = window.location.origin;
  const response = await fetchEdge(SLUG, {
    method: 'POST',
    path: '/start',
    params: { app_origin: appOrigin },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start Google OAuth');
  }

  const data = await response.json();
  return data.authUrl;
}

export async function disconnectUnifiedGoogle(): Promise<void> {
  const response = await fetchEdge(SLUG, { method: 'POST', path: '/disconnect' });
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

    let resolved = false;
    let checkClosed: ReturnType<typeof setInterval>;

    const safeResolve = (value: { success: boolean; email?: string; error?: string }) => {
      if (!resolved) {
        resolved = true;
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        resolve(value);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-oauth-success') {
        safeResolve({ success: true, email: event.data.email });
      } else if (event.data?.type === 'google-oauth-error') {
        safeResolve({ success: false, error: event.data.error });
      }
    };

    window.addEventListener('message', handleMessage);

    checkClosed = setInterval(() => {
      try {
        if (popup?.closed) {
          safeResolve({ success: false, error: 'Popup closed' });
        }
      } catch {
        safeResolve({ success: false, error: 'Popup closed' });
      }
    }, 500);
  });
}
