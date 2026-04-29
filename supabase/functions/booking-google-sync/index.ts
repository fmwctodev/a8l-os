// booking-google-sync
//
// Pushes a booking to the assigned user's Google Calendar (with optional
// Google Meet link) and writes back the event id, meet link, and sync rows.
//
// Why this exists separate from google-calendar-sync:
// the larger google-calendar-sync function is gated by user JWT auth via
// requireAuth(extractUserContext(...)). The public booking flow has no JWT,
// so booking-api can't invoke it as a service-role caller. This function
// is service-role-only and contains just the booking-create / reschedule /
// delete paths, with all OAuth/crypto helpers inlined.
//
// Auth: caller MUST provide `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_ENCRYPTION_KEY_ENV = "GMAIL_ENCRYPTION_KEY";

type Operation = "create" | "update" | "reschedule" | "delete";

interface SyncBody {
  appointmentId?: string;
  operation?: Operation;
}

// ---------- Crypto helpers (mirrors _shared/crypto.ts) ----------

function isEncryptedToken(value: string): boolean {
  return typeof value === "string" && value.includes(":");
}

async function getKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get(GMAIL_ENCRYPTION_KEY_ENV);
  if (!keyHex) throw new Error(`${GMAIL_ENCRYPTION_KEY_ENV} not configured`);
  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
  );
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function decryptToken(encrypted: string): Promise<string> {
  const key = await getKey();
  const [ivHex, ctHex] = encrypted.split(":");
  if (!ivHex || !ctHex) throw new Error("Invalid encrypted token format");
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const ct = new Uint8Array(ctHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const out = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(out);
}

async function encryptToken(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const ctHex = Array.from(new Uint8Array(ct))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${ivHex}:${ctHex}`;
}

// ---------- Token refresh ----------

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
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

interface Connection {
  id: string;
  org_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  email: string;
}

async function getValidAccessToken(
  supabase: SupabaseClient,
  connection: Connection
): Promise<string> {
  const expiry = new Date(connection.token_expiry).getTime();
  const now = Date.now();

  if (expiry - now > 60 * 1000) {
    let token = connection.access_token;
    try {
      if (isEncryptedToken(token)) token = await decryptToken(token);
    } catch {
      // fall through using raw value
    }
    return token;
  }

  // Refresh
  let refreshTok = connection.refresh_token;
  try {
    if (isEncryptedToken(refreshTok)) refreshTok = await decryptToken(refreshTok);
  } catch {
    // fall through
  }
  const refreshed = await refreshAccessToken(refreshTok);
  if (!refreshed) throw new Error("Failed to refresh Google access token");

  const newExpiry = new Date(now + refreshed.expires_in * 1000).toISOString();
  let encNewAccess = refreshed.access_token;
  try {
    encNewAccess = await encryptToken(refreshed.access_token);
  } catch {
    // store raw
  }

  const updateData: Record<string, unknown> = {
    access_token: encNewAccess,
    token_expiry: newExpiry,
  };
  if (refreshed.refresh_token) {
    let encNewRefresh = refreshed.refresh_token;
    try {
      encNewRefresh = await encryptToken(refreshed.refresh_token);
    } catch {
      // store raw
    }
    updateData.refresh_token = encNewRefresh;
  }
  await supabase
    .from("google_calendar_connections")
    .update(updateData)
    .eq("id", connection.id);

  return refreshed.access_token;
}

// ---------- Google Calendar HTTP ----------

interface GoogleEvent {
  id: string;
  iCalUID?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string }[];
  };
  htmlLink?: string;
  etag?: string;
  updated?: string;
  organizer?: { email?: string; displayName?: string };
  attendees?: { email?: string; displayName?: string }[];
  extendedProperties?: Record<string, unknown>;
}

async function googleApiCall(
  method: string,
  url: string,
  accessToken: string,
  body?: unknown
): Promise<Response> {
  return await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
}

async function createEvent(
  accessToken: string,
  calendarId: string,
  payload: Record<string, unknown>,
  generateMeet: boolean
): Promise<GoogleEvent> {
  const url = new URL(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
  );
  url.searchParams.set("sendUpdates", "all");
  if (generateMeet) {
    url.searchParams.set("conferenceDataVersion", "1");
    payload.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  const resp = await googleApiCall("POST", url.toString(), accessToken, payload);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Calendar create failed (${resp.status}): ${text}`);
  }
  return await resp.json();
}

async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  payload: Record<string, unknown>
): Promise<GoogleEvent> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
    calendarId
  )}/events/${encodeURIComponent(eventId)}?sendUpdates=all`;
  const resp = await googleApiCall("PATCH", url, accessToken, payload);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Calendar patch failed (${resp.status}): ${text}`);
  }
  return await resp.json();
}

