import { config } from '../config.js';

export async function callEdgeFunction(
  slug: string,
  body?: unknown,
  method: string = 'POST',
): Promise<unknown> {
  const headers: Record<string, string> = {
    'apikey': config.supabaseAnonKey,
    'Authorization': `Bearer ${config.accessToken}`,
    'Content-Type': 'application/json',
  };

  const url = `${config.supabaseUrl}/functions/v1/${slug}`;
  const options: RequestInit = { method, headers };
  if (body !== undefined && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const text = await res.text();

  if (!res.ok) {
    let errorData;
    try {
      errorData = JSON.parse(text);
    } catch {
      errorData = { message: text || res.statusText };
    }
    throw new Error(
      `Edge Function '${slug}' error ${res.status}: ${errorData.error || errorData.message || res.statusText}`,
    );
  }

  if (!text) return { success: true };
  return JSON.parse(text);
}
