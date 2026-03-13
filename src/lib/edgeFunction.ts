import { supabase } from './supabase';

type SessionListener = (event: 'expired' | 'restored') => void;
const listeners = new Set<SessionListener>();
let sessionHealthy = true;
let refreshPromise: Promise<{ access_token: string; expires_at?: number } | null> | null = null;
let lastRestoredAt = 0;
const RESTORE_COOLDOWN_MS = 3000;

let sessionReadyResolve: (() => void) | null = null;
let sessionReadyPromise: Promise<void> | null = null;

function isOAuthCallback(): boolean {
  const hash = window.location.hash;
  return hash.includes('access_token=') || hash.includes('refresh_token=') || hash.includes('error=');
}

if (isOAuthCallback()) {
  sessionHealthy = false;
  sessionReadyPromise = new Promise<void>((resolve) => {
    sessionReadyResolve = resolve;
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      markSessionRestored();
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      if (sessionReadyResolve) {
        sessionReadyResolve();
        sessionReadyResolve = null;
        sessionReadyPromise = null;
      }
      subscription.unsubscribe();
    }
  });
}

export function onSessionEvent(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isSessionHealthy(): boolean {
  return sessionHealthy;
}

export function markSessionRestored(): void {
  sessionHealthy = true;
  lastRestoredAt = Date.now();
  listeners.forEach(l => l('restored'));
}

function emitExpired(): void {
  if (!sessionHealthy) return;
  if (Date.now() - lastRestoredAt < RESTORE_COOLDOWN_MS) return;
  sessionHealthy = false;
  listeners.forEach(l => l('expired'));
}

async function dedupedRefresh(): Promise<{ access_token: string; expires_at?: number } | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = supabase.auth.refreshSession()
    .then(({ data: { session } }) => session)
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function forceRefresh(): Promise<{ access_token: string; expires_at?: number } | null> {
  refreshPromise = null;
  return dedupedRefresh();
}

const EXPIRY_BUFFER_MS = 120_000;

export async function getFreshSession() {
  let { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const refreshed = await dedupedRefresh().catch(() => null);
    if (refreshed) return refreshed;
    await new Promise(r => setTimeout(r, 500));
    const { data: { session: retrySession } } = await supabase.auth.getSession();
    if (retrySession) return retrySession;
    emitExpired();
    throw new Error('No active session. Please log in.');
  }

  if (session.expires_at && session.expires_at * 1000 > Date.now() + EXPIRY_BUFFER_MS) {
    return session;
  }

  const refreshed = await forceRefresh();
  if (!refreshed) {
    await new Promise(r => setTimeout(r, 500));
    const { data: { session: retrySession } } = await supabase.auth.getSession();
    if (retrySession) return retrySession;
    emitExpired();
    throw new Error('Session expired. Please log out and log back in.');
  }
  return refreshed;
}

function buildHeaders(accessToken: string, includeContentType: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function authenticatedFetch(
  url: string, method: string, accessToken: string, body?: string | FormData
): Promise<Response> {
  const isFormData = body instanceof FormData;
  const headers = buildHeaders(accessToken, !isFormData);
  const init: RequestInit = { method, headers };
  if (body) init.body = body;

  let response = await fetch(url, init);

  if (response.status === 401) {
    const refreshed = await forceRefresh();
    if (!refreshed) {
      emitExpired();
      throw new Error('Session expired. Please log out and log back in.');
    }
    markSessionRestored();
    const retryHeaders = buildHeaders(refreshed.access_token, !isFormData);
    const retryInit: RequestInit = { method, headers: retryHeaders };
    if (body) retryInit.body = body;
    response = await fetch(url, retryInit);
    if (response.status === 401) {
      emitExpired();
    }
  }

  return response;
}

async function tryRecoverSession(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.refresh_token) return false;

  const refreshed = await forceRefresh();
  if (refreshed?.access_token) {
    markSessionRestored();
    return true;
  }
  return false;
}

export async function callEdgeFunction(
  slug: string,
  body: Record<string, unknown>,
  method: 'POST' | 'GET' = 'POST'
): Promise<Response> {
  if (sessionReadyPromise) await sessionReadyPromise;
  if (!sessionHealthy) {
    const recovered = await tryRecoverSession();
    if (!recovered) {
      throw new Error('Session expired. Please log out and log back in.');
    }
  }
  const session = await getFreshSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${slug}`;
  return authenticatedFetch(url, method, session.access_token,
    method === 'POST' ? JSON.stringify(body) : undefined);
}

interface FetchEdgeOptions {
  method?: string;
  path?: string;
  params?: Record<string, string>;
  body?: Record<string, unknown> | FormData;
}

export async function fetchEdge(slug: string, options: FetchEdgeOptions = {}): Promise<Response> {
  if (sessionReadyPromise) await sessionReadyPromise;
  if (!sessionHealthy) {
    const recovered = await tryRecoverSession();
    if (!recovered) {
      throw new Error('Session expired. Please log out and log back in.');
    }
  }
  const { body, method = 'POST', path = '', params } = options;
  const session = await getFreshSession();

  let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${slug}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const isFormData = body instanceof FormData;
  const serializedBody = body ? (isFormData ? body : JSON.stringify(body)) : undefined;
  return authenticatedFetch(url, method, session.access_token, serializedBody);
}

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export async function streamEdgeFunction(
  slug: string,
  body: Record<string, unknown>
): Promise<Response> {
  if (sessionReadyPromise) await sessionReadyPromise;
  if (!sessionHealthy) {
    const recovered = await tryRecoverSession();
    if (!recovered) {
      throw new Error('Session expired. Please log out and log back in.');
    }
  }
  const session = await getFreshSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${slug}`;
  const headers = buildHeaders(session.access_token, true);
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const json = trimmed.slice(6);
      if (json === '[DONE]') return;
      try {
        yield JSON.parse(json) as SSEEvent;
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  if (buffer.trim().startsWith('data: ')) {
    const json = buffer.trim().slice(6);
    if (json !== '[DONE]') {
      try {
        yield JSON.parse(json) as SSEEvent;
      } catch {
        // skip
      }
    }
  }
}

export async function getEdgeWebSocketUrl(slug: string): Promise<{ url: string; token: string }> {
  if (sessionReadyPromise) await sessionReadyPromise;
  if (!sessionHealthy) {
    const recovered = await tryRecoverSession();
    if (!recovered) {
      throw new Error('Session expired. Please log out and log back in.');
    }
  }
  const session = await getFreshSession();
  const base = import.meta.env.VITE_SUPABASE_URL.replace(/^https?:\/\//, '');
  const protocol = import.meta.env.VITE_SUPABASE_URL.startsWith('https') ? 'wss' : 'ws';
  return {
    url: `${protocol}://${base}/functions/v1/${slug}`,
    token: session.access_token,
  };
}

export function parseEdgeFunctionError(
  err: Record<string, unknown>,
  fallback: string
): string {
  const errObj = err.error;
  if (typeof errObj === 'string') return errObj;
  if (errObj && typeof errObj === 'object') {
    const e = errObj as Record<string, unknown>;
    const msg = e.message as string | undefined;
    const detail = e.detail;
    if (msg && detail) return `${msg}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
    if (msg) return msg;
  }
  return (err.message as string) || (err.msg as string) || fallback;
}
