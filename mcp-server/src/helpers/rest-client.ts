import { config } from '../config.js';
import type { RestQueryParams } from '../types.js';

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'apikey': config.supabaseAnonKey,
    'Authorization': `Bearer ${config.accessToken}`,
    'Content-Type': 'application/json',
  };
  if (extra) {
    Object.assign(headers, extra);
  }
  return headers;
}

function buildQueryString(params?: RestQueryParams): string {
  if (!params) return '';
  const parts: string[] = [];
  if (params.select) parts.push(`select=${encodeURIComponent(params.select)}`);
  if (params.order) parts.push(`order=${encodeURIComponent(params.order)}`);
  if (params.limit !== undefined) parts.push(`limit=${params.limit}`);
  if (params.offset !== undefined) parts.push(`offset=${params.offset}`);
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

async function handleResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!res.ok) {
    let errorData;
    try {
      errorData = JSON.parse(text);
    } catch {
      errorData = { message: text || res.statusText };
    }
    throw new Error(
      `API Error ${res.status}: ${errorData.message || errorData.error || res.statusText}${errorData.details ? ` - ${errorData.details}` : ''}`,
    );
  }
  if (!text) return null;
  return JSON.parse(text);
}

export async function restGet(table: string, params?: RestQueryParams): Promise<unknown> {
  const qs = buildQueryString(params);
  const extraHeaders: Record<string, string> = {};
  if (params?.prefer) extraHeaders['Prefer'] = params.prefer;
  if (params?.accept) extraHeaders['Accept'] = params.accept;
  const url = `${config.supabaseUrl}/rest/v1/${table}${qs}`;
  const res = await fetch(url, { method: 'GET', headers: buildHeaders(extraHeaders) });
  return handleResponse(res);
}

export async function restPost(
  table: string,
  body: unknown,
  prefer?: string,
): Promise<unknown> {
  const headers = buildHeaders(prefer ? { Prefer: prefer } : undefined);
  const url = `${config.supabaseUrl}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function restPatch(
  table: string,
  filters: Record<string, string>,
  body: unknown,
  prefer?: string,
): Promise<unknown> {
  const qs = buildQueryString({ filters });
  const headers = buildHeaders(prefer ? { Prefer: prefer } : undefined);
  const url = `${config.supabaseUrl}/rest/v1/${table}${qs}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function restDelete(
  table: string,
  filters: Record<string, string>,
): Promise<unknown> {
  const qs = buildQueryString({ filters });
  const url = `${config.supabaseUrl}/rest/v1/${table}${qs}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  return handleResponse(res);
}
