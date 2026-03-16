const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const EDGE_URL = `${SUPABASE_URL}/functions/v1/portal-auth`;
const SESSION_KEY_PREFIX = 'portal_session_';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Apikey': SUPABASE_ANON_KEY,
};

async function callPortalAuth(body: Record<string, unknown>): Promise<Response> {
  return fetch(EDGE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

export function getStoredSession(portalToken: string): { token: string; expiresAt: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY_PREFIX + portalToken);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token: string; expiresAt: string };
    if (new Date(parsed.expiresAt) < new Date()) {
      localStorage.removeItem(SESSION_KEY_PREFIX + portalToken);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeSession(portalToken: string, token: string, expiresAt: string): void {
  localStorage.setItem(SESSION_KEY_PREFIX + portalToken, JSON.stringify({ token, expiresAt }));
}

export function clearSession(portalToken: string): void {
  localStorage.removeItem(SESSION_KEY_PREFIX + portalToken);
}

export interface PortalTokenInfo {
  valid: boolean;
  reason?: 'invalid' | 'expired' | 'revoked';
  portalId?: string;
  contactId?: string;
  maskedEmail?: string;
  contactName?: string;
  projectName?: string;
  orgName?: string;
  supportEmail?: string | null;
  hasEmail?: boolean;
}

export async function validatePortalToken(portalToken: string): Promise<PortalTokenInfo> {
  const res = await callPortalAuth({ action: 'validate-token', portalToken });
  return res.json();
}

export interface SendCodeResult {
  success: boolean;
  maskedEmail?: string;
  expiresAt?: string;
  rateLimited?: boolean;
  error?: string;
}

export async function sendVerificationCode(portalId: string): Promise<SendCodeResult> {
  const res = await callPortalAuth({ action: 'send-code', portalId });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error, rateLimited: data.rateLimited };
  return data;
}

export interface VerifyCodeResult {
  success: boolean;
  sessionToken?: string;
  sessionId?: string;
  expiresAt?: string;
  rememberDevice?: boolean;
  error?: string;
  attemptsRemaining?: number;
  maxAttemptsExceeded?: boolean;
  expired?: boolean;
}

export async function verifyCode(portalId: string, code: string, rememberDevice: boolean): Promise<VerifyCodeResult> {
  const res = await callPortalAuth({ action: 'verify-code', portalId, code, rememberDevice });
  return res.json();
}

export interface ValidateSessionResult {
  valid: boolean;
  reason?: string;
  sessionId?: string;
  contactId?: string;
  lastOtpVerifiedAt?: string;
  expiresAt?: string;
}

export async function validateSession(portalId: string, sessionToken: string): Promise<ValidateSessionResult> {
  const res = await callPortalAuth({ action: 'validate-session', portalId, sessionToken });
  return res.json();
}

export async function logoutSession(portalId: string, sessionToken: string): Promise<void> {
  await callPortalAuth({ action: 'logout', portalId, sessionToken });
}

export async function revokeSession(sessionId: string, portalId: string): Promise<void> {
  await callPortalAuth({ action: 'revoke-session', sessionId, portalId });
}

export async function revokeAllSessions(portalId: string): Promise<{ revokedCount: number }> {
  const res = await callPortalAuth({ action: 'revoke-all-sessions', portalId });
  return res.json();
}

export interface PortalSession {
  id: string;
  device_label: string | null;
  ip_address: string | null;
  remember_device: boolean;
  expires_at: string;
  revoked_at: string | null;
  last_accessed_at: string | null;
  created_at: string;
}

export async function listSessions(portalId: string): Promise<PortalSession[]> {
  const res = await callPortalAuth({ action: 'list-sessions', portalId });
  const data = await res.json();
  return data.sessions || [];
}

export async function markStepUpVerified(portalId: string, sessionToken: string): Promise<void> {
  await callPortalAuth({ action: 'step-up-verified', portalId, sessionToken });
}

export function requiresStepUp(lastOtpVerifiedAt: string | null | undefined): boolean {
  if (!lastOtpVerifiedAt) return true;
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  return new Date(lastOtpVerifiedAt).getTime() < tenMinutesAgo;
}
