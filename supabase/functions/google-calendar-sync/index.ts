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
  const rawCalendarIds: string[] = connection.selected_calendar_ids || ["primary"];
  const connectionEmail = connection.email?.toLowerCase();
  const selectedCalendarIds = connectionEmail && rawCalendarIds.includes("primary") && rawCalendarIds.some((id: string) => id.toLowerCase() === connectionEmail)
    ? rawCalendarIds.filter((id: string) => id !== "primary")
    : rawCalendarIds;

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
            access_role: "owner",
            selected: true,
          }, { onConflict: "connection_id,google_calendar_id" })
          .select("id")
          .maybeSingle();

        if (listErr) {
          console.error(`Calendar list upsert error for ${calendarId}:`, listErr);
          errors.push(`Calendar list error for ${calendarId}: ${listErr.message}`);
          continue;
        }
        if (!newEntry?.id) {
          errors.push(`Failed to create calendar list entry for ${calendarId}`);
          continue;
        }
        calendarListId = newEntry.id;
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
  if (!conn) {
    throw new ValidationError("No Google Calendar connection found. Please reconnect your Google Calendar.");
  }

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
    throwGoogleApiError(resp.status, errText, "update");
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
  if (!conn) {
    throw new ValidationError("No Google Calendar connection found. Please reconnect your Google Calendar.");
  }
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
  if (!conn) {
    throw new ValidationError("No Google Calendar connection found. Please reconnect your Google Calendar.");
  }
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
      last_modified: updatedEvent.updated ? new Date(updatedEvent.updated).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  return successResponse({ updated: true, response: rsvpResponse });
}

async function getUserConnection(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
  orgId: string
) {
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  return connection;
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

async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventData: Record<string, unknown>,
  generateMeet = false
): Promise<{ id: string; htmlLink?: string; hangoutLink?: string; conferenceData?: Record<string, unknown> }> {
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
): Promise<Record<string, unknown>> {
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

  const connection = await getUserConnection(supabase, targetUserId, targetUser?.organization_id || userCtx.orgId);
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

  const appointmentType = appointment.appointment_type;
  const contact = appointment.contact;
  const summary = `${appointmentType?.name || "Appointment"} - ${contact?.first_name || "Guest"} ${contact?.last_name || ""}`.trim();

  if (op === "delete" || appointment.status === "canceled") {
    if (existingSync?.external_event_id) {
      await deleteGoogleCalendarEventById(accessToken, calendarId, existingSync.external_event_id);
      await supabase
        .from("appointment_sync")
        .update({ sync_status: "synced", last_error: null, updated_at: new Date().toISOString() })
        .eq("id", existingSync.id);
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
  };

  if (appointment.location || appointmentType?.location_value?.address) {
    eventPayload.location = appointment.location || appointmentType?.location_value?.address;
  }

  if (existingSync?.external_event_id && (op === "update" || op === "reschedule")) {
    await updateGoogleCalendarEventById(accessToken, calendarId, existingSync.external_event_id, eventPayload);
    await supabase
      .from("appointment_sync")
      .update({ sync_status: "synced", last_error: null, updated_at: new Date().toISOString() })
      .eq("id", existingSync.id);
    return successResponse({ synced: true, operation: "updated" });
  }

  const googleEvent = await createGoogleCalendarEvent(accessToken, calendarId, eventPayload, generateMeet);

  const meetLink = googleEvent.conferenceData
    ? ((googleEvent.conferenceData as { entryPoints?: { entryPointType: string; uri: string }[] }).entryPoints || [])
        .find((ep) => ep.entryPointType === "video")?.uri
    : googleEvent.hangoutLink || null;

  await supabase
    .from("appointment_sync")
    .upsert({
      org_id: appointment.org_id,
      appointment_id: appointmentId,
      user_id: targetUserId,
      provider: "google",
      external_event_id: googleEvent.id,
      google_calendar_id: calendarId,
      sync_status: "synced",
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "appointment_id,provider" });

  if (meetLink) {
    await supabase
      .from("appointments")
      .update({ google_meet_link: meetLink })
      .eq("id", appointmentId);
  }

  return successResponse({ synced: true, operation: "created", googleEventId: googleEvent.id, meetLink });
}

async function handleSyncBlockedSlot(req: Request, body: Record<string, unknown>): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const { blockedSlotId, operation } = body as { blockedSlotId?: string; operation?: string };
  if (!blockedSlotId) throw new ValidationError("blockedSlotId is required");

  const op = operation || "create";

  const { data: slot } = await supabase
    .from("blocked_slots")
    .select("*")
    .eq("id", blockedSlotId)
    .maybeSingle();

  if (!slot) throw new ValidationError("Blocked slot not found");

  const targetUserId = slot.user_id || slot.created_by || userCtx.id;
  const connection = await getUserConnection(supabase, targetUserId, slot.org_id);
  if (!connection) {
    return successResponse({ synced: false, reason: "no_connection" });
  }

  const accessToken = await getValidToken(connection, supabase);
  const calendarId = "primary";

  const { data: existingSync } = await supabase
    .from("blocked_slot_sync")
    .select("*")
    .eq("blocked_slot_id", blockedSlotId)
    .eq("provider", "google")
    .maybeSingle();

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
    start: slot.all_day
      ? { date: slot.start_at_utc.split("T")[0] }
      : { dateTime: slot.start_at_utc, timeZone: "UTC" },
    end: slot.all_day
      ? { date: slot.end_at_utc.split("T")[0] }
      : { dateTime: slot.end_at_utc, timeZone: "UTC" },
    transparency: "opaque",
  };

  if (slot.recurring && slot.recurrence_rule) {
    eventPayload.recurrence = [slot.recurrence_rule];
  }

  if (existingSync?.external_event_id && op === "update") {
    await updateGoogleCalendarEventById(accessToken, calendarId, existingSync.external_event_id, eventPayload);
    await supabase
      .from("blocked_slot_sync")
      .update({ sync_status: "synced", last_error: null, updated_at: new Date().toISOString() })
      .eq("id", existingSync.id);
    return successResponse({ synced: true, operation: "updated" });
  }

  const googleEvent = await createGoogleCalendarEvent(accessToken, calendarId, eventPayload);

  await supabase
    .from("blocked_slot_sync")
    .upsert({
      org_id: slot.org_id,
      blocked_slot_id: blockedSlotId,
      user_id: targetUserId,
      provider: "google",
      external_event_id: googleEvent.id,
      google_calendar_id: calendarId,
      sync_status: "synced",
      last_error: null,
      updated_at: new Date().toISOString(),
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

  const { data: calEvent } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", calendarEventId)
    .maybeSingle();

  if (!calEvent) throw new ValidationError("Calendar event not found");

  const connection = await getUserConnection(supabase, calEvent.user_id, calEvent.org_id);
  if (!connection) {
    return successResponse({ synced: false, reason: "no_connection" });
  }

  const accessToken = await getValidToken(connection, supabase);
  const calendarId = "primary";

  const { data: existingSync } = await supabase
    .from("calendar_event_sync")
    .select("*")
    .eq("calendar_event_id", calendarEventId)
    .eq("provider", "google")
    .maybeSingle();

  if (op === "delete" || calEvent.status === "cancelled") {
    if (existingSync?.external_event_id) {
      await deleteGoogleCalendarEventById(accessToken, calendarId, existingSync.external_event_id);
      await supabase.from("calendar_event_sync").delete().eq("id", existingSync.id);
    }
    return successResponse({ synced: true, operation: "deleted" });
  }

  const attendees = Array.isArray(calEvent.attendees)
    ? calEvent.attendees.map((a: { email?: string; name?: string }) => ({
        email: a.email, displayName: a.name,
      }))
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
    await supabase
      .from("calendar_event_sync")
      .update({ sync_status: "synced", last_error: null, updated_at: new Date().toISOString() })
      .eq("id", existingSync.id);
    return successResponse({ synced: true, operation: "updated" });
  }

  const googleEvent = await createGoogleCalendarEvent(accessToken, calendarId, eventPayload, !!generateMeet);

  const meetLink = googleEvent.conferenceData
    ? ((googleEvent.conferenceData as { entryPoints?: { entryPointType: string; uri: string }[] }).entryPoints || [])
        .find((ep) => ep.entryPointType === "video")?.uri
    : googleEvent.hangoutLink || null;

  await supabase
    .from("calendar_event_sync")
    .upsert({
      org_id: calEvent.org_id,
      calendar_event_id: calendarEventId,
      user_id: calEvent.user_id,
      provider: "google",
      external_event_id: googleEvent.id,
      google_calendar_id: calendarId,
      sync_status: "synced",
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "calendar_event_id,provider" });

  if (meetLink) {
    await supabase
      .from("calendar_events")
      .update({ google_meet_link: meetLink })
      .eq("id", calendarEventId);
  }

  return successResponse({ synced: true, operation: "created", googleEventId: googleEvent.id, meetLink });
}

