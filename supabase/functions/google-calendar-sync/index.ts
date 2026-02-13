import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseClient, extractUserContext, requireAuth } from "../_shared/auth.ts";
import { handleCors, successResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { ValidationError } from "../_shared/errors.ts";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

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
  attendees?: { email?: string; displayName?: string; responseStatus?: string }[];
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
}

async function refreshToken(refreshTokenStr: string): Promise<{ access_token: string; expires_in: number }> {
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

async function getValidToken(
  connection: { id: string; access_token: string; refresh_token: string; token_expiry: string },
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<string> {
  const expiry = new Date(connection.token_expiry);
  const now = new Date();

  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection.access_token;
  }

  const { access_token, expires_in } = await refreshToken(connection.refresh_token);
  const newExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

  await supabase
    .from("google_calendar_connections")
    .update({ access_token, token_expiry: newExpiry })
    .eq("id", connection.id);

  return access_token;
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

async function fetchGoogleEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleEvent[]> {
  const allEvents: GoogleEvent[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("maxResults", "250");
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
  } while (pageToken);

  return allEvents;
}

async function handleSync(req: Request): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userCtx.id)
    .eq("org_id", userCtx.orgId)
    .maybeSingle();

  if (!connection) {
    throw new ValidationError("No Google Calendar connection found");
  }

  const accessToken = await getValidToken(connection, supabase);
  const selectedCalendarIds: string[] = connection.selected_calendar_ids || ["primary"];

  const lookbackDays = connection.sync_lookback_days || 60;
  const timeMin = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  let totalSynced = 0;
  const errors: string[] = [];

  const { data: calendarListRecords } = await supabase
    .from("google_calendar_list")
    .select("id, google_calendar_id")
    .eq("connection_id", connection.id);

  const calListMap = new Map<string, string>();
  (calendarListRecords || []).forEach((r: { id: string; google_calendar_id: string }) => {
    calListMap.set(r.google_calendar_id, r.id);
  });

  for (const calendarId of selectedCalendarIds) {
    try {
      const events = await fetchGoogleEvents(accessToken, calendarId, timeMin, timeMax);
      console.log(`Fetched ${events.length} events for calendar ${calendarId}`);

      let calendarListId = calListMap.get(calendarId);
      if (!calendarListId) {
        const { data: newEntry, error: listErr } = await supabase
          .from("google_calendar_list")
          .upsert({
            org_id: userCtx.orgId,
            connection_id: connection.id,
            user_id: userCtx.id,
            google_calendar_id: calendarId,
            summary: calendarId === "primary" ? "Primary Calendar" : calendarId,
            selected: true,
          }, { onConflict: "connection_id,google_calendar_id" })
          .select("id")
          .maybeSingle();

        if (listErr) {
          console.error(`Calendar list upsert error for ${calendarId}:`, listErr);
        }
        calendarListId = newEntry?.id || crypto.randomUUID();
      }

      const batchSize = 50;
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        const rows = batch.map((evt: GoogleEvent) => {
          const start = parseEventTime(evt.start);
          const end = parseEventTime(evt.end);

          return {
            org_id: userCtx.orgId,
            connection_id: connection.id,
            user_id: userCtx.id,
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
            sync_direction: "from_google",
            updated_at: new Date().toISOString(),
          };
        });

        const { error: upsertErr } = await supabase
          .from("google_calendar_events")
          .upsert(rows, {
            onConflict: "connection_id,google_calendar_id,google_event_id",
          });

        if (upsertErr) {
          console.error(`Event upsert error for ${calendarId}:`, upsertErr);
          errors.push(`Upsert error for ${calendarId}: ${upsertErr.message}`);
        } else {
          totalSynced += rows.length;
        }
      }
    } catch (calErr) {
      const errMsg = (calErr as Error).message || String(calErr);
      console.error(`Error syncing calendar ${calendarId}:`, errMsg);
      errors.push(`Calendar ${calendarId}: ${errMsg}`);
    }
  }

  await supabase
    .from("google_calendar_connections")
    .update({ last_full_sync_at: new Date().toISOString() })
    .eq("id", connection.id);

  if (totalSynced === 0 && errors.length > 0) {
    return successResponse({ synced: 0, errors });
  }

  return successResponse({ synced: totalSynced, errors: errors.length > 0 ? errors : undefined });
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

  const resp = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(event.google_calendar_id)}/events/${event.google_event_id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(googleUpdate),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to update Google event: ${errText}`);
  }

  const updatedGoogleEvent = await resp.json();

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
      last_modified: updatedGoogleEvent.updated
        ? new Date(updatedGoogleEvent.updated).toISOString()
        : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

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
  const accessToken = await getValidToken(conn, supabase);

  const resp = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(event.google_calendar_id)}/events/${event.google_event_id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
    const errText = await resp.text();
    throw new Error(`Failed to delete Google event: ${errText}`);
  }

  await supabase
    .from("google_calendar_events")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", eventId);

  return successResponse({ deleted: true });
}

Deno.serve(async (req: Request) => {
  try {
    const corsResp = handleCors(req);
    if (corsResp) return corsResp;

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
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

    if (action === "sync" || action === "") {
      return await handleSync(req);
    }
    if (action === "update-event") {
      return await handleUpdateEvent(req, body);
    }
    if (action === "delete-event") {
      return await handleDeleteEvent(req, body);
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
  } catch (error) {
    return handleError(error);
  }
});
