import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveRefreshToken, refreshAccessToken, writeMasterToken, crossPopulateServiceTables } from "../_shared/google-oauth-helpers.ts";
import { encryptToken } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_JOBS_PER_RUN = 5;
const MAX_ATTEMPTS = 5;

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type Supabase = ReturnType<typeof getSupabaseClient>;

interface SyncJob {
  id: string;
  org_id: string;
  connection_id: string;
  user_id: string;
  job_type: string;
  status: string;
  attempt: number;
  max_attempts: number;
  scheduled_at: string;
  payload: Record<string, unknown> | null;
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
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshTokenStr,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
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
  if (expiry.getTime() - Date.now() > 60_000) {
    return connection.access_token;
  }

  let result: { access_token: string; expires_in: number; refresh_token?: string };
  let usedRefreshToken = connection.refresh_token;
  try {
    result = await refreshToken(connection.refresh_token);
  } catch {
    console.warn("Calendar runner token refresh failed, trying fallback...");
    const fallback = await resolveRefreshToken(supabase, connection.user_id, connection.org_id);
    if (fallback) {
      const fallbackResult = await refreshAccessToken(fallback.refreshToken);
      if (fallbackResult) {
        result = fallbackResult;
        usedRefreshToken = fallback.refreshToken;
      } else {
        throw new Error("All token refresh sources exhausted");
      }
    } else {
      throw new Error("No fallback refresh token available");
    }
  }

  const newExpiry = new Date(Date.now() + result.expires_in * 1000).toISOString();
  const finalRefreshToken = result.refresh_token || usedRefreshToken;

  const updateData: Record<string, unknown> = {
    access_token: result.access_token,
    token_expiry: newExpiry,
  };
  if (result.refresh_token) updateData.refresh_token = result.refresh_token;

  await supabase
    .from("google_calendar_connections")
    .update(updateData)
    .eq("id", connection.id);

  try {
    const { data: master } = await supabase
      .from("google_oauth_master")
      .select("granted_scopes, email")
      .eq("user_id", connection.user_id)
      .maybeSingle();

    if (master) {
      await writeMasterToken(supabase, connection.org_id, connection.user_id, master.email, result.access_token, finalRefreshToken, newExpiry, master.granted_scopes || []);
    }
  } catch (masterErr) {
    console.warn("[Runner] Failed to update master token (non-fatal):", masterErr);
  }

  connection.access_token = result.access_token;
  connection.token_expiry = newExpiry;

  return result.access_token;
}

function parseEventTime(timeObj?: { dateTime?: string; date?: string; timeZone?: string }): {
  time: string; allDay: boolean; timezone: string;
} {
  if (!timeObj) return { time: new Date().toISOString(), allDay: false, timezone: "UTC" };
  if (timeObj.date) return { time: new Date(timeObj.date + "T00:00:00Z").toISOString(), allDay: true, timezone: timeObj.timeZone || "UTC" };
  return { time: new Date(timeObj.dateTime!).toISOString(), allDay: false, timezone: timeObj.timeZone || "UTC" };
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

    const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (resp.status === 410) return { events: [], nextSyncToken: null, fullSyncRequired: true };
    if (!resp.ok) throw new Error(`Google API error (${resp.status}): ${await resp.text()}`);

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

    const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) throw new Error(`Google API error (${resp.status}): ${await resp.text()}`);

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

const CONFLICT_WINDOW_MS = 5000;

function getCrmAppointmentIdFromEvent(evt: GoogleEvent): string | null {
  return evt.extendedProperties?.private?.autom8ion_appointment_id || null;
}