async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
    calendarId
  )}/events/${encodeURIComponent(eventId)}?sendUpdates=all`;
  const resp = await googleApiCall("DELETE", url, accessToken);
  if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
    const text = await resp.text();
    throw new Error(`Google Calendar delete failed (${resp.status}): ${text}`);
  }
}

function extractMeetLink(evt: GoogleEvent): string | null {
  const fromConf = evt.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === "video"
  )?.uri;
  return fromConf || evt.hangoutLink || null;
}

// ---------- Main handler ----------

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResp(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Service-role auth gate
    const auth = req.headers.get("Authorization") || "";
    if (auth !== `Bearer ${serviceRoleKey}`) {
      return jsonResp(401, { error: "Unauthorized" });
    }

    const { appointmentId, operation = "create" } = (await req.json()) as SyncBody;
    if (!appointmentId) {
      return jsonResp(400, { error: "appointmentId is required" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Load appointment + type + contact + parent calendar (for collective members)
    const { data: appointment, error: aptErr } = await supabase
      .from("appointments")
      .select(
        "id, org_id, calendar_id, assigned_user_id, start_at_utc, end_at_utc, status, notes, location, google_event_id, appointment_type:appointment_types(id, name, generate_google_meet, location_type, location_value), contact:contacts(id, first_name, last_name, email), calendar:calendars(id, type, settings, members:calendar_members(user_id, active))"
      )
      .eq("id", appointmentId)
      .maybeSingle();

    if (aptErr || !appointment) {
      return jsonResp(404, { error: "Appointment not found" });
    }

    if (!appointment.assigned_user_id) {
      return jsonResp(200, {
        success: true,
        data: { synced: false, reason: "no_assignee" },
      });
    }

    // For collective calendars, gather every active member's email so Google
    // copies the event onto each member's calendar via the attendee list.
    const calendarRow = appointment.calendar as {
      type?: string;
      settings?: { assignment_mode?: string } | null;
      members?: { user_id: string; active: boolean }[];
    } | null;
    const isCollective = calendarRow?.settings?.assignment_mode === "collective";
    let teamMemberEmails: string[] = [];
    if (isCollective && calendarRow?.members?.length) {
      const memberIds = calendarRow.members
        .filter((m) => m.active)
        .map((m) => m.user_id);
      if (memberIds.length > 0) {
        const { data: memberUsers } = await supabase
          .from("users")
          .select("id, email")
          .in("id", memberIds);
        teamMemberEmails = (memberUsers || [])
          .map((u: { email: string | null }) => u.email)
          .filter((e: string | null): e is string => !!e);
      }
    }

    // Load Google connection
    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select(
        "id, org_id, user_id, access_token, refresh_token, token_expiry, email"
      )
      .eq("user_id", appointment.assigned_user_id)
      .maybeSingle();

    if (!connection) {
      return jsonResp(200, {
        success: true,
        data: { synced: false, reason: "no_connection" },
      });
    }

    const accessToken = await getValidAccessToken(supabase, connection);
    const calendarId = "primary";

    // Existing sync record (so reschedule/delete know the Google event id)
    const { data: existingSync } = await supabase
      .from("appointment_sync")
      .select("id, external_event_id")
      .eq("appointment_id", appointmentId)
      .eq("provider", "google")
      .maybeSingle();

    const existingGoogleEventId =
      existingSync?.external_event_id || appointment.google_event_id || null;

    // ---- DELETE branch ----
    if (operation === "delete" || appointment.status === "canceled") {
      if (existingGoogleEventId) {
        try {
          await deleteEvent(accessToken, calendarId, existingGoogleEventId);
        } catch (e) {
          console.error("delete event failed:", (e as Error).message);
        }
        if (existingSync) {
          await supabase
            .from("appointment_sync")
            .update({
              sync_status: "synced",
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSync.id);
        }
        await supabase
          .from("calendar_event_map")
          .update({
            is_deleted: true,
            sync_status: "synced",
            updated_at: new Date().toISOString(),
          })
          .eq("connection_id", connection.id)
          .eq("google_event_id", existingGoogleEventId);
      }
      return jsonResp(200, {
        success: true,
        data: { synced: true, operation: "deleted" },
      });
    }

    const apptType = appointment.appointment_type as {
      name: string;
      generate_google_meet: boolean;
      location_type: string | null;
      location_value: { address?: string } | null;
    } | null;
    const contact = appointment.contact as {
      first_name?: string;
      last_name?: string;
      email?: string;
    } | null;

    const generateMeet =
      !!apptType?.generate_google_meet && apptType?.location_type === "google_meet";

    const summary = `${apptType?.name || "Appointment"} - ${
      contact?.first_name || "Guest"
    } ${contact?.last_name || ""}`.trim();

    const attendeeEmails = new Set<string>();
    if (contact?.email) attendeeEmails.add(contact.email.toLowerCase());
    for (const email of teamMemberEmails) {
      attendeeEmails.add(email.toLowerCase());
    }
    // Don't invite the organizer to their own event (Google does that implicitly)
    const { data: organizerUser } = await supabase
      .from("users")
      .select("email")
      .eq("id", appointment.assigned_user_id)
      .maybeSingle();
    if (organizerUser?.email) attendeeEmails.delete(organizerUser.email.toLowerCase());
    const attendees = Array.from(attendeeEmails).map((email) => ({ email }));

    const eventPayload: Record<string, unknown> = {
      summary,
      description: `Booked via CRM\n${appointment.notes || ""}`.trim(),
      start: { dateTime: appointment.start_at_utc, timeZone: "UTC" },
      end: { dateTime: appointment.end_at_utc, timeZone: "UTC" },
      attendees: attendees.length > 0 ? attendees : undefined,
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      extendedProperties: {
        private: {
          autom8ion_workspace_id: appointment.org_id,
          autom8ion_user_id: appointment.assigned_user_id,
          autom8ion_appointment_id: appointment.id,
        },
      },
    };
    if (appointment.location || apptType?.location_value?.address) {
      eventPayload.location =
        appointment.location || apptType?.location_value?.address;
    }

    // ---- UPDATE / RESCHEDULE branch ----
    if (
      existingGoogleEventId &&
      (operation === "update" || operation === "reschedule")
    ) {
      const updated = await patchEvent(
        accessToken,
        calendarId,
        existingGoogleEventId,
        eventPayload
      );
      const now = new Date().toISOString();
      if (existingSync) {
        await supabase
          .from("appointment_sync")
          .update({
            sync_status: "synced",
            last_error: null,
            updated_at: now,
          })
          .eq("id", existingSync.id);
      }
      await supabase
        .from("calendar_event_map")
        .upsert(
          {
            org_id: appointment.org_id,
            connection_id: connection.id,
            user_id: appointment.assigned_user_id,
            appointment_id: appointment.id,
            calendar_id: calendarId,
            google_event_id: existingGoogleEventId,
            etag: updated.etag || null,
            last_google_updated_at: updated.updated
              ? new Date(updated.updated).toISOString()
              : now,
            last_crm_updated_at: now,
            sync_direction: "to_google",
            sync_status: "synced",
            is_deleted: false,
            updated_at: now,
          },
          { onConflict: "connection_id,google_event_id" }
        );
      return jsonResp(200, {
        success: true,
        data: {
          synced: true,
          operation: "updated",
          googleEventId: existingGoogleEventId,
        },
      });
    }

    // ---- CREATE branch ----
    const created = await createEvent(
      accessToken,
      calendarId,
      eventPayload,
      generateMeet
    );
    const meetLink = extractMeetLink(created);
    const now = new Date().toISOString();

    await supabase
      .from("appointment_sync")
      .upsert(
        {
          org_id: appointment.org_id,
          appointment_id: appointment.id,
          user_id: appointment.assigned_user_id,
          provider: "google",
          external_event_id: created.id,
          google_calendar_id: calendarId,
          sync_status: "synced",
          last_error: null,
          updated_at: now,
        },
        { onConflict: "appointment_id,provider" }
      );

    await supabase.from("calendar_event_map").upsert(
      {
        org_id: appointment.org_id,
        connection_id: connection.id,
        user_id: appointment.assigned_user_id,
        appointment_id: appointment.id,
        calendar_id: calendarId,
        google_event_id: created.id,
        ical_uid: created.iCalUID || null,
        etag: created.etag || null,
        last_google_updated_at: created.updated
          ? new Date(created.updated).toISOString()
          : now,
        last_crm_updated_at: now,
        sync_direction: "to_google",
        sync_status: "synced",
        is_deleted: false,
        updated_at: now,
      },
      { onConflict: "connection_id,google_event_id" }
    );

    const updateAppt: Record<string, unknown> = {
      google_event_id: created.id,
    };
    if (meetLink) updateAppt.google_meet_link = meetLink;
    await supabase
      .from("appointments")
      .update(updateAppt)
      .eq("id", appointment.id);

    return jsonResp(200, {
      success: true,
      data: {
        synced: true,
        operation: "created",
        googleEventId: created.id,
        meetLink,
      },
    });
  } catch (error) {
    console.error("booking-google-sync error:", error);
    return jsonResp(500, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
