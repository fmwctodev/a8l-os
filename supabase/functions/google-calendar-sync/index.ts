import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

interface UserContext {
  id: string;
  email: string;
  orgId: string;
  roleId: string;
  roleName: string;
  departmentId: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return null;
}

function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message, details },
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

function successResponse<T>(data: T): Response {
  return jsonResponse({ success: true, data });
}

class AuthError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}

function getAnonClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function extractUserContext(
  req: Request,
  supabase: SupabaseClient
): Promise<UserContext | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("[Auth] No Authorization header");
    return null;
  }

  const token = authHeader.replace("Bearer ", "");

  const anonClient = getAnonClient();
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser(token);

  if (authError) {
    console.error("[Auth] JWT validation failed:", authError.message);
    return null;
  }

  if (!user) {
    console.error("[Auth] No user found in JWT");
    return null;
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, email, organization_id, role_id, department_id, role:roles(name)")
    .eq("id", user.id)
    .maybeSingle();

  if (userError || !userData) {
    console.error("[Auth] Failed to fetch user:", userError?.message || "not found");
    return null;
  }

  const roleName = (userData.role as { name: string } | null)?.name || "Unknown";
  const rolePermissions = new Set<string>();

  const [rpResult, overridesResult] = await Promise.all([
    userData.role_id
      ? supabase
          .from("role_permissions")
          .select("permission:permissions(key)")
          .eq("role_id", userData.role_id)
      : Promise.resolve({ data: null }),
    supabase
      .from("user_permission_overrides")
      .select("granted, permission:permissions(key)")
      .eq("user_id", userData.id),
  ]);

  if (rpResult.data) {
    for (const rp of rpResult.data) {
      const key = (rp.permission as { key: string } | null)?.key;
      if (key) rolePermissions.add(key);
    }
  }

  if (overridesResult.data) {
    for (const o of overridesResult.data) {
      const key = (o.permission as { key: string } | null)?.key;
      if (key) {
        if (o.granted) rolePermissions.add(key);
        else rolePermissions.delete(key);
      }
    }
  }

  return {
    id: userData.id,
    email: userData.email,
    orgId: userData.organization_id,
    roleId: userData.role_id,
    roleName,
    departmentId: userData.department_id,
    isSuperAdmin: roleName === "SuperAdmin",
    permissions: Array.from(rolePermissions),
  };
}

function requireAuth(userContext: UserContext | null): UserContext {
  if (!userContext) {
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  }
  return userContext;
}

class ValidationError extends Error {
  code: string;
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.code = "VALIDATION_ERROR";
    this.field = field;
    this.name = "ValidationError";
  }
}

class PermissionError extends Error {
  code: string;
  requiredPermissions: string[];
  constructor(message: string, requiredPermissions: string[] = []) {
    super(message);
    this.code = "PERMISSION_DENIED";
    this.requiredPermissions = requiredPermissions;
    this.name = "PermissionError";
  }
}

function handleError(error: unknown): Response {
  console.error("Edge Function error:", error);
  if (error instanceof AuthError) {
    return errorResponse(error.code, error.message, 401);
  }
  if (error instanceof PermissionError) {
    return errorResponse(error.code, error.message, 403, {
      requiredPermissions: error.requiredPermissions,
    });
  }
  if (error instanceof ValidationError) {
    return errorResponse(
      error.code,
      error.message,
      400,
      error.field ? { field: error.field } : undefined
    );
  }
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  return errorResponse("INTERNAL_ERROR", message, 500);
}

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CONFLICT_WINDOW_MS = 5000;

interface GoogleEvent {
  id: string;
  iCalUID?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  recurrence?: string[];
  recurringEventId?: string;
  status?: string;
  organizer?: { email?: string; displayName?: string };
  creator?: { email?: string };
  attendees?: { email?: string; displayName?: string; responseStatus?: string; self?: boolean }[];
  eventType?: string;
  visibility?: string;
  transparency?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: Record<string, unknown>;
  reminders?: Record<string, unknown>;
  source?: Record<string, unknown>;
  attachments?: Record<string, unknown>[];
  updated?: string;
  etag?: string;
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> };
}

interface Connection {
  id: string;
  org_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  email: string;
  selected_calendar_ids: string[];
  sync_enabled?: boolean;
  sync_lookback_days?: number;
}

type Supabase = ReturnType<typeof getSupabaseClient>;

async function syncLog(
  supabase: Supabase,
  orgId: string | null,
  connectionId: string | null,
  calendarId: string | null,
  level: string,
  message: string,
  meta?: Record<string, unknown>
) {
  try {
    await supabase.from("calendar_sync_logs").insert({
      org_id: orgId,
      connection_id: connectionId,
      calendar_id: calendarId,
      level,
      message,
      meta: meta || null,
    });
  } catch (e) {
    console.error("[SyncLog] Failed to write log:", e);
  }
}

