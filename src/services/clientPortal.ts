/**
 * Client Portal service — thin wrapper around the `client-portal-auth`
 * edge function + localStorage session management.
 */

import { fetchEdge } from '../lib/edgeFunction';

const SLUG = 'client-portal-auth';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Types ───────────────────────────────────────────────────────

export interface SendCodeResult {
  success: boolean;
  maskedEmail?: string;
  expiresAt?: string;
  rateLimited?: boolean;
  error?: string;
}

export interface VerifyCodeResult {
  success: boolean;
  sessionToken?: string;
  sessionId?: string;
  expiresAt?: string;
  attemptsRemaining?: number;
  maxAttemptsExceeded?: boolean;
  error?: string;
}

export interface ValidateSessionResult {
  valid: boolean;
  sessionId?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  orgId?: string;
  orgName?: string;
  supportEmail?: string;
  lastOtpVerifiedAt?: string;
  expiresAt?: string;
}

export interface ClientPortalProject {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  target_end_date: string | null;
  progress_percent: number;
  budget_amount: number;
  currency: string;
  stage_id: string;
  pipeline_id: string;
  contact_id: string;
  created_at: string;
  stage?: { id: string; name: string; sort_order: number; color: string | null };
}

export interface ClientPortalProjectDetail extends ClientPortalProject {
  pipeline?: { id: string; name: string };
  contact?: { id: string; first_name: string; last_name: string; email: string };
  orgName?: string;
  supportEmail?: string;
}

export interface PortalSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  rememberDevice: boolean;
  deviceLabel: string;
  isCurrent: boolean;
}

// ─── API calls ───────────────────────────────────────────────────

/** Call the portal-auth edge function with the anon key (no Supabase session needed). */
async function callPortalAuth(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${SLUG}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  return await res.json();
}

export async function sendLoginCode(
  email: string,
  inviteToken?: string
): Promise<SendCodeResult> {
  const result = await callPortalAuth({
    action: 'send-code',
    email,
    inviteToken,
  });
  return result as unknown as SendCodeResult;
}

export async function verifyLoginCode(
  email: string,
  code: string,
  rememberDevice: boolean,
  inviteToken?: string
): Promise<VerifyCodeResult> {
  const result = await callPortalAuth({
    action: 'verify-code',
    email,
    code,
    rememberDevice,
    inviteToken,
  });
  return result as unknown as VerifyCodeResult;
}

export async function validateSession(
  sessionToken: string
): Promise<ValidateSessionResult> {
  const result = await callPortalAuth({
    action: 'validate-session',
    sessionToken,
  });
  return result as unknown as ValidateSessionResult;
}

export async function fetchMyProjects(
  sessionToken: string
): Promise<ClientPortalProject[]> {
  const result = await callPortalAuth({
    action: 'fetch-projects',
    sessionToken,
  });
  return (result as { projects?: ClientPortalProject[] }).projects ?? [];
}

export async function fetchProject(
  sessionToken: string,
  projectId: string
): Promise<ClientPortalProjectDetail | null> {
  const result = await callPortalAuth({
    action: 'fetch-project',
    sessionToken,
    projectId,
  });
  if (!(result as { success?: boolean }).success) return null;
  const data = result as {
    project: ClientPortalProjectDetail;
    orgName: string;
    supportEmail: string;
  };
  return { ...data.project, orgName: data.orgName, supportEmail: data.supportEmail };
}

export async function markStepUpVerified(sessionToken: string): Promise<void> {
  await callPortalAuth({ action: 'mark-step-up-verified', sessionToken });
}

export async function listSessions(sessionToken: string): Promise<PortalSession[]> {
  const result = await callPortalAuth({ action: 'list-sessions', sessionToken });
  return (result as { sessions?: PortalSession[] }).sessions ?? [];
}

export async function logoutSession(sessionToken: string): Promise<void> {
  await callPortalAuth({ action: 'logout', sessionToken });
}

export async function sendPortalInvite(
  projectId: string
): Promise<{ success: boolean; skippedReason?: string }> {
  const result = await fetchEdge(SLUG, {
    body: { action: 'send-invite', projectId },
    method: 'POST',
  });
  return await result.json();
}

// ─── localStorage helpers ────────────────────────────────────────

const SESSION_KEY = 'client_portal_session_token';
const ORG_KEY = 'client_portal_org_id';

export function getStoredSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function storeSession(token: string): void {
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {}
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ORG_KEY);
  } catch {}
}

export function getStoredOrgId(): string | null {
  try {
    return localStorage.getItem(ORG_KEY);
  } catch {
    return null;
  }
}

export function storeOrgId(orgId: string): void {
  try {
    localStorage.setItem(ORG_KEY, orgId);
  } catch {}
}