async function handleSyncTask(req: Request, body: Record<string, unknown>): Promise<Response> {
  const supabase = getSupabaseClient();
  const userCtx = requireAuth(await extractUserContext(req, supabase));

  const { taskId, operation } = body as { taskId?: string; operation?: string };
  if (!taskId) throw new ValidationError("taskId is required");

  const op = operation || "create";

  const { data: task } = await supabase
    .from("calendar_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) throw new ValidationError("Task not found");

  const connection = await getUserConnection(supabase, task.user_id, task.org_id);
  if (!connection) {
    return successResponse({ synced: false, reason: "no_connection" });
  }

  const accessToken = await getValidToken(connection, supabase);
  const calendarId = "primary";

  const { data: existingSync } = await supabase
    .from("calendar_task_sync")
    .select("*")
    .eq("calendar_task_id", taskId)
    .eq("provider", "google")
    .maybeSingle();

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
    await supabase
      .from("calendar_task_sync")
      .update({ sync_status: "synced", last_error: null, updated_at: new Date().toISOString() })
      .eq("id", existingSync.id);
    return successResponse({ synced: true, operation: "updated" });
  }

  const googleEvent = await createGoogleCalendarEvent(accessToken, calendarId, eventPayload);

  await supabase
    .from("calendar_task_sync")
    .upsert({
      org_id: task.org_id,
      calendar_task_id: taskId,
      user_id: task.user_id,
      provider: "google",
      external_event_id: googleEvent.id,
      google_calendar_id: calendarId,
      sync_status: "synced",
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "calendar_task_id,provider" });

  return successResponse({ synced: true, operation: "created", googleEventId: googleEvent.id });
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
    if (action === "rsvp") {
      return await handleRsvp(req, body);
    }
    if (action === "sync-appointment") {
      return await handleSyncAppointment(req, body);
    }
    if (action === "sync-blocked-slot") {
      return await handleSyncBlockedSlot(req, body);
    }
    if (action === "sync-calendar-event") {
      return await handleSyncCalendarEvent(req, body);
    }
    if (action === "sync-task") {
      return await handleSyncTask(req, body);
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
  } catch (error) {
    return handleError(error);
  }
});
