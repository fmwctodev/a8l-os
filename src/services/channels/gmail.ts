import { supabase } from '../../lib/supabase';
import type { GmailOAuthToken } from '../../types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export function getGmailAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to exchange code for tokens');
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to refresh token');
  }

  return response.json();
}

export async function getGmailUserEmail(accessToken: string): Promise<string> {
  const response = await fetch(`${GMAIL_API_URL}/users/me/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user email');
  }

  const data = await response.json();
  return data.emailAddress;
}

export async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string
): Promise<{ id: string; threadId: string }> {
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ];

  const email = emailLines.join('\r\n');
  const encodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const requestBody: Record<string, string> = {
    raw: encodedEmail,
  };

  if (threadId) {
    requestBody.threadId = threadId;
  }

  const response = await fetch(`${GMAIL_API_URL}/users/me/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to send email');
  }

  return response.json();
}

export async function getGmailMessages(
  accessToken: string,
  query: string,
  maxResults = 20
): Promise<Array<{ id: string; threadId: string }>> {
  const params = new URLSearchParams({
    q: query,
    maxResults: maxResults.toString(),
  });

  const response = await fetch(`${GMAIL_API_URL}/users/me/messages?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }

  const data = await response.json();
  return data.messages || [];
}

export async function getGmailMessage(
  accessToken: string,
  messageId: string
): Promise<{
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType: string; body?: { data?: string } }>;
  };
  internalDate: string;
}> {
  const response = await fetch(`${GMAIL_API_URL}/users/me/messages/${messageId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch message');
  }

  return response.json();
}

export function parseGmailHeaders(
  headers: Array<{ name: string; value: string }>
): {
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
} {
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  return {
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    messageId: getHeader('Message-ID'),
    inReplyTo: getHeader('In-Reply-To') || undefined,
    references: getHeader('References') || undefined,
  };
}

export function extractEmailAddress(emailString: string): string {
  const match = emailString.match(/<([^>]+)>/);
  if (match) {
    return match[1].toLowerCase();
  }
  return emailString.trim().toLowerCase();
}

export function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

export function extractEmailBody(payload: {
  body?: { data?: string };
  parts?: Array<{ mimeType: string; body?: { data?: string } }>;
}): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    const textPart = payload.parts.find(
      (p) => p.mimeType === 'text/plain' || p.mimeType === 'text/html'
    );
    if (textPart?.body?.data) {
      return decodeBase64Url(textPart.body.data);
    }
  }

  return '';
}

export async function getGmailToken(
  orgId: string,
  userId: string
): Promise<GmailOAuthToken | null> {
  const { data, error } = await supabase
    .from('gmail_oauth_tokens')
    .select('*')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as GmailOAuthToken | null;
}

export async function saveGmailToken(
  orgId: string,
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  email: string
): Promise<void> {
  const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error } = await supabase
    .from('gmail_oauth_tokens')
    .upsert({
      organization_id: orgId,
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expiry: tokenExpiry,
      email,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id,user_id',
    });

  if (error) throw error;
}

export async function deleteGmailToken(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('gmail_oauth_tokens')
    .delete()
    .eq('organization_id', orgId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getConnectedGmailAccounts(orgId: string): Promise<GmailOAuthToken[]> {
  const { data, error } = await supabase
    .from('gmail_oauth_tokens')
    .select(`
      *,
      user:users!user_id (
        id, name, email
      )
    `)
    .eq('organization_id', orgId);

  if (error) throw error;
  return data as GmailOAuthToken[];
}