async function createCrmAppointmentFromGoogleEvent(
  supabase: Supabase,
  orgId: string,
  userId: string,
  _calendarId: string,
  evt: GoogleEvent
): Promise<string | null> {
  // Check if appointment already exists with this google_event_id
  const { data: existingApt } = await supabase
    .from("appointments")
    .select("id")
    .eq("org_id", orgId)
    .eq("google_event_id", evt.id)
    .maybeSingle();

  if (existingApt) {
    console.log("[Runner] Appointment already exists for Google event:", evt.id);
    return existingApt.id;
  }

  const start = parseEventTime(evt.start);
  const end = parseEventTime(evt.end);

  const { data: defaultCalendar } = await supabase
    .from("calendars").select("id").eq("org_id", orgId).limit(1).maybeSingle();
  if (!defaultCalendar) return null;

  const { data: defaultType } = await supabase
    .from("appointment_types").select("id").eq("calendar_id", defaultCalendar.id).limit(1).maybeSingle();
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
      history: [{ action: "created_from_google", timestamp: new Date().toISOString(), google_event_id: evt.id, summary: evt.summary }],
    })
    .select("id")
    .maybeSingle();

  if (error || !apt) {
    console.error("[Runner] Failed to create CRM appointment:", error);
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
  const { org_id: orgId, user_id: userId, id: connectionId } = connection;

  const { data: existingMap } = await supabase
    .from("calendar_event_map")
    .select("*")
    .eq("connection_id", connectionId)
    .eq("google_event_id", evt.id)
    .maybeSingle();

  if (evt.status === "cancelled") {
    if (existingMap?.appointment_id) {
      await supabase.from("appointments")
        .update({ status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", existingMap.appointment_id);
    }
    if (existingMap) {
      await supabase.from("calendar_event_map")
        .update({ is_deleted: true, sync_status: "synced", updated_at: new Date().toISOString() })
        .eq("id", existingMap.id);
    }
    await supabase.from("google_calendar_events")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("connection_id", connectionId)
      .eq("google_event_id", evt.id);
    stats.deleted++;
    return;
  }

  const row = mapGoogleEventToRow(evt, orgId, connectionId, userId, calendarListId, calendarId);
  await supabase.from("google_calendar_events")
    .upsert(row, { onConflict: "connection_id,google_calendar_id,google_event_id" });

  const crmAptId = getCrmAppointmentIdFromEvent(evt);

  if (existingMap) {
    const googleUpdated = evt.updated ? new Date(evt.updated).getTime() : Date.now();
    const crmUpdated = existingMap.last_crm_updated_at ? new Date(existingMap.last_crm_updated_at).getTime() : 0;
    const googleWins = !existingMap.last_crm_updated_at || googleUpdated > crmUpdated || Math.abs(googleUpdated - crmUpdated) < CONFLICT_WINDOW_MS;

    if (googleWins && existingMap.appointment_id) {
      const start = parseEventTime(evt.start);
      const end = parseEventTime(evt.end);
      await supabase.from("appointments")
        .update({ start_at_utc: start.time, end_at_utc: end.time, notes: evt.summary || null, location: evt.location || null, visitor_timezone: start.timezone, updated_at: new Date().toISOString() })
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
      const { data: apt } = await supabase.from("appointments").select("id").eq("id", crmAptId).maybeSingle();
      if (!apt) appointmentId = null;
    }
    if (!appointmentId) {
      appointmentId = await createCrmAppointmentFromGoogleEvent(supabase, orgId, userId, calendarId, evt);
    }

    const now = new Date().toISOString();
    await supabase.from("calendar_event_map").upsert({
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
      sync_direction: appointmentId ? "bidirectional" : "from_google",
      sync_status: "synced",
      is_deleted: false,
      updated_at: now,
    }, { onConflict: "connection_id,google_event_id" });

    stats.created++;
  }
}

async function processFullSync(supabase: Supabase, connection: Connection) {
  const accessToken = await getValidToken(connection, supabase);
  const selectedCalendarIds = getSelectedCalendarIds(connection);
  const lookbackDays = connection.sync_lookback_days || 60;
  const timeMin = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

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

  let totalSynced = 0;
  const errors: string[] = [];

  for (const calendarId of selectedCalendarIds) {
    try {
      let calendarListId = calListMap.get(calendarId);
      if (!calendarListId) {
        const { data: newEntry } = await supabase
          .from("google_calendar_list")
          .upsert({
            org_id: connection.org_id, connection_id: connection.id, user_id: connection.user_id,
            google_calendar_id: calendarId, summary: calendarId === "primary" ? "Primary Calendar" : calendarId,
            access_role: "owner", selected: true,
          }, { onConflict: "connection_id,google_calendar_id" })
          .select("id")
          .maybeSingle();
        if (!newEntry?.id) continue;
        calendarListId = newEntry.id;
        calListMap.set(calendarId, calendarListId);
      }

      const existingSyncToken = syncTokenMap.get(calendarId);
      let events: GoogleEvent[];
      let nextSyncToken: string | null = null;

      if (existingSyncToken) {
        const result = await fetchGoogleEventsWithSyncToken(accessToken, calendarId, existingSyncToken);
        if (result.fullSyncRequired) {
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

      const stats = { created: 0, updated: 0, deleted: 0, skipped: 0 };
      for (const evt of events) {
        if (evt.status !== "cancelled") {
          const row = mapGoogleEventToRow(evt, connection.org_id, connection.id, connection.user_id, calendarListId, calendarId);
          await supabase.from("google_calendar_events")
            .upsert(row, { onConflict: "connection_id,google_calendar_id,google_event_id" });
        }
        await processIncrementalEvent(supabase, connection, calendarId, calendarListId, evt, stats);
      }

      if (nextSyncToken) {
        await supabase.from("google_calendar_list")
          .update({ sync_token: nextSyncToken, last_synced_at: new Date().toISOString() })
          .eq("id", calendarListId);
      }

      totalSynced += events.length;
      await syncLog(supabase, connection.org_id, connection.id, calendarId, "info",
        `Full sync: ${stats.created} created, ${stats.updated} updated, ${stats.deleted} deleted`,
        { stats, eventCount: events.length });

    } catch (calErr) {
      errors.push(`Calendar ${calendarId}: ${(calErr as Error).message}`);
      await syncLog(supabase, connection.org_id, connection.id, calendarId, "error",
        `Full sync failed: ${(calErr as Error).message}`);
    }
  }

  await supabase.from("google_calendar_connections")
    .update({ last_full_sync_at: new Date().toISOString(), last_incremental_sync_at: new Date().toISOString() })
    .eq("id", connection.id);

  return { totalSynced, errors };
}

async function processIncrementalSync(supabase: Supabase, connection: Connection) {
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
    const calendarListId = calListMap.get(calendarId);
    if (!calendarListId) continue;

    if (!syncToken) {
      errors.push(`No sync token for ${calendarId}, needs full sync`);
      continue;
    }

    try {
      const result = await fetchGoogleEventsWithSyncToken(accessToken, calendarId, syncToken);

      if (result.fullSyncRequired) {
        const lookbackDays = connection.sync_lookback_days || 60;
        const timeMin = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
        const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        const fullResult = await fetchGoogleEventsFull(accessToken, calendarId, timeMin, timeMax);

        const stats = { created: 0, updated: 0, deleted: 0, skipped: 0 };
        for (const evt of fullResult.events) {
          const row = mapGoogleEventToRow(evt, connection.org_id, connection.id, connection.user_id, calendarListId, calendarId);
          await supabase.from("google_calendar_events")
            .upsert(row, { onConflict: "connection_id,google_calendar_id,google_event_id" });
          await processIncrementalEvent(supabase, connection, calendarId, calendarListId, evt, stats);
        }

        if (fullResult.nextSyncToken) {
          await supabase.from("google_calendar_list")
            .update({ sync_token: fullResult.nextSyncToken, last_synced_at: new Date().toISOString() })
            .eq("id", calendarListId);
        }
        totalProcessed += fullResult.events.length;
        continue;
      }

      const stats = { created: 0, updated: 0, deleted: 0, skipped: 0 };
      for (const evt of result.events) {
        if (evt.status !== "cancelled") {
          const row = mapGoogleEventToRow(evt, connection.org_id, connection.id, connection.user_id, calendarListId, calendarId);
          await supabase.from("google_calendar_events")
            .upsert(row, { onConflict: "connection_id,google_calendar_id,google_event_id" });
        }
        await processIncrementalEvent(supabase, connection, calendarId, calendarListId, evt, stats);
      }

      if (result.nextSyncToken) {
        await supabase.from("google_calendar_list")
          .update({ sync_token: result.nextSyncToken, last_synced_at: new Date().toISOString() })
          .eq("id", calendarListId);
      }

      totalProcessed += result.events.length;
      await syncLog(supabase, connection.org_id, connection.id, calendarId, "info",
        `Incremental sync: ${stats.created} created, ${stats.updated} updated, ${stats.deleted} deleted`,
        { stats, eventCount: result.events.length });

    } catch (calErr) {
      errors.push(`Calendar ${calendarId}: ${(calErr as Error).message}`);
      await syncLog(supabase, connection.org_id, connection.id, calendarId, "error",
        `Incremental sync failed: ${(calErr as Error).message}`);
    }
  }

  await supabase.from("google_calendar_connections")
    .update({ last_incremental_sync_at: new Date().toISOString() })
    .eq("id", connection.id);

  return { totalProcessed, errors };
}

async function processJob(supabase: Supabase, job: SyncJob): Promise<void> {
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("id", job.connection_id)
    .maybeSingle();

  if (!connection) {
    await supabase.from("google_calendar_sync_jobs")
      .update({ status: "failed", last_error: "Connection not found", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return;
  }

  if (job.job_type === "full_sync" || job.job_type === "initial_sync") {
    const result = await processFullSync(supabase, connection);
    if (result.errors.length > 0) {
      await syncLog(supabase, job.org_id, job.connection_id, null, "warn",
        `Job ${job.job_type} completed with errors`, { errors: result.errors, totalSynced: result.totalSynced });
    }
  } else if (job.job_type === "incremental_sync") {
    const result = await processIncrementalSync(supabase, connection);
    if (result.errors.length > 0) {
      await syncLog(supabase, job.org_id, job.connection_id, null, "warn",
        `Incremental sync completed with errors`, { errors: result.errors, totalProcessed: result.totalProcessed });
    }
  } else {
    throw new Error(`Unknown job type: ${job.job_type}`);
  }

  try {
    await detectMeetSessions(supabase, job.connection_id, job.org_id, connection.user_id);
  } catch (meetErr) {
    console.warn("[Runner] Meet detection failed (non-fatal):", (meetErr as Error).message);
    await syncLog(supabase, job.org_id, job.connection_id, null, "warn",
      `Meet session detection failed: ${(meetErr as Error).message}`);
  }
}

async function detectMeetSessions(
  supabase: Supabase,
  connectionId: string,
  orgId: string,
  userId: string
): Promise<void> {
  const BATCH_LIMIT = 50;
  const DELAY_MINUTES = 15;

  const { data: events } = await supabase
    .from("google_calendar_events")
    .select("google_event_id, summary, start_time, end_time, organizer_email, attendees, hangout_link, conference_data, html_link, status")
    .eq("connection_id", connectionId)
    .eq("status", "confirmed")
    .lt("end_time", new Date().toISOString())
    .not("hangout_link", "is", null)
    .order("end_time", { ascending: false })
    .limit(BATCH_LIMIT);

  if (!events || events.length === 0) return;

  const eventIds = events.map((e: { google_event_id: string }) => e.google_event_id);
  const { data: existingSessions } = await supabase
    .from("google_meet_sessions")
    .select("google_event_id")
    .eq("connection_id", connectionId)
    .in("google_event_id", eventIds);

  const existingSet = new Set(
    (existingSessions || []).map((s: { google_event_id: string }) => s.google_event_id)
  );

  let detected = 0;

  for (const evt of events) {
    if (existingSet.has(evt.google_event_id)) continue;

    let conferenceId: string | null = null;
    if (evt.conference_data) {
      const confData = typeof evt.conference_data === "string"
        ? JSON.parse(evt.conference_data)
        : evt.conference_data;
      conferenceId = confData?.conferenceId || null;
    }

    const endTime = new Date(evt.end_time);
    const firstCheckAfter = new Date(endTime.getTime() + DELAY_MINUTES * 60 * 1000);

    const { error: insertError } = await supabase
      .from("google_meet_sessions")
      .insert({
        org_id: orgId,
        user_id: userId,
        connection_id: connectionId,
        google_event_id: evt.google_event_id,
        meet_conference_id: conferenceId,
        calendar_event_summary: evt.summary || null,
        event_start_time: evt.start_time,
        event_end_time: evt.end_time,
        organizer_email: evt.organizer_email || null,
        attendees: evt.attendees || [],
        meet_link: evt.hangout_link || null,
        html_link: evt.html_link || null,
        status: "detected",
        first_check_after: firstCheckAfter.toISOString(),
      });

    if (insertError) {
      if (insertError.code === "23505") continue;
      console.error("[Runner:MeetDetect] Insert error:", insertError);
      continue;
    }
    detected++;
  }

  if (detected > 0) {
    await syncLog(supabase, orgId, connectionId, null, "info",
      `Detected ${detected} new Meet sessions`, { detected });
  }
}

function getBackoffDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 300_000);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const supabase = getSupabaseClient();

    const { data: jobs, error: fetchError } = await supabase
      .from("google_calendar_sync_jobs")
      .select("*")
      .eq("status", "queued")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(MAX_JOBS_PER_RUN);

    if (fetchError) {
      console.error("[Runner] Failed to fetch jobs:", fetchError);
      return new Response(JSON.stringify({ success: false, error: "Failed to fetch jobs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No jobs to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      const now = new Date().toISOString();
      await supabase.from("google_calendar_sync_jobs")
        .update({ status: "processing", started_at: now, updated_at: now })
        .eq("id", job.id)
        .eq("status", "queued");

      try {
        await processJob(supabase, job as SyncJob);

        await supabase.from("google_calendar_sync_jobs")
          .update({ status: "completed", completed_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
          .eq("id", job.id);

        processed++;
      } catch (err) {
        const errMsg = (err as Error).message || String(err);
        const attempt = (job.attempt || 0) + 1;
        const maxAttempts = job.max_attempts || MAX_ATTEMPTS;

        if (attempt >= maxAttempts) {
          await supabase.from("google_calendar_sync_jobs")
            .update({ status: "failed", attempt, last_error: errMsg, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", job.id);

          await syncLog(supabase, job.org_id, job.connection_id, null, "error",
            `Job failed permanently after ${attempt} attempts: ${errMsg}`,
            { jobId: job.id, jobType: job.job_type });
        } else {
          const backoff = getBackoffDelay(attempt);
          const nextScheduled = new Date(Date.now() + backoff).toISOString();

          await supabase.from("google_calendar_sync_jobs")
            .update({ status: "queued", attempt, last_error: errMsg, scheduled_at: nextScheduled, updated_at: new Date().toISOString() })
            .eq("id", job.id);

          await syncLog(supabase, job.org_id, job.connection_id, null, "warn",
            `Job attempt ${attempt} failed, retrying at ${nextScheduled}: ${errMsg}`,
            { jobId: job.id, jobType: job.job_type, nextAttempt: attempt + 1 });
        }

        failed++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed, failed, total: jobs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Runner] Unhandled error:", error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
