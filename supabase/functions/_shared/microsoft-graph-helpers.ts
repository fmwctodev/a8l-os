/**
 * Microsoft Graph API helpers — mirrors google-oauth-helpers.ts pattern.
 * Provides token management, Graph API requests, and token refresh for
 * all Microsoft 365 services (Outlook, Calendar, OneDrive, Teams).
 */

import { type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { encryptToken, decryptToken, isEncryptedToken } from "./crypto.ts";

export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export const ALL_MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
  "Calendars.ReadWrite",
  "Files.ReadWrite.All",
  "Chat.ReadWrite",
  "OnlineMeetings.ReadWrite",
];

export const OUTLOOK_MAIL_SCOPES = ["Mail.ReadWrite", "Mail.Send"];
export const OUTLOOK_CALENDAR_SCOPES = ["Calendars.ReadWrite"];
export const ONEDRIVE_SCOPES = ["Files.ReadWrite.All"];
export const TEAMS_SCOPES = ["Chat.ReadWrite", "OnlineMeetings.ReadWrite"];

export function hasOutlookMailScopes(scopes: string[]): boolean {
  return OUTLOOK_MAIL_SCOPES.every((s) => scopes.includes(s));
}

export function hasCalendarScopes(scopes: string[]): boolean {
  return OUTLOOK_CALENDAR_SCOPES.every((s) => scopes.includes(s));
}

export function hasOneDriveScopes(scopes: string[]): boolean {
  return ONEDRIVE_SCOPES.every((s) => scopes.includes(s));
}

export function hasTeamsScopes(scopes: string[]): boolean {
  return TEAMS_SCOPES.every((s) => scopes.includes(s));
}

/**
 * Get Microsoft token URL for the configured tenant.
 */
