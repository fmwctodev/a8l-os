import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptToken, decryptToken, isEncryptedToken } from "../_shared/crypto.ts";
import {
  ALL_GOOGLE_SCOPES,
  writeMasterToken,
  crossPopulateServiceTables,
  hasGmailScopes,
  hasCalendarScopes,
  hasDriveScopes,
} from "../_shared/google-oauth-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("[UnifiedOAuth] No Authorization header");
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error) {
    console.error("[UnifiedOAuth] JWT validation failed:", error.message);
    return null;
  }
  if (!user) {
    console.error("[UnifiedOAuth] No user found in JWT");
    return null;
  }
  console.log("[UnifiedOAuth] Authenticated user:", user.id);
  return user;
}

async function getUserDetails(userId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("users")
    .select("id, organization_id, name, email")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

async function handleStart(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const userDetails = await getUserDetails(user.id);
  if (!userDetails) return jsonResponse({ error: "User not found" }, 404);

  if (!GOOGLE_CLIENT_ID) {
    return jsonResponse({ error: "Google integration not configured" }, 500);
  }

  const url = new URL(req.url);
  const appOrigin = url.searchParams.get("app_origin") || "";

  const callbackUri = `${SUPABASE_URL}/functions/v1/google-oauth-unified/callback`;

  const state = btoa(JSON.stringify({
    userId: user.id,
    orgId: userDetails.organization_id,
    redirectUri: callbackUri,
    appOrigin,
  }));

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", callbackUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", ALL_GOOGLE_SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  return jsonResponse({ authUrl: authUrl.toString() });
}

async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    let stateForError: { appOrigin?: string } = {};
    try { if (stateParam) stateForError = JSON.parse(atob(stateParam)); } catch {}
    if (stateForError.appOrigin) {
      const errorRedirect = new URL(`${stateForError.appOrigin}/oauth/google-calendar/callback`);
      errorRedirect.searchParams.set("status", "error");
      errorRedirect.searchParams.set("error", error);
      return Response.redirect(errorRedirect.toString(), 302);
    }
    return new Response(`<html><body><p>Authentication failed: ${error}. You can close this window.</p></body></html>`, {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code || !stateParam) {
    return new Response("Missing code or state", { status: 400, headers: corsHeaders });
  }

  let state: { userId: string; orgId: string; redirectUri: string; appOrigin?: string };
  try {
    state = JSON.parse(atob(stateParam));
  } catch {
    return new Response("Invalid state", { status: 400, headers: corsHeaders });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: state.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    console.error("Token exchange failed:", tokenData);
    if (state.appOrigin) {
      const errorRedirect = new URL(`${state.appOrigin}/oauth/google-calendar/callback`);
      errorRedirect.searchParams.set("status", "error");
      errorRedirect.searchParams.set("error", "Token exchange failed");
      return Response.redirect(errorRedirect.toString(), 302);
    }
    return new Response(`<html><body><p>Authentication failed. You can close this window.</p></body></html>`, {
      headers: { "Content-Type": "text/html" },
    });
  }

  const { access_token, refresh_token, expires_in, scope: grantedScopeStr } = tokenData;

  if (!refresh_token) {
    const msg = "No refresh token received. Please revoke access and try again.";
    if (state.appOrigin) {
      const errorRedirect = new URL(`${state.appOrigin}/oauth/google-calendar/callback`);
      errorRedirect.searchParams.set("status", "error");
      errorRedirect.searchParams.set("error", msg);
      return Response.redirect(errorRedirect.toString(), 302);
    }
    return new Response(`<html><body><p>${msg}</p></body></html>`, { headers: { "Content-Type": "text/html" } });
  }

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const userInfo = await userInfoResponse.json();
  const email = userInfo.email || "";

  const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString();
  const grantedScopes = grantedScopeStr ? grantedScopeStr.split(" ").filter(Boolean) : ALL_GOOGLE_SCOPES;

  const supabase = getServiceClient();

  await writeMasterToken(supabase, state.orgId, state.userId, email, access_token, refresh_token, tokenExpiry, grantedScopes);

  await crossPopulateServiceTables(supabase, state.orgId, state.userId, email, access_token, refresh_token, tokenExpiry, grantedScopes);

  if (hasGmailScopes(grantedScopes)) {
    const pubsubTopic = Deno.env.get("GMAIL_PUBSUB_TOPIC");
    if (pubsubTopic) {
      try {
        const watchResponse = await fetch(`${GMAIL_API_URL}/users/me/watch`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topicName: pubsubTopic,
            labelIds: ["INBOX", "SENT"],
            labelFilterBehavior: "include",
          }),
        });

        let watchHistoryId: string | null = null;
        let watchExpiration: string | null = null;
        if (watchResponse.ok) {
          const watchData = await watchResponse.json();
          watchHistoryId = String(watchData.historyId);
          watchExpiration = new Date(Number(watchData.expiration)).toISOString();
        }

        await supabase.from("gmail_sync_state").upsert(
          {
            organization_id: state.orgId,
            user_id: state.userId,
            history_id: watchHistoryId,
            watch_expiration: watchExpiration,
            sync_status: "idle",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,user_id" }
        );
      } catch (watchErr) {
        console.error("Gmail watch error:", watchErr);
      }
    }

    await supabase.from("gmail_sync_jobs").insert({
      organization_id: state.orgId,
      user_id: state.userId,
      job_type: "initial",
      status: "queued",
      run_at: new Date().toISOString(),
    });

    try {
      await fetch(`${SUPABASE_URL}/functions/v1/gmail-sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ org_id: state.orgId, user_id: state.userId }),
      });
    } catch {}
  }

  if (hasCalendarScopes(grantedScopes)) {
    const { data: calConn } = await supabase
      .from("google_calendar_connections")
      .select("id")
      .eq("user_id", state.userId)
      .maybeSingle();

    if (calConn?.id) {
      const { data: existingJob } = await supabase
        .from("google_calendar_sync_jobs")
        .select("id")
        .eq("connection_id", calConn.id)
        .in("status", ["queued", "running"])
        .maybeSingle();

      if (!existingJob) {
        await supabase.from("google_calendar_sync_jobs").insert({
          org_id: state.orgId,
          connection_id: calConn.id,
          user_id: state.userId,
          job_type: "initial_sync",
          status: "queued",
          scheduled_at: new Date().toISOString(),
          attempt: 0,
          max_attempts: 5,
        });
      }
    }
  }

  await supabase.from("audit_logs").insert({
    user_id: state.userId,
    action: "google_unified_connected",
    entity_type: "google_oauth_master",
    after_state: { email, scopes: grantedScopes, organization_id: state.orgId },
  });

  if (state.appOrigin) {
    const successRedirect = new URL(`${state.appOrigin}/oauth/google-calendar/callback`);
    successRedirect.searchParams.set("status", "success");
    successRedirect.searchParams.set("email", email);
    return Response.redirect(successRedirect.toString(), 302);
  }

  return new Response(`<html><body><p>Connected successfully! You can close this window.</p></body></html>`, {
    headers: { "Content-Type": "text/html" },
  });
}

async function handleConnection(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabase = getServiceClient();
  const { data: master } = await supabase
    .from("google_oauth_master")
    .select("id, email, granted_scopes, token_expiry, created_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!master) {
    const { data: calConn } = await supabase
      .from("google_calendar_connections")
      .select("email, scopes, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: gmailToken } = await supabase
      .from("gmail_oauth_tokens")
      .select("email, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: driveConn } = await supabase
      .from("drive_connections")
      .select("email, scopes, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const hasAny = !!(calConn || gmailToken || driveConn);

    return jsonResponse({
      connected: hasAny,
      legacy: hasAny,
      email: calConn?.email || gmailToken?.email || driveConn?.email || null,
      gmail: !!gmailToken,
      calendar: !!calConn,
      drive: !!driveConn,
      scopes: [],
    });
  }

  const scopes = master.granted_scopes || [];

  return jsonResponse({
    connected: true,
    legacy: false,
    email: master.email,
    gmail: hasGmailScopes(scopes),
    calendar: hasCalendarScopes(scopes),
    drive: hasDriveScopes(scopes),
    scopes,
    connectedAt: master.created_at,
    tokenExpired: new Date(master.token_expiry) <= new Date(),
  });
}

async function handleDisconnect(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabase = getServiceClient();

  const { data: master } = await supabase
    .from("google_oauth_master")
    .select("encrypted_access_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (master?.encrypted_access_token) {
    try {
      const at = isEncryptedToken(master.encrypted_access_token)
        ? await decryptToken(master.encrypted_access_token)
        : master.encrypted_access_token;
      await fetch(`https://oauth2.googleapis.com/revoke?token=${at}`, { method: "POST" }).catch(() => {});
    } catch {}
  }

  await supabase.from("google_oauth_master").delete().eq("user_id", user.id);

  await supabase.from("gmail_oauth_tokens").delete().eq("user_id", user.id);
  await supabase.from("gmail_sync_state").delete().eq("user_id", user.id);
  await supabase.from("gmail_sync_jobs").delete().eq("user_id", user.id);

  const { data: calConn } = await supabase
    .from("google_calendar_connections")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (calConn?.id) {
    await supabase.from("google_calendar_sync_jobs").delete().eq("connection_id", calConn.id);
    await supabase.from("calendar_event_map").delete().eq("connection_id", calConn.id);
    await supabase.from("calendar_sync_logs").delete().eq("connection_id", calConn.id);
    await supabase.from("google_calendar_events").delete().eq("connection_id", calConn.id);
    await supabase.from("google_calendar_list").delete().eq("connection_id", calConn.id);
  }
  await supabase.from("google_calendar_connections").delete().eq("user_id", user.id);

  await supabase.from("drive_connections").delete().eq("user_id", user.id);

  await supabase
    .from("users")
    .update({
      gmail_connected: false,
      google_drive_connected: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  await supabase
    .from("user_connected_accounts")
    .delete()
    .eq("user_id", user.id)
    .in("provider", ["google_gmail", "google_drive", "google_calendar"]);

  return jsonResponse({ success: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/google-oauth-unified", "");

    if (path === "/start" && req.method === "POST") {
      return await handleStart(req);
    }
    if (path === "/callback" && req.method === "GET") {
      return await handleCallback(req);
    }
    if (path === "/connection" && req.method === "GET") {
      return await handleConnection(req);
    }
    if (path === "/disconnect" && req.method === "POST") {
      return await handleDisconnect(req);
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    console.error("google-oauth-unified error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
