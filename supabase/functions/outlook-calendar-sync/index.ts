import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse, successResponse } from "../_shared/cors.ts";
import { extractUserContext } from "../_shared/auth.ts";
import { getAccessToken, graphRequest, GRAPH_BASE } from "../_shared/microsoft-graph-helpers.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalendarEventPayload {
  subject: string;
  body?: { contentType?: string; content?: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: string;
  attendees?: Array<{
    emailAddress: { address: string; name?: string };
    type?: string;
  }>;
  recurrence?: Record<string, unknown>;
}

interface ScheduleRequest {
  schedules: string[];
  startTime: { dateTime: string; timeZone: string };
  endTime: { dateTime: string; timeZone: string };
  availabilityViewInterval?: number;
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userContext = await extractUserContext(req, supabase);
    if (!userContext) {
      return errorResponse("AUTH_REQUIRED", "Authentication required", 401);
    }

    const { accessToken } = await getAccessToken(supabase, userContext.id);

    const body = req.method !== "GET" ? await req.json() : {};
    const action: string = body.action || new URL(req.url).searchParams.get("action") || "sync";

    switch (action) {
      case "sync":
        return await handleSync(supabase, userContext.id, userContext.orgId, accessToken, body);
      case "create-event":
        return await handleCreateEvent(accessToken, body);
      case "update-event":
        return await handleUpdateEvent(accessToken, body);
      case "delete-event":
        return await handleDeleteEvent(accessToken, body);
      case "get-schedule":
        return await handleGetSchedule(accessToken, body);
      default:
        return errorResponse("INVALID_ACTION", `Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("[outlook-calendar-sync] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
});

// ─── Sync (Delta Query) ─────────────────────────────────────────────────────

async function handleSync(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  // Determine date range (default: 30 days back, 90 days forward)
  const now = new Date();
  const startDateTime =
    (body.startDateTime as string) ||
    new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDateTime =
    (body.endDateTime as string) ||
    new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // Check for existing delta token
  const { data: connection } = await supabase
    .from("microsoft_calendar_connections")
    .select("delta_token, last_synced_at")
    .eq("user_id", userId)
    .maybeSingle();

  let deltaUrl: string;
  if (connection?.delta_token) {
    // Incremental sync with delta token
    deltaUrl = connection.delta_token;
  } else {
    // Full initial sync
    const params = new URLSearchParams({
      startDateTime,
      endDateTime,
      $select:
        "id,subject,bodyPreview,start,end,location,organizer,attendees,isOnlineMeeting,onlineMeetingUrl,webLink,isCancelled,showAs,recurrence,sensitivity",
      $top: "100",
    });
    deltaUrl = `${GRAPH_BASE}/me/calendarView/delta?${params.toString()}`;
  }

  let totalProcessed = 0;
  let totalRemoved = 0;
  let nextDeltaLink: string | null = null;

  // Page through delta results
  let currentUrl: string | null = deltaUrl;
  while (currentUrl) {
    const { status, data } = await graphRequest(accessToken, currentUrl, "GET");

    if (status !== 200) {
      // If delta token is expired, do a full re-sync
      if (status === 410 && connection?.delta_token) {
        console.warn("[outlook-calendar-sync] Delta token expired, performing full sync");
        await supabase
          .from("microsoft_calendar_connections")
          .update({ delta_token: null, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        return handleSync(supabase, userId, orgId, accessToken, { ...body, _retry: true });
      }
      console.error("[outlook-calendar-sync] Graph API error:", status, data);
      return errorResponse("GRAPH_ERROR", `Graph API returned ${status}`, status);
    }

    const response = data as {
      value?: Array<Record<string, unknown>>;
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    };

    const events = response.value || [];

    for (const event of events) {
      // Handle removed events (delta returns @removed for deleted items)
      if (event["@removed"]) {
        const { error: delError } = await supabase
          .from("calendar_events")
          .delete()
          .eq("provider_event_id", event.id as string)
          .eq("user_id", userId);

        if (!delError) totalRemoved++;
        continue;
      }

      // Map Graph event to local schema
      const startObj = event.start as { dateTime?: string; timeZone?: string } | undefined;
      const endObj = event.end as { dateTime?: string; timeZone?: string } | undefined;
      const locationObj = event.location as { displayName?: string } | undefined;
      const organizerObj = event.organizer as {
        emailAddress?: { address?: string; name?: string };
      } | undefined;

      const attendeesList = (event.attendees as Array<{
        emailAddress?: { address?: string; name?: string };
        status?: { response?: string };
      }>) || [];

      const mappedEvent = {
        user_id: userId,
        organization_id: orgId,
        provider: "microsoft",
        provider_event_id: event.id as string,
        title: (event.subject as string) || "Untitled",
        description: (event.bodyPreview as string) || null,
        start_time: startObj?.dateTime || null,
        end_time: endObj?.dateTime || null,
        start_timezone: startObj?.timeZone || "UTC",
        end_timezone: endObj?.timeZone || "UTC",
        location: locationObj?.displayName || null,
        organizer_email: organizerObj?.emailAddress?.address || null,
        organizer_name: organizerObj?.emailAddress?.name || null,
        attendees: attendeesList.map((a) => ({
          email: a.emailAddress?.address,
          name: a.emailAddress?.name,
          response: a.status?.response,
        })),
        is_online_meeting: (event.isOnlineMeeting as boolean) || false,
        online_meeting_url: (event.onlineMeetingUrl as string) || null,
        web_link: (event.webLink as string) || null,
        is_cancelled: (event.isCancelled as boolean) || false,
        show_as: (event.showAs as string) || null,
        sensitivity: (event.sensitivity as string) || "normal",
        has_recurrence: !!event.recurrence,
        raw_data: event,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from("calendar_events")
        .upsert(mappedEvent, { onConflict: "user_id,provider,provider_event_id" });

      if (upsertError) {
        console.error("[outlook-calendar-sync] Upsert failed:", upsertError);
      } else {
        totalProcessed++;
      }
    }

    // Follow pagination or capture delta link
    if (response["@odata.nextLink"]) {
      currentUrl = response["@odata.nextLink"];
    } else {
      nextDeltaLink = response["@odata.deltaLink"] || null;
      currentUrl = null;
    }
  }

  // Store delta token for next incremental sync
  if (nextDeltaLink) {
    await supabase
      .from("microsoft_calendar_connections")
      .update({
        delta_token: nextDeltaLink,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  return successResponse({
    synced: totalProcessed,
    removed: totalRemoved,
    incremental: !!connection?.delta_token,
    nextSyncHasDelta: !!nextDeltaLink,
  });
}

// ─── Create Event ────────────────────────────────────────────────────────────

async function handleCreateEvent(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const payload: CalendarEventPayload = {
    subject: body.subject as string,
    start: body.start as CalendarEventPayload["start"],
    end: body.end as CalendarEventPayload["end"],
  };

  if (body.body) {
    payload.body = body.body as CalendarEventPayload["body"];
  } else if (body.description) {
    payload.body = {
      contentType: "HTML",
      content: body.description as string,
    };
  }

  if (body.location) {
    payload.location = { displayName: body.location as string };
  }

  if (body.attendees) {
    payload.attendees = (body.attendees as Array<{ email: string; name?: string }>).map(
      (a) => ({
        emailAddress: { address: a.email, name: a.name },
        type: "required",
      })
    );
  }

  if (body.isOnlineMeeting) {
    payload.isOnlineMeeting = true;
    payload.onlineMeetingProvider = "teamsForBusiness";
  }

  if (body.recurrence) {
    payload.recurrence = body.recurrence as Record<string, unknown>;
  }

  const { status, data } = await graphRequest(
    accessToken,
    "/me/calendar/events",
    "POST",
    payload as unknown as Record<string, unknown>
  );

  if (status !== 201 && status !== 200) {
    console.error("[outlook-calendar-sync] Create event failed:", status, data);
    return errorResponse("CREATE_FAILED", `Failed to create event: ${status}`, status);
  }

  return successResponse(data);
}

// ─── Update Event ────────────────────────────────────────────────────────────

async function handleUpdateEvent(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const eventId = body.eventId as string;
  if (!eventId) {
    return errorResponse("MISSING_PARAM", "eventId is required");
  }

  // Build patch payload from provided fields
  const patch: Record<string, unknown> = {};
  if (body.subject !== undefined) patch.subject = body.subject;
  if (body.body !== undefined) patch.body = body.body;
  if (body.description !== undefined) {
    patch.body = { contentType: "HTML", content: body.description };
  }
  if (body.start !== undefined) patch.start = body.start;
  if (body.end !== undefined) patch.end = body.end;
  if (body.location !== undefined) {
    patch.location = { displayName: body.location };
  }
  if (body.isOnlineMeeting !== undefined) {
    patch.isOnlineMeeting = body.isOnlineMeeting;
    if (body.isOnlineMeeting) {
      patch.onlineMeetingProvider = "teamsForBusiness";
    }
  }
  if (body.attendees !== undefined) {
    patch.attendees = (body.attendees as Array<{ email: string; name?: string }>).map(
      (a) => ({
        emailAddress: { address: a.email, name: a.name },
        type: "required",
      })
    );
  }

  const { status, data } = await graphRequest(
    accessToken,
    `/me/calendar/events/${eventId}`,
    "PATCH",
    patch
  );

  if (status !== 200) {
    console.error("[outlook-calendar-sync] Update event failed:", status, data);
    return errorResponse("UPDATE_FAILED", `Failed to update event: ${status}`, status);
  }

  return successResponse(data);
}

// ─── Delete Event ────────────────────────────────────────────────────────────

async function handleDeleteEvent(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const eventId = body.eventId as string;
  if (!eventId) {
    return errorResponse("MISSING_PARAM", "eventId is required");
  }

  const { status, data } = await graphRequest(
    accessToken,
    `/me/calendar/events/${eventId}`,
    "DELETE"
  );

  if (status !== 204 && status !== 200) {
    console.error("[outlook-calendar-sync] Delete event failed:", status, data);
    return errorResponse("DELETE_FAILED", `Failed to delete event: ${status}`, status);
  }

  return successResponse({ deleted: true, eventId });
}

// ─── Get Schedule (Free/Busy) ────────────────────────────────────────────────

async function handleGetSchedule(
  accessToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const schedules = body.schedules as string[];
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    return errorResponse("MISSING_PARAM", "schedules (array of emails) is required");
  }

  const startTime = body.startTime as ScheduleRequest["startTime"];
  const endTime = body.endTime as ScheduleRequest["endTime"];
  if (!startTime || !endTime) {
    return errorResponse("MISSING_PARAM", "startTime and endTime are required");
  }

  const schedulePayload: ScheduleRequest = {
    schedules,
    startTime,
    endTime,
    availabilityViewInterval: (body.availabilityViewInterval as number) || 30,
  };

  const { status, data } = await graphRequest(
    accessToken,
    "/me/calendar/getSchedule",
    "POST",
    schedulePayload as unknown as Record<string, unknown>
  );

  if (status !== 200) {
    console.error("[outlook-calendar-sync] Get schedule failed:", status, data);
    return errorResponse("SCHEDULE_FAILED", `Failed to get schedule: ${status}`, status);
  }

  return successResponse(data);
}