function getTokenUrl(): string {
  const tenantId = Deno.env.get("MICROSOFT_TENANT_ID") || "common";
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

/**
 * Refresh a Microsoft access token using the refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}> {
  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
  const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(getTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Microsoft token refresh failed (${response.status}): ${err}`);
  }

  return await response.json();
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}> {
  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
  const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(getTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Microsoft token exchange failed (${response.status}): ${err}`);
  }

  return await response.json();
}

/**
 * Get a valid access token for a user, refreshing if needed.
 * Mirrors the Google pattern: check master table → decrypt → refresh if expired.
 */
export async function getAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<{ accessToken: string; email: string }> {
  const { data: master, error } = await supabase
    .from("microsoft_oauth_master")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !master) {
    throw new Error("No Microsoft connection found for this user");
  }

  if (!master.encrypted_access_token || !master.encrypted_refresh_token) {
    throw new Error("Microsoft tokens are missing");
  }

  // Decrypt tokens
  let accessToken: string;
  let refreshTokenPlain: string;

  try {
    accessToken = isEncryptedToken(master.encrypted_access_token)
      ? await decryptToken(master.encrypted_access_token)
      : master.encrypted_access_token;
    refreshTokenPlain = isEncryptedToken(master.encrypted_refresh_token)
      ? await decryptToken(master.encrypted_refresh_token)
      : master.encrypted_refresh_token;
  } catch (err) {
    throw new Error(`Failed to decrypt Microsoft tokens: ${err}`);
  }

  // Check if token is expired (refresh 5 minutes before expiry)
  const expiresAt = master.token_expires_at
    ? new Date(master.token_expires_at).getTime()
    : 0;
  const fiveMinFromNow = Date.now() + 5 * 60 * 1000;

  if (expiresAt < fiveMinFromNow) {
    // Refresh the token
    try {
      const refreshed = await refreshAccessToken(refreshTokenPlain);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(
        Date.now() + refreshed.expires_in * 1000
      ).toISOString();

      // Encrypt and store
      const encAccess = await encryptToken(refreshed.access_token);
      const encRefresh = refreshed.refresh_token
        ? await encryptToken(refreshed.refresh_token)
        : master.encrypted_refresh_token;

      await supabase
        .from("microsoft_oauth_master")
        .update({
          encrypted_access_token: encAccess,
          encrypted_refresh_token: encRefresh,
          token_expires_at: newExpiry,
          granted_scopes: refreshed.scope
            ? refreshed.scope.split(" ")
            : master.granted_scopes,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } catch (refreshErr) {
      console.error("[microsoft-graph] Token refresh failed:", refreshErr);
      // Try with old token anyway — it might still work
    }
  }

  return { accessToken, email: master.email || "" };
}

/**
 * Make a Microsoft Graph API request with automatic token handling.
 */
export async function graphRequest(
  accessToken: string,
  path: string,
  method: string = "GET",
  body?: Record<string, unknown> | string
): Promise<{ status: number; data: unknown }> {
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const init: RequestInit = { method, headers };
  if (body && method !== "GET") {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const responseData = await response.json().catch(() => ({}));
  return { status: response.status, data: responseData };
}

/**
 * Write or update the Microsoft OAuth master token record.
 */
export async function writeMasterToken(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  email: string,
  accessToken: string,
  refreshToken: string,
  tokenExpiry: string,
  scopes: string[]
): Promise<void> {
  let encAccess: string;
  let encRefresh: string;

  try {
    encAccess = await encryptToken(accessToken);
    encRefresh = await encryptToken(refreshToken);
  } catch {
    // Fallback: store as-is (not recommended for production)
    encAccess = accessToken;
    encRefresh = refreshToken;
  }

  const tenantId = Deno.env.get("MICROSOFT_TENANT_ID") || null;

  const { error } = await supabase
    .from("microsoft_oauth_master")
    .upsert(
      {
        user_id: userId,
        org_id: orgId,
        email,
        encrypted_access_token: encAccess,
        encrypted_refresh_token: encRefresh,
        token_expires_at: tokenExpiry,
        granted_scopes: scopes,
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[microsoft-graph] writeMasterToken error:", error);
    throw error;
  }
}

/**
 * Build a MIME email message for Microsoft Graph's sendMail endpoint.
 * Graph accepts a JSON body, not raw MIME, so this is simpler than Gmail.
 */
export function buildGraphEmailPayload(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  htmlBody: string;
  inReplyTo?: string;
}): Record<string, unknown> {
  const toRecipients = params.to
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ emailAddress: { address: email } }));

  const ccRecipients = params.cc
    ? params.cc
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
        .map((email) => ({ emailAddress: { address: email } }))
    : [];

  const bccRecipients = params.bcc
    ? params.bcc
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
        .map((email) => ({ emailAddress: { address: email } }))
    : [];

  const message: Record<string, unknown> = {
    subject: params.subject,
    body: {
      contentType: "HTML",
      content: params.htmlBody,
    },
    toRecipients,
    ccRecipients,
    bccRecipients,
  };

  if (params.inReplyTo) {
    message.conversationId = params.inReplyTo;
  }

  return { message, saveToSentItems: true };
}

/**
 * Get user's Outlook email signature from mailbox settings.
 */
export async function getOutlookSignature(
  accessToken: string
): Promise<string> {
  try {
    const { status, data } = await graphRequest(
      accessToken,
      "/me/mailboxSettings",
      "GET"
    );
    if (status !== 200) return "";
    const settings = data as { automaticRepliesSetting?: unknown; signatureHtml?: string };
    // Graph returns signature in automaticRepliesSetting or directly
    // The actual field path depends on the API version
    return (data as Record<string, unknown>)?.signatureHtml as string ?? "";
  } catch {
    return "";
  }
}

/**
 * Determine which workspace provider a user is connected to.
 * Returns 'microsoft' | 'google' | null.
 */
export async function detectUserProvider(
  supabase: SupabaseClient,
  userId: string
): Promise<"microsoft" | "google" | null> {
  // Check Microsoft first (if the migration is happening, prefer Microsoft)
  const { data: msToken } = await supabase
    .from("microsoft_oauth_master")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (msToken) return "microsoft";

  // Check Google
  const { data: googleToken } = await supabase
    .from("google_oauth_master")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (googleToken) return "google";

  return null;
}
