import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function getAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("[OAuth] No Authorization header");
    return null;
  }

  const token = authHeader.replace("Bearer ", "");

  // Use anon client for JWT validation (this is the key fix!)
  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(token);

  if (error) {
    console.error("[OAuth] JWT validation failed:", error.message);
    return null;
  }

  if (!user) {
    console.error("[OAuth] No user found in JWT");
    return null;
  }

  console.log("[OAuth] JWT validated successfully for user:", user.id);
  return user;
}

async function getUserDetails(userId: string) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("users")
    .select("id, organization_id, name, email")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

async function handleGetAuthUrl(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userDetails = await getUserDetails(user.id);
  if (!userDetails) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const redirectUri = url.searchParams.get("redirect_uri") ||
    `${url.origin}/google-calendar-oauth/callback`;

  const appOrigin = url.searchParams.get("app_origin") || "";

  const state = btoa(JSON.stringify({
    userId: user.id,
    orgId: userDetails.organization_id,
    redirectUri,
    appOrigin,
  }));

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    return new Response(`
      <html><body><p>Authentication failed: ${error}. You can close this window.</p></body></html>
    `, { headers: { ...corsHeaders, "Content-Type": "text/html" } });
  }

  if (!code || !stateParam) {
    return new Response("Missing code or state", {
      status: 400,
      headers: corsHeaders,
    });
  }

  let state: { userId: string; orgId: string; redirectUri: string; appOrigin?: string };
  try {
    state = JSON.parse(atob(stateParam));
  } catch {
    return new Response("Invalid state", {
      status: 400,
      headers: corsHeaders,
    });
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
    if (state.appOrigin) {
      const errorRedirect = new URL(`${state.appOrigin}/oauth/google-calendar/callback`);
      errorRedirect.searchParams.set("status", "error");
      errorRedirect.searchParams.set("error", "Token exchange failed");
      return Response.redirect(errorRedirect.toString(), 302);
    }
    return new Response(`
      <html><body><p>Authentication failed. You can close this window.</p></body></html>
    `, { headers: { ...corsHeaders, "Content-Type": "text/html" } });
  }

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userInfo = await userInfoResponse.json();

  const supabase = getSupabaseClient();
  const tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const { error: upsertError } = await supabase
    .from("google_calendar_connections")
    .upsert({
      org_id: state.orgId,
      user_id: state.userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expiry: tokenExpiry,
      email: userInfo.email,
      selected_calendar_ids: ["primary"],
    }, {
      onConflict: "org_id,user_id",
    });

  if (upsertError) {
    if (state.appOrigin) {
      const errorRedirect = new URL(`${state.appOrigin}/oauth/google-calendar/callback`);
      errorRedirect.searchParams.set("status", "error");
      errorRedirect.searchParams.set("error", "Failed to save connection");
      return Response.redirect(errorRedirect.toString(), 302);
    }
    return new Response(`
      <html><body><p>Failed to save connection. You can close this window.</p></body></html>
    `, { headers: { ...corsHeaders, "Content-Type": "text/html" } });
  }

  if (state.appOrigin) {
    const successRedirect = new URL(`${state.appOrigin}/oauth/google-calendar/callback`);
    successRedirect.searchParams.set("status", "success");
    successRedirect.searchParams.set("email", userInfo.email || "");
    return Response.redirect(successRedirect.toString(), 302);
  }

  return new Response(`
    <html><body><p>Connected successfully! You can close this window.</p></body></html>
  `, { headers: { ...corsHeaders, "Content-Type": "text/html" } });
}

