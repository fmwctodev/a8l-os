import { supabase } from './supabase';

export async function getFreshSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('No active session. Please log in.');
  }

  const expiresAt = session.expires_at;
  if (expiresAt && expiresAt * 1000 > Date.now() + 60_000) {
    return session;
  }

  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  if (!refreshed) {
    throw new Error('Session expired. Please log out and log back in.');
  }
  return refreshed;
}

export async function callEdgeFunction(
  slug: string,
  body: Record<string, unknown>,
  method: 'POST' | 'GET' = 'POST'
): Promise<Response> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${slug}`;

  const attempt = async (accessToken: string) => {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };

    return fetch(url, {
      method,
      headers,
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    });
  };

  const session = await getFreshSession();
  let response = await attempt(session.access_token);

  if (response.status === 401) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (refreshed) {
      response = await attempt(refreshed.access_token);
    }
    if (response.status === 401) {
      throw new Error('Session expired. Please log out and log back in.');
    }
  }

  return response;
}

export function parseEdgeFunctionError(
  err: Record<string, unknown>,
  fallback: string
): string {
  const errObj = err.error;
  if (typeof errObj === 'string') return errObj;
  if (errObj && typeof errObj === 'object') {
    const msg = (errObj as Record<string, string>).message;
    if (msg) return msg;
  }
  return (err.message as string) || (err.msg as string) || fallback;
}
