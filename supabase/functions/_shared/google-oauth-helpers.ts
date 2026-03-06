import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { encryptToken, decryptToken, isEncryptedToken } from "./crypto.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const ALL_GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
];

export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
];

export function hasGmailScopes(scopes: string[]): boolean {
  return GMAIL_SCOPES.every((s) => scopes.includes(s));
}

export function hasCalendarScopes(scopes: string[]): boolean {
  return CALENDAR_SCOPES.every((s) => scopes.includes(s));
}

export function hasDriveScopes(scopes: string[]): boolean {
  return DRIVE_SCOPES.every((s) => scopes.includes(s));
}

export function mergeScopes(existing: string[], incoming: string[]): string[] {
  const set = new Set([...existing, ...incoming]);
  return Array.from(set);
}

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
    encAccess = accessToken;
    encRefresh = refreshToken;
  }

  const { data: existing } = await supabase
    .from("google_oauth_master")
    .select("id, granted_scopes")
    .eq("user_id", userId)
    .maybeSingle();

  const mergedScopes = existing
    ? mergeScopes(existing.granted_scopes || [], scopes)
    : scopes;

  await supabase.from("google_oauth_master").upsert(
    {
      org_id: orgId,
      user_id: userId,
      email,
      encrypted_access_token: encAccess,
      encrypted_refresh_token: encRefresh,
      token_expiry: tokenExpiry,
      granted_scopes: mergedScopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function crossPopulateServiceTables(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  email: string,
  accessToken: string,
  refreshToken: string,
  tokenExpiry: string,
  grantedScopes: string[]
): Promise<void> {
  const now = new Date().toISOString();

  if (hasGmailScopes(grantedScopes)) {
    let encAccess: string;
    let encRefresh: string;
    try {
      encAccess = await encryptToken(accessToken);
      encRefresh = await encryptToken(refreshToken);
    } catch {
      encAccess = accessToken;
      encRefresh = refreshToken;
    }

    await supabase.from("gmail_oauth_tokens").upsert(
      {
        organization_id: orgId,
        user_id: userId,
        access_token: encAccess,
        refresh_token: encRefresh,
        token_expiry: tokenExpiry,
        email,
        updated_at: now,
      },
      { onConflict: "organization_id,user_id" }
    );

    await supabase
      .from("users")
      .update({ gmail_connected: true, updated_at: now })
      .eq("id", userId);

    await supabase.from("user_connected_accounts").upsert(
      {
        user_id: userId,
        provider: "google_gmail",
        provider_account_id: email,
        provider_account_email: email,
        scopes: GMAIL_SCOPES.map((s) => s.split("/").pop()!),
        connected_at: now,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,provider" }
    );
  }

  if (hasCalendarScopes(grantedScopes)) {
    const { data: existingCal } = await supabase
      .from("google_calendar_connections")
      .select("id, selected_calendar_ids")
      .eq("user_id", userId)
      .maybeSingle();

    let encCalAccess: string;
    let encCalRefresh: string;
    try {
      encCalAccess = await encryptToken(accessToken);
      encCalRefresh = await encryptToken(refreshToken);
    } catch {
      encCalAccess = accessToken;
      encCalRefresh = refreshToken;
    }

    await supabase.from("google_calendar_connections").upsert(
      {
        org_id: orgId,
        user_id: userId,
        access_token: encCalAccess,
        refresh_token: encCalRefresh,
        token_expiry: tokenExpiry,
        email,
        selected_calendar_ids: existingCal?.selected_calendar_ids || ["primary"],
        sync_enabled: true,
        scopes: grantedScopes
          .filter((s) => s.includes("calendar") || s.includes("userinfo"))
          .join(" "),
        updated_at: now,
      },
      { onConflict: "org_id,user_id" }
    );
  }

  if (hasDriveScopes(grantedScopes)) {
    let encDriveAccess: string;
    let encDriveRefresh: string;
    try {
      encDriveAccess = await encryptToken(accessToken);
      encDriveRefresh = await encryptToken(refreshToken);
    } catch {
      encDriveAccess = accessToken;
      encDriveRefresh = refreshToken;
    }

    await supabase.from("drive_connections").upsert(
      {
        user_id: userId,
        organization_id: orgId,
        connected_by: userId,
        email,
        access_token_encrypted: encDriveAccess,
        refresh_token_encrypted: encDriveRefresh,
        token_expiry: tokenExpiry,
        scopes: DRIVE_SCOPES.concat([
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
        ]),
        is_active: true,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

    await supabase
      .from("users")
      .update({ google_drive_connected: true, updated_at: now })
      .eq("id", userId);
  }
}

export async function resolveRefreshToken(
  supabase: SupabaseClient,
  userId: string,
  _orgId: string
): Promise<{ refreshToken: string; source: string } | null> {
  const { data: master } = await supabase
    .from("google_oauth_master")
    .select("encrypted_refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (master?.encrypted_refresh_token) {
    try {
      const rt = isEncryptedToken(master.encrypted_refresh_token)
        ? await decryptToken(master.encrypted_refresh_token)
        : master.encrypted_refresh_token;
      return { refreshToken: rt, source: "master" };
    } catch {
      console.warn("Failed to decrypt master refresh token");
    }
  }

  const { data: calConn } = await supabase
    .from("google_calendar_connections")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (calConn?.refresh_token) {
    try {
      const rt = isEncryptedToken(calConn.refresh_token)
        ? await decryptToken(calConn.refresh_token)
        : calConn.refresh_token;
      return { refreshToken: rt, source: "calendar" };
    } catch {
      console.warn("Failed to decrypt calendar refresh token");
    }
  }

  const { data: driveConn } = await supabase
    .from("drive_connections")
    .select("refresh_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();

  if (driveConn?.refresh_token_encrypted) {
    try {
      const rt = isEncryptedToken(driveConn.refresh_token_encrypted)
        ? await decryptToken(driveConn.refresh_token_encrypted)
        : driveConn.refresh_token_encrypted;
      return { refreshToken: rt, source: "drive" };
    } catch {
      console.warn("Failed to decrypt drive refresh token");
    }
  }

  const { data: gmailToken } = await supabase
    .from("gmail_oauth_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (gmailToken?.refresh_token) {
    try {
      const rt = isEncryptedToken(gmailToken.refresh_token)
        ? await decryptToken(gmailToken.refresh_token)
        : gmailToken.refresh_token;
      return { refreshToken: rt, source: "gmail" };
    } catch {
      console.warn("Failed to decrypt gmail refresh token");
    }
  }

  return null;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
} | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return null;
  return await res.json();
}