async function handleDisconnect(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseClient();

  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connection?.access_token) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${connection.access_token}`, {
      method: "POST",
    }).catch(() => {});
  }

  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to disconnect" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetCalendars(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseClient();
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return new Response(JSON.stringify({ error: "Not connected" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let accessToken = connection.access_token;
  if (new Date(connection.token_expiry) <= new Date()) {
    const refreshResult = await refreshToken(connection.refresh_token);
    if (!refreshResult.success) {
      return new Response(JSON.stringify({ error: "Token refresh failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    accessToken = refreshResult.accessToken;

    await supabase
      .from("google_calendar_connections")
      .update({
        access_token: refreshResult.accessToken,
        token_expiry: refreshResult.tokenExpiry,
      })
      .eq("id", connection.id);
  }

  const calendarListResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!calendarListResponse.ok) {
    return new Response(JSON.stringify({ error: "Failed to fetch calendars" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const calendarList = await calendarListResponse.json();
  const calendars = calendarList.items?.map((cal: { id: string; summary: string; primary?: boolean; accessRole: string }) => ({
    id: cal.id,
    name: cal.summary,
    primary: cal.primary || false,
    accessRole: cal.accessRole,
  })) || [];

  const primaryCal = calendars.find((c: { primary: boolean }) => c.primary);
  const primaryEmail = primaryCal?.id || connection.email;
  const normalizedSelected = (connection.selected_calendar_ids || []).map(
    (id: string) => id === "primary" && primaryEmail ? primaryEmail : id
  ).filter((id: string, idx: number, arr: string[]) => arr.indexOf(id) === idx);

  return new Response(JSON.stringify({
    calendars,
    selectedCalendarIds: normalizedSelected,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleUpdateSelectedCalendars(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { calendarIds } = body;

  if (!Array.isArray(calendarIds)) {
    return new Response(JSON.stringify({ error: "Invalid calendar IDs" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseClient();

  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("email")
    .eq("user_id", user.id)
    .maybeSingle();

  const connEmail = connection?.email?.toLowerCase();
  const hasPrimary = calendarIds.includes("primary");
  const hasEmail = connEmail && calendarIds.some((id: string) => id.toLowerCase() === connEmail);
  const deduped = hasPrimary && hasEmail
    ? calendarIds.filter((id: string) => id !== "primary")
    : calendarIds;

  const { error } = await supabase
    .from("google_calendar_connections")
    .update({ selected_calendar_ids: deduped })
    .eq("user_id", user.id);

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to update" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleTestSync(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseClient();
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return new Response(JSON.stringify({ error: "Not connected" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let accessToken = connection.access_token;
  if (new Date(connection.token_expiry) <= new Date()) {
    const refreshResult = await refreshToken(connection.refresh_token);
    if (!refreshResult.success) {
      return new Response(JSON.stringify({ error: "Token refresh failed", tokenExpired: true }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    accessToken = refreshResult.accessToken;

    await supabase
      .from("google_calendar_connections")
      .update({
        access_token: refreshResult.accessToken,
        token_expiry: refreshResult.tokenExpiry,
      })
      .eq("id", connection.id);
  }

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const freeBusyResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: now.toISOString(),
        timeMax: weekFromNow.toISOString(),
        items: connection.selected_calendar_ids.map((id: string) => ({ id })),
      }),
    }
  );

  if (!freeBusyResponse.ok) {
    return new Response(JSON.stringify({
      success: false,
      error: "Failed to fetch busy times"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const freeBusyData = await freeBusyResponse.json();
  let totalBusyBlocks = 0;

  if (freeBusyData.calendars) {
    for (const calId of Object.keys(freeBusyData.calendars)) {
      totalBusyBlocks += freeBusyData.calendars[calId].busy?.length || 0;
    }
  }

  return new Response(JSON.stringify({
    success: true,
    busyBlockCount: totalBusyBlocks,
    message: `Found ${totalBusyBlocks} busy blocks in the next 7 days`
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetConnection(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseClient();
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("id, email, selected_calendar_ids, token_expiry, created_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return new Response(JSON.stringify({ connected: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tokenExpired = new Date(connection.token_expiry) <= new Date();

  return new Response(JSON.stringify({
    connected: true,
    email: connection.email,
    selectedCalendarIds: connection.selected_calendar_ids,
    tokenExpired,
    connectedAt: connection.created_at,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetTeamConnections(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userDetails = await getUserDetails(user.id);
  if (!userDetails) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseClient();

  const { data: users } = await supabase
    .from("users")
    .select(`
      id, name, email,
      google_connection:google_calendar_connections(id, email, created_at)
    `)
    .eq("organization_id", userDetails.organization_id)
    .eq("status", "active")
    .order("name");

  const connections = users?.map((u) => ({
    userId: u.id,
    userName: u.name,
    userEmail: u.email,
    connected: !!u.google_connection,
    googleEmail: u.google_connection?.email || null,
    connectedAt: u.google_connection?.created_at || null,
  })) || [];

  return new Response(JSON.stringify({ connections }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refreshToken(refreshTokenValue: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshTokenValue,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    return { success: false as const };
  }

  const data = await response.json();
  return {
    success: true as const,
    accessToken: data.access_token,
    tokenExpiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/google-calendar-oauth", "");

    if (path === "/auth-url" && req.method === "GET") {
      return await handleGetAuthUrl(req);
    }
    if (path === "/callback" && req.method === "GET") {
      return await handleCallback(req);
    }
    if (path === "/disconnect" && req.method === "POST") {
      return await handleDisconnect(req);
    }
    if (path === "/calendars" && req.method === "GET") {
      return await handleGetCalendars(req);
    }
    if (path === "/calendars" && req.method === "POST") {
      return await handleUpdateSelectedCalendars(req);
    }
    if (path === "/test-sync" && req.method === "POST") {
      return await handleTestSync(req);
    }
    if (path === "/connection" && req.method === "GET") {
      return await handleGetConnection(req);
    }
    if (path === "/team-connections" && req.method === "GET") {
      return await handleGetTeamConnections(req);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