async function refreshToken(refreshTokenStr: string): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshTokenStr,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Token refresh failed: ${errText}`);
  }

  return resp.json();
}

async function getValidToken(connection: Connection, supabase: Supabase): Promise<string> {
  const expiry = new Date(connection.token_expiry);
  const now = new Date();

  if (expiry.getTime() - now.getTime() > 60 * 1000) {
    return connection.access_token;
  }

  const result = await refreshToken(connection.refresh_token);
  const newExpiry = new Date(Date.now() + result.expires_in * 1000).toISOString();

  const updateData: Record<string, unknown> = {
    access_token: result.access_token,
    token_expiry: newExpiry,
  };
  if (result.refresh_token) {
    updateData.refresh_token = result.refresh_token;
  }

  await supabase
    .from("google_calendar_connections")
    .update(updateData)
    .eq("id", connection.id);

  connection.access_token = result.access_token;
  connection.token_expiry = newExpiry;

  return result.access_token;
}

function parseEventTime(timeObj?: { dateTime?: string; date?: string; timeZone?: string }): {
  time: string;
  allDay: boolean;
  timezone: string;
} {
  if (!timeObj) return { time: new Date().toISOString(), allDay: false, timezone: "UTC" };

  if (timeObj.date) {
    return {
      time: new Date(timeObj.date + "T00:00:00Z").toISOString(),
      allDay: true,
      timezone: timeObj.timeZone || "UTC",
    };
  }

  return {
    time: new Date(timeObj.dateTime!).toISOString(),
    allDay: false,
    timezone: timeObj.timeZone || "UTC",
  };
}

function throwGoogleApiError(status: number, body: string, operation: string): never {
  if (status === 403 || status === 401) {
    const lower = body.toLowerCase();
    if (lower.includes("insufficientpermissions") || lower.includes("forbidden") || lower.includes("accessdenied")) {
      throw new ValidationError(
        "Insufficient Google Calendar permissions. Please reconnect your Google Calendar with write access."
      );
    }
    if (lower.includes("invalid_grant") || lower.includes("token")) {
      throw new ValidationError(
        "Google Calendar authorization expired. Please reconnect your Google Calendar."
      );
    }
  }
  if (status === 404 || status === 410) {
    throw new ValidationError(`Google Calendar event not found. It may have been deleted externally.`);
  }
  throw new Error(`Failed to ${operation} Google event (${status}): ${body}`);
}

function buildExtendedProps(orgId: string, userId: string, appointmentId: string) {
  return {
    private: {
      autom8ion_workspace_id: orgId,
      autom8ion_user_id: userId,
      autom8ion_appointment_id: appointmentId,
    },
  };
}

function getSelectedCalendarIds(connection: Connection): string[] {
  const rawCalendarIds: string[] = connection.selected_calendar_ids || ["primary"];
  const connectionEmail = connection.email?.toLowerCase();
  return connectionEmail &&
    rawCalendarIds.includes("primary") &&
    rawCalendarIds.some((id: string) => id.toLowerCase() === connectionEmail)
    ? rawCalendarIds.filter((id: string) => id !== "primary")
    : rawCalendarIds;
}

async function getUserConnection(supabase: Supabase, userId: string, orgId: string): Promise<Connection | null> {
  const { data } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  return data;
}

async function ensureCalendarListEntry(
  supabase: Supabase,
  connection: Connection,
  calendarId: string,
  calListMap: Map<string, string>,
  orgId: string,
  userId: string
): Promise<string | null> {
  let calendarListId = calListMap.get(calendarId);
  if (calendarListId) return calendarListId;

  const { data: newEntry, error: listErr } = await supabase
    .from("google_calendar_list")
    .upsert(
      {
        org_id: orgId,
        connection_id: connection.id,
        user_id: userId,
        google_calendar_id: calendarId,
        summary: calendarId === "primary" ? "Primary Calendar" : calendarId,
        access_role: "owner",
        selected: true,
      },
      { onConflict: "connection_id,google_calendar_id" }
    )
    .select("id")
    .maybeSingle();

  if (listErr || !newEntry?.id) return null;
  calListMap.set(calendarId, newEntry.id);
  return newEntry.id;
}

async function fetchGoogleEventsWithSyncToken(
  accessToken: string,
  calendarId: string,
  syncToken: string
): Promise<{ events: GoogleEvent[]; nextSyncToken: string | null; fullSyncRequired: boolean }> {
  const allEvents: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("syncToken", syncToken);
    url.searchParams.set("maxResults", "250");
    url.searchParams.set("showDeleted", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (resp.status === 410) {
      return { events: [], nextSyncToken: null, fullSyncRequired: true };
    }

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Google Calendar API error (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    allEvents.push(...(data.items || []));
    pageToken = data.nextPageToken;
    nextSyncToken = data.nextSyncToken || null;
  } while (pageToken);

  return { events: allEvents, nextSyncToken, fullSyncRequired: false };
}

async function fetchGoogleEventsFull(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<{ events: GoogleEvent[]; nextSyncToken: string | null }> {
  const allEvents: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("maxResults", "250");
    url.searchParams.set("showDeleted", "true");
    url.searchParams.set("orderBy", "startTime");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Google Calendar API error (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    allEvents.push(...(data.items || []));
    pageToken = data.nextPageToken;
    nextSyncToken = data.nextSyncToken || null;
  } while (pageToken);

  return { events: allEvents, nextSyncToken };
}

function mapGoogleEventToRow(
  evt: GoogleEvent,
  orgId: string,
  connectionId: string,
  userId: string,
  calendarListId: string,
  calendarId: string
) {
  const start = parseEventTime(evt.start);
  const end = parseEventTime(evt.end);

  return {
    org_id: orgId,
    connection_id: connectionId,
    user_id: userId,
    calendar_list_id: calendarListId,
    google_calendar_id: calendarId,
    google_event_id: evt.id,
    ical_uid: evt.iCalUID || null,
    summary: evt.summary || null,
    description: evt.description || null,
    location: evt.location || null,
    start_time: start.time,
    end_time: end.time,
    all_day: start.allDay,
    timezone: start.timezone,
    recurrence: evt.recurrence || null,
    recurring_event_id: evt.recurringEventId || null,
    status: evt.status || "confirmed",
    organizer_email: evt.organizer?.email || null,
    organizer_display_name: evt.organizer?.displayName || null,
    creator_email: evt.creator?.email || null,
    attendees: evt.attendees || null,
    event_type: evt.eventType || null,
    visibility: evt.visibility || null,
    transparency: evt.transparency || null,
    html_link: evt.htmlLink || null,
    hangout_link: evt.hangoutLink || null,
    conference_data: evt.conferenceData || null,
    reminders: evt.reminders || null,
    source: evt.source || null,
    attachments: evt.attachments || null,
    last_modified: evt.updated ? new Date(evt.updated).toISOString() : null,
    etag: evt.etag || null,
    extended_properties: evt.extendedProperties || null,
    sync_direction: "from_google",
    updated_at: new Date().toISOString(),
  };
}

async function upsertEventMapEntry(
  supabase: Supabase,
  orgId: string,
  connectionId: string,
  userId: string,
  calendarId: string,
  evt: GoogleEvent,
  appointmentId: string | null,
  direction: string
) {
  const now = new Date().toISOString();
  await supabase.from("calendar_event_map").upsert(
    {
      org_id: orgId,
      connection_id: connectionId,
      user_id: userId,
      appointment_id: appointmentId,
      calendar_id: calendarId,
      google_event_id: evt.id,
      ical_uid: evt.iCalUID || null,
      etag: evt.etag || null,
      extended_properties: evt.extendedProperties || null,
      last_google_updated_at: evt.updated ? new Date(evt.updated).toISOString() : now,
      last_crm_updated_at: appointmentId ? now : null,
      sync_direction: direction,
      sync_status: "synced",
      is_deleted: evt.status === "cancelled",
      updated_at: now,
    },
    { onConflict: "connection_id,google_event_id" }
  );
}

function getCrmAppointmentIdFromEvent(evt: GoogleEvent): string | null {
  return evt.extendedProperties?.private?.autom8ion_appointment_id || null;
}

async function createCrmAppointmentFromGoogleEvent(
  supabase: Supabase,
  orgId: string,
  userId: string,
  calendarId: string,
  evt: GoogleEvent
): Promise<string | null> {
  const start = parseEventTime(evt.start);
  const end = parseEventTime(evt.end);

  const { data: defaultCalendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();

  if (!defaultCalendar) return null;

  const { data: defaultType } = await supabase
    .from("appointment_types")
    .select("id")
    .eq("calendar_id", defaultCalendar.id)
    .limit(1)
    .maybeSingle();

  if (!defaultType) return null;

  const { data: apt, error } = await supabase
    .from("appointments")
    .insert({
      org_id: orgId,
      calendar_id: defaultCalendar.id,
      appointment_type_id: defaultType.id,
      assigned_user_id: userId,
      status: "scheduled",
      start_at_utc: start.time,
      end_at_utc: end.time,
      visitor_timezone: start.timezone,
      answers: {},
      source: "manual",
      google_event_id: evt.id,
      google_meet_link: evt.hangoutLink || null,
      notes: evt.summary || null,
      location: evt.location || null,
      reschedule_token: crypto.randomUUID(),
      cancel_token: crypto.randomUUID(),
      history: [
        {
          action: "created_from_google",
          timestamp: new Date().toISOString(),
          google_event_id: evt.id,
          summary: evt.summary,
        },
      ],
    })
    .select("id")
    .maybeSingle();

  if (error || !apt) {
    console.error("[Sync] Failed to create CRM appointment from Google event:", error);
    return null;
  }

  return apt.id;
}

async function processIncrementalEvent(
  supabase: Supabase,
  connection: Connection,
  calendarId: string,
  calendarListId: string,
  evt: GoogleEvent,
  stats: { created: number; updated: number; deleted: number; skipped: number }
) {
  const orgId = connection.org_id;
  const userId = connection.user_id;
  const connectionId = connection.id;

  const { data: existingMap } = await supabase
    .from("calendar_event_map")
    .select("*")
    .eq("connection_id", connectionId)
    .eq("google_event_id", evt.id)
    .maybeSingle();

  if (evt.status === "cancelled") {
    if (existingMap?.appointment_id) {
      await supabase
        .from("appointments")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMap.appointment_id);
    }

    if (existingMap) {
      await supabase
        .from("calendar_event_map")
        .update({ is_deleted: true, sync_status: "synced", updated_at: new Date().toISOString() })
        .eq("id", existingMap.id);
    }

    await supabase
      .from("google_calendar_events")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("connection_id", connectionId)
      .eq("google_event_id", evt.id);

    stats.deleted++;
    return;
  }

  const row = mapGoogleEventToRow(evt, orgId, connectionId, userId, calendarListId, calendarId);
  await supabase
    .from("google_calendar_events")
    .upsert(row, { onConflict: "connection_id,google_calendar_id,google_event_id" });

  const crmAptId = getCrmAppointmentIdFromEvent(evt);

  if (existingMap) {
    const googleUpdated = evt.updated ? new Date(evt.updated).getTime() : Date.now();
    const crmUpdated = existingMap.last_crm_updated_at
      ? new Date(existingMap.last_crm_updated_at).getTime()
      : 0;

    const googleWins =
      !existingMap.last_crm_updated_at ||
      googleUpdated > crmUpdated ||
      Math.abs(googleUpdated - crmUpdated) < CONFLICT_WINDOW_MS;

    if (googleWins && existingMap.appointment_id) {
      const start = parseEventTime(evt.start);
      const end = parseEventTime(evt.end);

      await supabase
        .from("appointments")
        .update({
          start_at_utc: start.time,
          end_at_utc: end.time,
          notes: evt.summary || null,
          location: evt.location || null,
          visitor_timezone: start.timezone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMap.appointment_id);
    }

    await supabase.from("calendar_event_map").update({
      etag: evt.etag || null,
      last_google_updated_at: evt.updated ? new Date(evt.updated).toISOString() : new Date().toISOString(),
      sync_status: "synced",
      is_deleted: false,
      updated_at: new Date().toISOString(),
    }).eq("id", existingMap.id);

    stats.updated++;
  } else {
    let appointmentId = crmAptId;

    if (crmAptId) {
      const { data: apt } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", crmAptId)
        .maybeSingle();
      if (!apt) appointmentId = null;
    }

    if (!appointmentId) {
      appointmentId = await createCrmAppointmentFromGoogleEvent(supabase, orgId, userId, calendarId, evt);
    }

    await upsertEventMapEntry(
      supabase, orgId, connectionId, userId, calendarId, evt,
      appointmentId, appointmentId ? "bidirectional" : "from_google"
    );

    stats.created++;
  }
}

async function processBatchEvents(
  supabase: Supabase,
  connection: Connection,
  calendarId: string,
  calendarListId: string,
  events: GoogleEvent[],
  orgId: string,
  userId: string
): Promise<{ created: number; updated: number; deleted: number; skipped: number }> {
  const stats = { created: 0, updated: 0, deleted: 0, skipped: 0 };
  if (events.length === 0) return stats;

  const connectionId = connection.id;
  const now = new Date().toISOString();

  const eventIds = events.map((e) => e.id).filter(Boolean);
  const { data: existingMaps } = await supabase
    .from("calendar_event_map")
    .select("*")
    .eq("connection_id", connectionId)
    .in("google_event_id", eventIds);

  const mapByEventId = new Map<string, Record<string, unknown>>();
  (existingMaps || []).forEach((m: Record<string, unknown>) =>
    mapByEventId.set(m.google_event_id as string, m)
  );

  const { data: defaultCalendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();

  let defaultTypeId: string | null = null;
  if (defaultCalendar) {
    const { data: dt } = await supabase
      .from("appointment_types")
      .select("id")
      .eq("calendar_id", defaultCalendar.id)
      .limit(1)
      .maybeSingle();
    defaultTypeId = dt?.id || null;
  }

  const upsertRows = events
    .filter((evt) => evt.status !== "cancelled")
    .map((evt) =>
      mapGoogleEventToRow(evt, orgId, connectionId, userId, calendarListId, calendarId)
    );

  if (upsertRows.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < upsertRows.length; i += CHUNK) {
      await supabase
        .from("google_calendar_events")
        .upsert(upsertRows.slice(i, i + CHUNK), {
          onConflict: "connection_id,google_calendar_id,google_event_id",
        });
    }
  }

  const cancelledEvents = events.filter((e) => e.status === "cancelled");
  const cancelledIds = cancelledEvents.map((e) => e.id).filter(Boolean);
  if (cancelledIds.length > 0) {
    await supabase
      .from("google_calendar_events")
      .update({ status: "cancelled", updated_at: now })
      .eq("connection_id", connectionId)
      .in("google_event_id", cancelledIds);
  }

  for (const evt of cancelledEvents) {
    const existing = mapByEventId.get(evt.id);
    if (existing?.appointment_id) {
      await supabase
        .from("appointments")
        .update({ status: "canceled", canceled_at: now, updated_at: now })
        .eq("id", existing.appointment_id);
    }
    if (existing) {
      await supabase
        .from("calendar_event_map")
        .update({ is_deleted: true, sync_status: "synced", updated_at: now })
        .eq("id", existing.id as string);
    }
    stats.deleted++;
  }

  for (const evt of events.filter((e) => e.status !== "cancelled")) {
    const existing = mapByEventId.get(evt.id);
    const crmAptId = getCrmAppointmentIdFromEvent(evt);

    if (existing) {
      const googleUpdated = evt.updated
        ? new Date(evt.updated).getTime()
        : Date.now();
      const crmUpdated = existing.last_crm_updated_at
        ? new Date(existing.last_crm_updated_at as string).getTime()
        : 0;
      const googleWins =
        !existing.last_crm_updated_at ||
        googleUpdated > crmUpdated ||
        Math.abs(googleUpdated - crmUpdated) < CONFLICT_WINDOW_MS;

      if (googleWins && existing.appointment_id) {
        const start = parseEventTime(evt.start);
        const end = parseEventTime(evt.end);
        await supabase
          .from("appointments")
          .update({
            start_at_utc: start.time,
            end_at_utc: end.time,
            notes: evt.summary || null,
            location: evt.location || null,
            visitor_timezone: start.timezone,
            updated_at: now,
          })
          .eq("id", existing.appointment_id);
      }

      await supabase
        .from("calendar_event_map")
        .update({
          etag: evt.etag || null,
          last_google_updated_at: evt.updated
            ? new Date(evt.updated).toISOString()
            : now,
          sync_status: "synced",
          is_deleted: false,
          updated_at: now,
        })
        .eq("id", existing.id as string);

      stats.updated++;
    } else {
      let appointmentId = crmAptId;
      if (crmAptId) {
        const { data: apt } = await supabase
          .from("appointments")
          .select("id")
          .eq("id", crmAptId)
          .maybeSingle();
        if (!apt) appointmentId = null;
      }

      if (!appointmentId && defaultCalendar && defaultTypeId) {
        const start = parseEventTime(evt.start);
        const end = parseEventTime(evt.end);
        const { data: apt } = await supabase
          .from("appointments")
          .insert({
            org_id: orgId,
            calendar_id: defaultCalendar.id,
            appointment_type_id: defaultTypeId,
            assigned_user_id: userId,
            status: "scheduled",
            start_at_utc: start.time,
            end_at_utc: end.time,
            visitor_timezone: start.timezone,
            answers: {},
            source: "manual",
            google_event_id: evt.id,
            google_meet_link: evt.hangoutLink || null,
            notes: evt.summary || null,
            location: evt.location || null,
            reschedule_token: crypto.randomUUID(),
            cancel_token: crypto.randomUUID(),
            history: [
              {
                action: "created_from_google",
                timestamp: now,
                google_event_id: evt.id,
                summary: evt.summary,
              },
            ],
          })
          .select("id")
          .maybeSingle();
        appointmentId = apt?.id || null;
      }

      await upsertEventMapEntry(
        supabase,
        orgId,
        connectionId,
        userId,
        calendarId,
        evt,
        appointmentId,
        appointmentId ? "bidirectional" : "from_google"
      );

      stats.created++;
    }
  }

  return stats;
}

async function handleSync(req: Request): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const connection = await getUserConnection(supabase, userCtx.id, userCtx.orgId);
  if (!connection) throw new ValidationError("No Google Calendar connection found");

  const accessToken = await getValidToken(connection, supabase);
  const selectedCalendarIds = getSelectedCalendarIds(connection);
  const lookbackDays = connection.sync_lookback_days || 60;
  const timeMin = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  let totalSynced = 0;
  const errors: string[] = [];

  const { data: calendarListRecords } = await supabase
    .from("google_calendar_list")
    .select("id, google_calendar_id, sync_token")
    .eq("connection_id", connection.id);

  const calListMap = new Map<string, string>();
  const syncTokenMap = new Map<string, string>();
  (calendarListRecords || []).forEach((r: { id: string; google_calendar_id: string; sync_token?: string }) => {
    calListMap.set(r.google_calendar_id, r.id);
    if (r.sync_token) syncTokenMap.set(r.google_calendar_id, r.sync_token);
  });

  for (const calendarId of selectedCalendarIds) {
    try {
      const calendarListId = await ensureCalendarListEntry(
        supabase, connection, calendarId, calListMap, userCtx.orgId, userCtx.id
      );
      if (!calendarListId) {
        errors.push(`Failed to ensure calendar list entry for ${calendarId}`);
        continue;
      }

      const existingSyncToken = syncTokenMap.get(calendarId);
      let events: GoogleEvent[];
      let nextSyncToken: string | null = null;

      if (existingSyncToken) {
        const result = await fetchGoogleEventsWithSyncToken(accessToken, calendarId, existingSyncToken);
        if (result.fullSyncRequired) {
          await syncLog(supabase, userCtx.orgId, connection.id, calendarId, "warn",
            "Sync token expired (410), falling back to full sync");
          const fullResult = await fetchGoogleEventsFull(accessToken, calendarId, timeMin, timeMax);
          events = fullResult.events;
          nextSyncToken = fullResult.nextSyncToken;
        } else {
          events = result.events;
          nextSyncToken = result.nextSyncToken;
        }
      } else {
        const fullResult = await fetchGoogleEventsFull(accessToken, calendarId, timeMin, timeMax);
        events = fullResult.events;
        nextSyncToken = fullResult.nextSyncToken;
      }

      const stats = await processBatchEvents(
        supabase, connection, calendarId, calendarListId, events, userCtx.orgId, userCtx.id
      );
      totalSynced += events.length;

      if (nextSyncToken) {
        await supabase
          .from("google_calendar_list")
          .update({ sync_token: nextSyncToken, last_synced_at: new Date().toISOString() })
          .eq("id", calendarListId);
      }

      await syncLog(supabase, userCtx.orgId, connection.id, calendarId, "info",
        `Sync completed: ${stats.created} created, ${stats.updated} updated, ${stats.deleted} deleted`,
        { stats, eventCount: events.length });

    } catch (calErr) {
      const errMsg = (calErr as Error).message || String(calErr);
      errors.push(`Calendar ${calendarId}: ${errMsg}`);
      await syncLog(supabase, userCtx.orgId, connection.id, calendarId, "error", `Sync failed: ${errMsg}`);
    }
  }

  await supabase
    .from("google_calendar_connections")
    .update({
      last_full_sync_at: new Date().toISOString(),
      last_incremental_sync_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return successResponse({ synced: totalSynced, errors: errors.length > 0 ? errors : undefined });
}

async function handleSyncIncremental(req: Request): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const connection = await getUserConnection(supabase, userCtx.id, userCtx.orgId);
  if (!connection) throw new ValidationError("No Google Calendar connection found");

  const accessToken = await getValidToken(connection, supabase);
  const selectedCalendarIds = getSelectedCalendarIds(connection);

  const { data: calendarListRecords } = await supabase
    .from("google_calendar_list")
    .select("id, google_calendar_id, sync_token")
    .eq("connection_id", connection.id)
    .eq("selected", true);

  const calListMap = new Map<string, string>();
  const syncTokenMap = new Map<string, string>();
  (calendarListRecords || []).forEach((r: { id: string; google_calendar_id: string; sync_token?: string }) => {
    calListMap.set(r.google_calendar_id, r.id);
    if (r.sync_token) syncTokenMap.set(r.google_calendar_id, r.sync_token);
  });

  let totalProcessed = 0;
  const errors: string[] = [];

  for (const calendarId of selectedCalendarIds) {
    const syncToken = syncTokenMap.get(calendarId);

    let calendarListId = calListMap.get(calendarId);
    if (!calendarListId) {
      calendarListId = await ensureCalendarListEntry(
        supabase, connection, calendarId, calListMap, userCtx.orgId, userCtx.id
      ) || undefined;
      if (!calendarListId) continue;
    }

    try {
      if (!syncToken) {
        await syncLog(supabase, userCtx.orgId, connection.id, calendarId, "info",
          "No sync token, performing limited initial sync");

        const timeMin = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const fullResult = await fetchGoogleEventsFull(accessToken, calendarId, timeMin, timeMax);

        const stats = await processBatchEvents(
          supabase, connection, calendarId, calendarListId, fullResult.events, userCtx.orgId, userCtx.id
        );

        if (fullResult.nextSyncToken) {
          await supabase.from("google_calendar_list")
            .update({ sync_token: fullResult.nextSyncToken, last_synced_at: new Date().toISOString() })
            .eq("id", calendarListId);
        }

        totalProcessed += fullResult.events.length;
        await syncLog(supabase, userCtx.orgId, connection.id, calendarId, "info",
          `Initial sync: ${stats.created} created, ${stats.updated} updated, ${stats.deleted} deleted`,
          { stats, eventCount: fullResult.events.length });
        continue;
      }

      const result = await fetchGoogleEventsWithSyncToken(accessToken, calendarId, syncToken);

      if (result.fullSyncRequired) {
        await syncLog(supabase, userCtx.orgId, connection.id, calendarId, "warn",
          "Sync token invalidated (410), falling back to limited sync");

        const timeMin = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const fullResult = await fetchGoogleEventsFull(accessToken, calendarId, timeMin, timeMax);

        const stats = await processBatchEvents(
          supabase, connection, calendarId, calendarListId, fullResult.events, userCtx.orgId, userCtx.id
        );

        if (fullResult.nextSyncToken) {
          await supabase.from("google_calendar_list")
            .update({ sync_token: fullResult.nextSyncToken, last_synced_at: new Date().toISOString() })
            .eq("id", calendarListId);
        }

        totalProcessed += fullResult.events.length;
        continue;
      }

      const stats = await processBatchEvents(
        supabase, connection, calendarId, calendarListId, result.events, userCtx.orgId, userCtx.id
      );

      if (result.nextSyncToken) {
        await supabase.from("google_calendar_list")
          .update({ sync_token: result.nextSyncToken, last_synced_at: new Date().toISOString() })
          .eq("id", calendarListId);
      }

      totalProcessed += result.events.length;

      await syncLog(supabase, userCtx.orgId, connection.id, calendarId, "info",
        `Incremental sync: ${stats.created} created, ${stats.updated} updated, ${stats.deleted} deleted`,
        { stats, eventCount: result.events.length });

    } catch (calErr) {
      const errMsg = (calErr as Error).message || String(calErr);
      errors.push(`Calendar ${calendarId}: ${errMsg}`);
      await syncLog(supabase, userCtx.orgId, connection.id, calendarId, "error",
        `Incremental sync failed: ${errMsg}`);
    }
  }

  await supabase
    .from("google_calendar_connections")
    .update({ last_incremental_sync_at: new Date().toISOString() })
    .eq("id", connection.id);

  return successResponse({ processed: totalProcessed, errors: errors.length > 0 ? errors : undefined });
}

async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventData: Record<string, unknown>,
  generateMeet = false
): Promise<GoogleEvent> {
  const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
  if (generateMeet) {
    url.searchParams.set("conferenceDataVersion", "1");
    eventData.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventData),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throwGoogleApiError(resp.status, errText, "create");
  }

  return resp.json();
}

async function updateGoogleCalendarEventById(
  accessToken: string,
  calendarId: string,
  eventId: string,
  updates: Record<string, unknown>
): Promise<GoogleEvent> {
  const resp = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throwGoogleApiError(resp.status, errText, "update");
  }

  return resp.json();
}

async function deleteGoogleCalendarEventById(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const resp = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
    const errText = await resp.text();
    throw new Error(`Failed to delete Google event: ${errText}`);
  }
}

async function handleSyncAppointment(req: Request, body: Record<string, unknown>): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const { appointmentId, operation } = body as { appointmentId?: string; operation?: string };
  if (!appointmentId) throw new ValidationError("appointmentId is required");

  const op = operation || "create";

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, appointment_type:appointment_types(*), contact:contacts(first_name, last_name, email)")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) throw new ValidationError("Appointment not found");

  const targetUserId = appointment.assigned_user_id || userCtx.id;
  const { data: targetUser } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", targetUserId)
    .maybeSingle();

  const targetOrgId = targetUser?.organization_id || userCtx.orgId;
  const connection = await getUserConnection(supabase, targetUserId, targetOrgId);
  if (!connection) {
    return successResponse({ synced: false, reason: "no_connection" });
  }

  const accessToken = await getValidToken(connection, supabase);
  const calendarId = "primary";

  const { data: existingSync } = await supabase
    .from("appointment_sync")
    .select("*")
    .eq("appointment_id", appointmentId)
    .eq("provider", "google")
    .maybeSingle();

  const { data: existingMap } = await supabase
    .from("calendar_event_map")
    .select("*")
    .eq("connection_id", connection.id)
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  const existingGoogleEventId = existingSync?.external_event_id || existingMap?.google_event_id;

  const appointmentType = appointment.appointment_type;
  const contact = appointment.contact;
  const summary = `${appointmentType?.name || "Appointment"} - ${contact?.first_name || "Guest"} ${contact?.last_name || ""}`.trim();

  if (op === "delete" || appointment.status === "canceled") {
    if (existingGoogleEventId) {
      await deleteGoogleCalendarEventById(accessToken, calendarId, existingGoogleEventId);
      if (existingSync) {
        await supabase.from("appointment_sync")
          .update({ sync_status: "synced", last_error: null, updated_at: new Date().toISOString() })
          .eq("id", existingSync.id);
      }
      if (existingMap) {
        await supabase.from("calendar_event_map")
          .update({ is_deleted: true, sync_status: "synced", updated_at: new Date().toISOString() })
          .eq("id", existingMap.id);
      }
      await supabase.from("google_calendar_events")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("connection_id", connection.id)
        .eq("google_event_id", existingGoogleEventId);
    }
    return successResponse({ synced: true, operation: "deleted" });
  }

  const generateMeet = appointmentType?.generate_google_meet && appointmentType?.location_type === "google_meet";

  const eventPayload: Record<string, unknown> = {
    summary,
    description: `Booked via CRM\n${appointment.notes || ""}`.trim(),
    start: { dateTime: appointment.start_at_utc, timeZone: "UTC" },
    end: { dateTime: appointment.end_at_utc, timeZone: "UTC" },
    attendees: contact?.email ? [{ email: contact.email }] : undefined,
    extendedProperties: buildExtendedProps(targetOrgId, targetUserId, appointmentId),
  };

  if (appointment.location || appointmentType?.location_value?.address) {
    eventPayload.location = appointment.location || appointmentType?.location_value?.address;
  }

  if (existingGoogleEventId && (op === "update" || op === "reschedule")) {
    const updatedEvent = await updateGoogleCalendarEventById(accessToken, calendarId, existingGoogleEventId, eventPayload);
    const now = new Date().toISOString();

    if (existingSync) {
      await supabase.from("appointment_sync")
        .update({ sync_status: "synced", last_error: null, updated_at: now })
        .eq("id", existingSync.id);
    }

    await supabase.from("calendar_event_map").upsert({
      org_id: targetOrgId,
      connection_id: connection.id,
      user_id: targetUserId,
      appointment_id: appointmentId,
      calendar_id: calendarId,
      google_event_id: existingGoogleEventId,
      ical_uid: updatedEvent.iCalUID || existingMap?.ical_uid || null,
      etag: updatedEvent.etag || null,
      extended_properties: updatedEvent.extendedProperties || null,
      last_google_updated_at: updatedEvent.updated ? new Date(updatedEvent.updated).toISOString() : now,
      last_crm_updated_at: now,
      sync_direction: "to_google",
      sync_status: "synced",
      is_deleted: false,
      updated_at: now,
    }, { onConflict: "connection_id,google_event_id" });

    const start = parseEventTime(updatedEvent.start);
    const end = parseEventTime(updatedEvent.end);
    await supabase.from("google_calendar_events").upsert({
      org_id: targetOrgId,
      connection_id: connection.id,
      user_id: targetUserId,
      google_calendar_id: calendarId,
      google_event_id: existingGoogleEventId,
      summary: updatedEvent.summary || null,
      description: updatedEvent.description || null,
      location: updatedEvent.location || null,
      start_time: start.time,
      end_time: end.time,
      all_day: start.allDay,
      timezone: start.timezone,
      status: updatedEvent.status || "confirmed",
      organizer_email: updatedEvent.organizer?.email || null,
      organizer_display_name: updatedEvent.organizer?.displayName || null,
      attendees: updatedEvent.attendees || null,
      html_link: updatedEvent.htmlLink || null,
      hangout_link: updatedEvent.hangoutLink || null,
      conference_data: updatedEvent.conferenceData || null,
      etag: updatedEvent.etag || null,
      extended_properties: updatedEvent.extendedProperties || null,
      appointment_id: appointmentId,
      synced_to_crm: true,
      sync_direction: "to_google",
      last_modified: updatedEvent.updated ? new Date(updatedEvent.updated).toISOString() : now,
      updated_at: now,
    }, { onConflict: "connection_id,google_calendar_id,google_event_id" });

    return successResponse({ synced: true, operation: "updated" });
  }

  const googleEvent = await createGoogleCalendarEvent(accessToken, calendarId, eventPayload, generateMeet);

  const meetLink = googleEvent.conferenceData
    ? ((googleEvent.conferenceData as { entryPoints?: { entryPointType: string; uri: string }[] }).entryPoints || [])
        .find((ep) => ep.entryPointType === "video")?.uri
    : googleEvent.hangoutLink || null;

  const now = new Date().toISOString();

  await supabase.from("appointment_sync").upsert({
    org_id: appointment.org_id,
    appointment_id: appointmentId,
    user_id: targetUserId,
    provider: "google",
    external_event_id: googleEvent.id,
    google_calendar_id: calendarId,
    sync_status: "synced",
    last_error: null,
    updated_at: now,
  }, { onConflict: "appointment_id,provider" });

  await supabase.from("calendar_event_map").upsert({
    org_id: targetOrgId,
    connection_id: connection.id,
    user_id: targetUserId,
    appointment_id: appointmentId,
    calendar_id: calendarId,
    google_event_id: googleEvent.id,
    ical_uid: googleEvent.iCalUID || null,
    etag: googleEvent.etag || null,
    extended_properties: googleEvent.extendedProperties || null,
    last_google_updated_at: googleEvent.updated ? new Date(googleEvent.updated).toISOString() : now,
    last_crm_updated_at: now,
    sync_direction: "to_google",
    sync_status: "synced",
    is_deleted: false,
    updated_at: now,
  }, { onConflict: "connection_id,google_event_id" });

  const { data: calListEntry } = await supabase
    .from("google_calendar_list")
    .select("id")
    .eq("connection_id", connection.id)
    .eq("google_calendar_id", calendarId)
    .maybeSingle();

  const calendarListId = calListEntry?.id || null;

  if (calendarListId) {
    const start = parseEventTime(googleEvent.start);
    const end = parseEventTime(googleEvent.end);
    await supabase.from("google_calendar_events").upsert({
      org_id: targetOrgId,
      connection_id: connection.id,
      user_id: targetUserId,
      calendar_list_id: calendarListId,
      google_calendar_id: calendarId,
      google_event_id: googleEvent.id,
      ical_uid: googleEvent.iCalUID || null,
      summary: googleEvent.summary || null,
      description: googleEvent.description || null,
      location: googleEvent.location || null,
      start_time: start.time,
      end_time: end.time,
      all_day: start.allDay,
      timezone: start.timezone,
      recurrence: googleEvent.recurrence || null,
      recurring_event_id: googleEvent.recurringEventId || null,
      status: googleEvent.status || "confirmed",
      organizer_email: googleEvent.organizer?.email || null,
      organizer_display_name: googleEvent.organizer?.displayName || null,
      creator_email: googleEvent.creator?.email || null,
      attendees: googleEvent.attendees || null,
      event_type: googleEvent.eventType || null,
      visibility: googleEvent.visibility || null,
      transparency: googleEvent.transparency || null,
      html_link: googleEvent.htmlLink || null,
      hangout_link: googleEvent.hangoutLink || meetLink || null,
      conference_data: googleEvent.conferenceData || null,
      reminders: googleEvent.reminders || null,
      source: googleEvent.source || null,
      attachments: googleEvent.attachments || null,
      last_modified: googleEvent.updated ? new Date(googleEvent.updated).toISOString() : null,
      etag: googleEvent.etag || null,
      extended_properties: googleEvent.extendedProperties || null,
      appointment_id: appointmentId,
      synced_to_crm: true,
      sync_direction: "to_google",
      updated_at: now,
    }, { onConflict: "connection_id,google_calendar_id,google_event_id" });
  }

  if (meetLink) {
    await supabase.from("appointments").update({ google_meet_link: meetLink }).eq("id", appointmentId);
  }

  await supabase.from("appointments")
    .update({ google_event_id: googleEvent.id })
    .eq("id", appointmentId);

  await syncLog(supabase, targetOrgId, connection.id, calendarId, "info",
    `Created Google event for appointment ${appointmentId}`,
    { googleEventId: googleEvent.id, meetLink });

  return successResponse({ synced: true, operation: "created", googleEventId: googleEvent.id, meetLink });
}

async function handleUpdateEvent(req: Request, body?: Record<string, unknown>): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const parsed = body || await req.json();
  const { eventId, updates } = parsed;
  if (!eventId) throw new ValidationError("eventId is required");

  const { data: event } = await supabase
    .from("google_calendar_events")
    .select("*, connection:google_calendar_connections(*)")
    .eq("id", eventId)
    .eq("user_id", userCtx.id)
    .maybeSingle();

  if (!event) throw new ValidationError("Event not found");

  const conn = event.connection;
  if (!conn) throw new ValidationError("No Google Calendar connection found. Please reconnect your Google Calendar.");

  const accessToken = await getValidToken(conn, supabase);

  const googleUpdate: Record<string, unknown> = {};
  if (updates.summary !== undefined) googleUpdate.summary = updates.summary;
  if (updates.description !== undefined) googleUpdate.description = updates.description;
  if (updates.location !== undefined) googleUpdate.location = updates.location;

  if (updates.start_time) {
    googleUpdate.start = updates.all_day
      ? { date: updates.start_time.split("T")[0] }
      : { dateTime: updates.start_time, timeZone: updates.timezone || event.timezone };
  }
  if (updates.end_time) {
    googleUpdate.end = updates.all_day
      ? { date: updates.end_time.split("T")[0] }
      : { dateTime: updates.end_time, timeZone: updates.timezone || event.timezone };
  }

  const updatedGoogleEvent = await updateGoogleCalendarEventById(
    accessToken, event.google_calendar_id, event.google_event_id, googleUpdate
  );

  const start = parseEventTime(updatedGoogleEvent.start);
  const end = parseEventTime(updatedGoogleEvent.end);

  await supabase
    .from("google_calendar_events")
    .update({
      summary: updatedGoogleEvent.summary || event.summary,
      description: updatedGoogleEvent.description || null,
      location: updatedGoogleEvent.location || null,
      start_time: start.time,
      end_time: end.time,
      all_day: start.allDay,
      timezone: start.timezone,
      etag: updatedGoogleEvent.etag || null,
      last_modified: updatedGoogleEvent.updated
        ? new Date(updatedGoogleEvent.updated).toISOString()
        : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  const now = new Date().toISOString();
  await supabase.from("calendar_event_map")
    .update({
      etag: updatedGoogleEvent.etag || null,
      last_google_updated_at: updatedGoogleEvent.updated ? new Date(updatedGoogleEvent.updated).toISOString() : now,
      last_crm_updated_at: now,
      sync_status: "synced",
      updated_at: now,
    })
    .eq("connection_id", conn.id)
    .eq("google_event_id", event.google_event_id);

  return successResponse({ updated: true });
}

async function handleDeleteEvent(req: Request, body?: Record<string, unknown>): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const parsed = body || await req.json();
  const { eventId } = parsed;
  if (!eventId) throw new ValidationError("eventId is required");

  const { data: event } = await supabase
    .from("google_calendar_events")
    .select("*, connection:google_calendar_connections(*)")
    .eq("id", eventId)
    .eq("user_id", userCtx.id)
    .maybeSingle();

  if (!event) throw new ValidationError("Event not found");

  const conn = event.connection;
  if (!conn) throw new ValidationError("No Google Calendar connection found. Please reconnect your Google Calendar.");
  const accessToken = await getValidToken(conn, supabase);

  await deleteGoogleCalendarEventById(accessToken, event.google_calendar_id, event.google_event_id);

  await supabase
    .from("google_calendar_events")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", eventId);

  const { data: mapEntry } = await supabase
    .from("calendar_event_map")
    .select("id, appointment_id")
    .eq("connection_id", conn.id)
    .eq("google_event_id", event.google_event_id)
    .maybeSingle();

  if (mapEntry) {
    await supabase.from("calendar_event_map")
      .update({ is_deleted: true, sync_status: "synced", updated_at: new Date().toISOString() })
      .eq("id", mapEntry.id);

    if (mapEntry.appointment_id) {
      await supabase.from("appointments")
        .update({ status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", mapEntry.appointment_id);
    }
  }

  return successResponse({ deleted: true });
}

async function handleRsvp(req: Request, body?: Record<string, unknown>): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const parsed = body || await req.json();
  const { eventId, response: rsvpResponse } = parsed as { eventId?: string; response?: string };
  if (!eventId) throw new ValidationError("eventId is required");
  if (!rsvpResponse || !["accepted", "declined", "tentative"].includes(rsvpResponse as string)) {
    throw new ValidationError("response must be accepted, declined, or tentative");
  }

  const { data: event } = await supabase
    .from("google_calendar_events")
    .select("*, connection:google_calendar_connections(*)")
    .eq("id", eventId)
    .eq("user_id", userCtx.id)
    .maybeSingle();

  if (!event) throw new ValidationError("Event not found");

  const conn = event.connection;
  if (!conn) throw new ValidationError("No Google Calendar connection found. Please reconnect your Google Calendar.");
  const accessToken = await getValidToken(conn, supabase);

  const getResp = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(event.google_calendar_id)}/events/${event.google_event_id}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!getResp.ok) {
    const errText = await getResp.text();
    throw new Error(`Failed to fetch Google event: ${errText}`);
  }

  const googleEvent = await getResp.json();
  const userEmail = conn.email?.toLowerCase();
  const updatedAttendees = (googleEvent.attendees || []).map(
    (att: { email?: string; responseStatus?: string; [key: string]: unknown }) => {
      if (att.email?.toLowerCase() === userEmail) {
        return { ...att, responseStatus: rsvpResponse };
      }
      return att;
    }
  );

  const patchResp = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(event.google_calendar_id)}/events/${event.google_event_id}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ attendees: updatedAttendees }),
    }
  );

  if (!patchResp.ok) {
    const errText = await patchResp.text();
    throw new Error(`Failed to update RSVP: ${errText}`);
  }

  const updatedEvent = await patchResp.json();

  await supabase
    .from("google_calendar_events")
    .update({
      attendees: updatedEvent.attendees || null,
      etag: updatedEvent.etag || null,
      last_modified: updatedEvent.updated ? new Date(updatedEvent.updated).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  const now = new Date().toISOString();
  await supabase.from("calendar_event_map")
    .update({
      etag: updatedEvent.etag || null,
      last_google_updated_at: updatedEvent.updated ? new Date(updatedEvent.updated).toISOString() : now,
      sync_status: "synced",
      updated_at: now,
    })
    .eq("connection_id", conn.id)
    .eq("google_event_id", event.google_event_id);

  return successResponse({ updated: true, response: rsvpResponse });
}

async function handleSyncBlockedSlot(req: Request, body: Record<string, unknown>): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const { blockedSlotId, operation } = body as { blockedSlotId?: string; operation?: string };
  if (!blockedSlotId) throw new ValidationError("blockedSlotId is required");
  const op = operation || "create";

  const { data: slot } = await supabase.from("blocked_slots").select("*").eq("id", blockedSlotId).maybeSingle();
  if (!slot) throw new ValidationError("Blocked slot not found");

  const targetUserId = slot.user_id || slot.created_by || userCtx.id;
  const connection = await getUserConnection(supabase, targetUserId, slot.org_id);
  if (!connection) return successResponse({ synced: false, reason: "no_connection" });

  const accessToken = await getValidToken(connection, supabase);
  const calendarId = "primary";

  const { data: existingSync } = await supabase
    .from("blocked_slot_sync").select("*").eq("blocked_slot_id", blockedSlotId).eq("provider", "google").maybeSingle();

  if (op === "delete") {
    if (existingSync?.external_event_id) {
      await deleteGoogleCalendarEventById(accessToken, calendarId, existingSync.external_event_id);
      await supabase.from("blocked_slot_sync").delete().eq("id", existingSync.id);
    }
    return successResponse({ synced: true, operation: "deleted" });
  }

  const eventPayload: Record<string, unknown> = {
    summary: slot.title || "Blocked Time",
    description: "Blocked time (from CRM)",
    start: slot.all_day ? { date: slot.start_at_utc.split("T")[0] } : { dateTime: slot.start_at_utc, timeZone: "UTC" },
    end: slot.all_day ? { date: slot.end_at_utc.split("T")[0] } : { dateTime: slot.end_at_utc, timeZone: "UTC" },
    transparency: "opaque",
  };
  if (slot.recurring && slot.recurrence_rule) eventPayload.recurrence = [slot.recurrence_rule];

  if (existingSync?.external_event_id && op === "update") {
    await updateGoogleCalendarEventById(accessToken, calendarId, existingSync.external_event_id, eventPayload);
    await supabase.from("blocked_slot_sync")
      .update({ sync_status: "synced", last_error: null, updated_at: new Date().toISOString() })
      .eq("id", existingSync.id);
    return successResponse({ synced: true, operation: "updated" });
  }

  const googleEvent = await createGoogleCalendarEvent(accessToken, calendarId, eventPayload);
  await supabase.from("blocked_slot_sync").upsert({
    org_id: slot.org_id, blocked_slot_id: blockedSlotId, user_id: targetUserId,
    provider: "google", external_event_id: googleEvent.id, google_calendar_id: calendarId,
    sync_status: "synced", last_error: null, updated_at: new Date().toISOString(),
  }, { onConflict: "blocked_slot_id,provider" });

  return successResponse({ synced: true, operation: "created", googleEventId: googleEvent.id });
}

async function handleSyncCalendarEvent(req: Request, body: Record<string, unknown>): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const { calendarEventId, operation, generateMeet } = body as {
    calendarEventId?: string; operation?: string; generateMeet?: boolean;
  };
  if (!calendarEventId) throw new ValidationError("calendarEventId is required");
  const op = operation || "create";

  const { data: calEvent } = await supabase.from("calendar_events").select("*").eq("id", calendarEventId).maybeSingle();
  if (!calEvent) throw new ValidationError("Calendar event not found");

  const connection = await getUserConnection(supabase, calEvent.user_id, calEvent.org_id);
  if (!connection) return successResponse({ synced: false, reason: "no_connection" });

  const accessToken = await getValidToken(connection, supabase);
  const calendarId = "primary";

  const { data: existingSync } = await supabase
    .from("calendar_event_sync").select("*").eq("calendar_event_id", calendarEventId).eq("provider", "google").maybeSingle();

  if (op === "delete" || calEvent.status === "cancelled") {
    if (existingSync?.external_event_id) {
      await deleteGoogleCalendarEventById(accessToken, calendarId, existingSync.external_event_id);
      await supabase.from("calendar_event_sync").delete().eq("id", existingSync.id);
    }
    return successResponse({ synced: true, operation: "deleted" });
  }

  const attendees = Array.isArray(calEvent.attendees)
    ? calEvent.attendees.map((a: { email?: string; name?: string }) => ({ email: a.email, displayName: a.name }))
    : undefined;

  const eventPayload: Record<string, unknown> = {
    summary: calEvent.title,
    description: calEvent.description || undefined,
    location: calEvent.location || undefined,
    start: calEvent.all_day
      ? { date: calEvent.start_at_utc.split("T")[0] }
      : { dateTime: calEvent.start_at_utc, timeZone: calEvent.timezone || "UTC" },
    end: calEvent.all_day
      ? { date: calEvent.end_at_utc.split("T")[0] }
      : { dateTime: calEvent.end_at_utc, timeZone: calEvent.timezone || "UTC" },
    attendees,
  };

  if (existingSync?.external_event_id && op === "update") {
    await updateGoogleCalendarEventById(accessToken, calendarId, existingSync.external_event_id, eventPayload);
    await supabase.from("calendar_event_sync")
      .update({ sync_status: "synced", last_error: null, updated_at: new Date().toISOString() })
      .eq("id", existingSync.id);
    return successResponse({ synced: true, operation: "updated" });
  }

  const googleEvent = await createGoogleCalendarEvent(accessToken, calendarId, eventPayload, !!generateMeet);
  const meetLink = googleEvent.conferenceData
    ? ((googleEvent.conferenceData as { entryPoints?: { entryPointType: string; uri: string }[] }).entryPoints || [])
        .find((ep) => ep.entryPointType === "video")?.uri
    : googleEvent.hangoutLink || null;

  await supabase.from("calendar_event_sync").upsert({
    org_id: calEvent.org_id, calendar_event_id: calendarEventId, user_id: calEvent.user_id,
    provider: "google", external_event_id: googleEvent.id, google_calendar_id: calendarId,
    sync_status: "synced", last_error: null, updated_at: new Date().toISOString(),
  }, { onConflict: "calendar_event_id,provider" });

  if (meetLink) {
    await supabase.from("calendar_events").update({ google_meet_link: meetLink }).eq("id", calendarEventId);
  }

  return successResponse({ synced: true, operation: "created", googleEventId: googleEvent.id, meetLink });
}

async function handleSyncTask(req: Request, body: Record<string, unknown>): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const { taskId, operation } = body as { taskId?: string; operation?: string };
  if (!taskId) throw new ValidationError("taskId is required");
  const op = operation || "create";

  const { data: task } = await supabase.from("calendar_tasks").select("*").eq("id", taskId).maybeSingle();
  if (!task) throw new ValidationError("Task not found");

  const connection = await getUserConnection(supabase, task.user_id, task.org_id);
  if (!connection) return successResponse({ synced: false, reason: "no_connection" });

  const accessToken = await getValidToken(connection, supabase);
  const calendarId = "primary";

  const { data: existingSync } = await supabase
    .from("calendar_task_sync").select("*").eq("calendar_task_id", taskId).eq("provider", "google").maybeSingle();

  if (op === "delete") {
    if (existingSync?.external_event_id) {
      await deleteGoogleCalendarEventById(accessToken, calendarId, existingSync.external_event_id);
      await supabase.from("calendar_task_sync").delete().eq("id", existingSync.id);
    }
    return successResponse({ synced: true, operation: "deleted" });
  }

  const endTime = new Date(new Date(task.due_at_utc).getTime() + (task.duration_minutes || 30) * 60000).toISOString();
  const priorityLabel = task.priority === "high" ? "[HIGH] " : task.priority === "low" ? "[LOW] " : "";

  const eventPayload: Record<string, unknown> = {
    summary: `${priorityLabel}[Task] ${task.title}`,
    description: task.description || "Calendar task from CRM",
    start: { dateTime: task.due_at_utc, timeZone: "UTC" },
    end: { dateTime: endTime, timeZone: "UTC" },
    colorId: task.completed ? "8" : task.priority === "high" ? "11" : "5",
  };

  if (existingSync?.external_event_id && op === "update") {
    await updateGoogleCalendarEventById(accessToken, calendarId, existingSync.external_event_id, eventPayload);
    await supabase.from("calendar_task_sync")
      .update({ sync_status: "synced", last_error: null, updated_at: new Date().toISOString() })
      .eq("id", existingSync.id);
    return successResponse({ synced: true, operation: "updated" });
  }

  const googleEvent = await createGoogleCalendarEvent(accessToken, calendarId, eventPayload);
  await supabase.from("calendar_task_sync").upsert({
    org_id: task.org_id, calendar_task_id: taskId, user_id: task.user_id,
    provider: "google", external_event_id: googleEvent.id, google_calendar_id: calendarId,
    sync_status: "synced", last_error: null, updated_at: new Date().toISOString(),
  }, { onConflict: "calendar_task_id,provider" });

  return successResponse({ synced: true, operation: "created", googleEventId: googleEvent.id });
}

Deno.serve(async (req: Request) => {
  try {
    const corsResp = handleCors(req);
    if (corsResp) return corsResp;

    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed", 405);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine for sync action
    }

    const url = new URL(req.url);
    const pathSegment = url.pathname.replace(/^\/google-calendar-sync\/?/, "").replace(/^\/+/, "");
    const action = (body.action as string) || pathSegment || "sync";

    if (action === "sync" || action === "") return await handleSync(req);
    if (action === "sync-incremental") return await handleSyncIncremental(req);
    if (action === "update-event") return await handleUpdateEvent(req, body);
    if (action === "delete-event") return await handleDeleteEvent(req, body);
    if (action === "rsvp") return await handleRsvp(req, body);
    if (action === "sync-appointment") return await handleSyncAppointment(req, body);
    if (action === "sync-blocked-slot") return await handleSyncBlockedSlot(req, body);
    if (action === "sync-calendar-event") return await handleSyncCalendarEvent(req, body);
    if (action === "sync-task") return await handleSyncTask(req, body);

    return errorResponse("UNKNOWN_ACTION", "Unknown action", 400);
  } catch (error) {
    return handleError(error);
  }
});
