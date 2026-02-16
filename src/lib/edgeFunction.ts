import { supabase } from './supabase';

type SessionListener = (event: 'expired' | 'restored') => void;
const listeners = new Set<SessionListener>();
let sessionHealthy = true;
let refreshPromise: Promise<{ access_token: string; expires_at?: number } | null> | null = null;

export function onSessionEvent(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isSessionHealthy(): boolean {
  return sessionHealthy;
}

export function markSessionRestored(): void {
  sessionHealthy = true;
  listeners.forEach(l => l('restored'));
}

function emitExpired(): void {
  if (!sessionHealthy) return;
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

const EXPIRY_BUFFER_MS = 120_000;

export async function getFreshSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    emitExpired();
    throw new Error('No active session. Please log in.');
  }

  if (session.expires_at && session.expires_at * 1000 > Date.now() + EXPIRY_BUFFER_MS) {
    return session;
  }

  const refreshed = await dedupedRefresh();
  if (!refreshed) {
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
    const refreshed = await dedupedRefresh();
    if (refreshed) {
      const retryHeaders = buildHeaders(refreshed.access_token, !isFormData);
      const retryInit: RequestInit = { method, headers: retryHeaders };
      if (body) retryInit.body = body;
      response = await fetch(url, retryInit);
    }
    if (response.status === 401) {
      emitExpired();
      throw new Error('Session expired. Please log out and log back in.');
    }
  }

  return response;
}

export async function callEdgeFunction(
  slug: string,
  body: Record<string, unknown>,
  method: 'POST' | 'GET' = 'POST'
): Promise<Response> {
  if (!sessionHealthy) {
    throw new Error('Session expired. Please log out and log back in.');
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
  if (!sessionHealthy) {
    throw new Error('Session expired. Please log out and log back in.');
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
