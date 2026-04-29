import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TimeRange {
  start: string;
  end: string;
}

interface DateOverride {
  date: string;
  available: boolean;
  ranges?: TimeRange[];
}

interface DaySchedule {
  [key: string]: TimeRange[];
}

interface AvailabilitySlot {
  start: string;
  end: string;
  eligible_user_ids: string[];
}

function enqueueBookingEmail(
  appointmentId: string,
  action: "confirmation" | "rescheduled" | "canceled"
): void {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return;
    fetch(`${supabaseUrl}/functions/v1/booking-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ appointment_id: appointmentId, action }),
    }).catch((err) => console.error("booking-email enqueue failed:", err));
  } catch (err) {
    console.error("booking-email enqueue error:", err);
  }
}

type GoogleSyncOperation = "create" | "update" | "reschedule" | "delete";

interface GoogleSyncResult {
  synced: boolean;
  meetLink?: string | null;
  googleEventId?: string | null;
  reason?: string;
}

async function syncAppointmentToGoogle(
  appointmentId: string,
  operation: GoogleSyncOperation
): Promise<GoogleSyncResult | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return null;

    const res = await fetch(`${supabaseUrl}/functions/v1/booking-google-sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "sync-appointment",
        appointmentId,
        operation,
      }),
    });

    if (!res.ok) {
      console.error("booking-google-sync returned non-OK:", res.status);
      return { synced: false };
    }
    const json = (await res.json()) as { success?: boolean; data?: GoogleSyncResult };
    return json?.data || { synced: false };
  } catch (err) {
    console.error("booking-google-sync await error:", err);
    return { synced: false };
  }
}

function enqueueGoogleSync(
  appointmentId: string,
  operation: GoogleSyncOperation
): void {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return;
    fetch(`${supabaseUrl}/functions/v1/booking-google-sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "sync-appointment",
        appointmentId,
        operation,
      }),
    }).catch((err) => console.error("booking-google-sync enqueue failed:", err));
  } catch (err) {
    console.error("booking-google-sync enqueue error:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    if (req.method === "GET" && action === "availability") {
      return handleGetAvailability(req, supabase);
    }

    if (req.method === "GET" && action === "calendar") {
      return handleGetCalendarInfo(req, supabase);
    }

    if (req.method === "GET" && action === "calendar-types") {
      return handleGetCalendarTypes(req, supabase);
    }

    if (req.method === "POST" && action === "book") {
      return handleSubmitBooking(req, supabase);
    }

    if (req.method === "POST" && action === "reschedule") {
      return handleReschedule(req, supabase);
    }

    if (req.method === "POST" && action === "cancel") {
      return handleCancel(req, supabase);
    }

    if (req.method === "GET" && action === "appointment") {
      return handleGetAppointment(req, supabase);
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Booking API error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function handleGetCalendarTypes(
  req: Request,
  supabase: ReturnType<typeof createClient>
) {
  const url = new URL(req.url);
  const calendarSlug = url.searchParams.get("calendar_slug");

  if (!calendarSlug) {
    return new Response(
      JSON.stringify({ error: "Missing calendar_slug" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id, name, slug, description")
    .eq("slug", calendarSlug)
    .maybeSingle();

  if (!calendar) {
    return new Response(
      JSON.stringify({ error: "Calendar not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: appointmentTypes } = await supabase
    .from("appointment_types")
    .select("id, name, slug, description, duration_minutes, location_type")
    .eq("calendar_id", calendar.id)
    .eq("active", true)
    .order("name");

  return new Response(
    JSON.stringify({
      calendar: { id: calendar.id, name: calendar.name, slug: calendar.slug, description: calendar.description },
      appointment_types: appointmentTypes || [],
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleGetCalendarInfo(
  req: Request,
  supabase: ReturnType<typeof createClient>
) {
  const url = new URL(req.url);
  const calendarSlug = url.searchParams.get("calendar_slug");
  const appointmentTypeSlug = url.searchParams.get("type_slug");

  if (!calendarSlug || !appointmentTypeSlug) {
    return new Response(
      JSON.stringify({ error: "Missing calendar_slug or type_slug" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: calendar } = await supabase
    .from("calendars")
    .select(
      "id, name, slug, org_id, type, owner_user_id, settings, members:calendar_members(user_id, active)"
    )
    .eq("slug", calendarSlug)
    .maybeSingle();

  if (!calendar) {
    return new Response(
      JSON.stringify({ error: "Calendar not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: appointmentType } = await supabase
    .from("appointment_types")
    .select("*")
    .eq("calendar_id", calendar.id)
    .eq("slug", appointmentTypeSlug)
    .eq("active", true)
    .maybeSingle();

  if (!appointmentType) {
    return new Response(
      JSON.stringify({ error: "Appointment type not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const settings = calendar.settings as { assignment_mode?: string } | null;
  const isCollective = settings?.assignment_mode === "collective";
  const isUserCalendar = calendar.type === "user" && !!calendar.owner_user_id;

  function makeInitials(name: string): string {
    return (name || "TM")
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  let collectiveMembers: Array<{ name: string; initials: string }> = [];
  let host: { name: string; initials: string } | undefined;

  if (isUserCalendar) {
    const { data: ownerUser } = await supabase
      .from("users")
      .select("id, name")
      .eq("id", calendar.owner_user_id)
      .maybeSingle();
    if (ownerUser) {
      const ownerName = ownerUser.name || "Host";
      host = { name: ownerName, initials: makeInitials(ownerName) };
    }
  }

  if (isCollective) {
    const members = (calendar.members as Array<{ user_id: string; active: boolean }>) || [];
    const activeMembers = members.filter((m) => m.active);

    if (activeMembers.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name")
        .in("id", activeMembers.map((m) => m.user_id));

      collectiveMembers = (users || []).map((u) => ({
        name: u.name || "Team Member",
        initials: makeInitials(u.name || "TM"),
      }));
    }
  }

  return new Response(
    JSON.stringify({
      calendar: {
        id: calendar.id,
        name: calendar.name,
        slug: calendar.slug,
        type: calendar.type,
        is_collective: isCollective,
        collective_members: isCollective ? collectiveMembers : undefined,
        host,
      },
      appointment_type: {
        id: appointmentType.id,
        name: appointmentType.name,
        slug: appointmentType.slug,
        description: appointmentType.description,
        duration_minutes: appointmentType.duration_minutes,
        location_type: appointmentType.location_type,
        location_value: appointmentType.location_value,
        questions: appointmentType.questions,
        booking_window_days: appointmentType.booking_window_days,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleGetAvailability(
  req: Request,
  supabase: ReturnType<typeof createClient>
) {
  const url = new URL(req.url);
  const calendarId = url.searchParams.get("calendar_id");
  const appointmentTypeId = url.searchParams.get("type_id");
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");
  const timezone = url.searchParams.get("timezone") || "America/New_York";

  if (!calendarId || !appointmentTypeId || !startDate || !endDate) {
    return new Response(
      JSON.stringify({ error: "Missing required parameters" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: appointmentType } = await supabase
    .from("appointment_types")
    .select("*")
    .eq("id", appointmentTypeId)
    .single();

  if (!appointmentType) {
    return new Response(
      JSON.stringify({ error: "Appointment type not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: calendar } = await supabase
    .from("calendars")
    .select("*, members:calendar_members(*)")
    .eq("id", calendarId)
    .single();

  if (!calendar) {
    return new Response(
      JSON.stringify({ error: "Calendar not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: availabilityRules } = await supabase
    .from("availability_rules")
    .select("*")
    .eq("calendar_id", calendarId);

  const rules = availabilityRules || [];

  const eligibleUserIds = getEligibleUserIds(calendar);

  const busyBlocks = await getBusyBlocks(supabase, calendar, startDate, endDate);

  const settings = calendar.settings as { assignment_mode?: string } | null;
  const isCollective = settings?.assignment_mode === "collective";

  const slots = generateSlots(
    startDate,
    endDate,
    calendar,
    rules,
    appointmentType,
    eligibleUserIds,
    busyBlocks,
    isCollective
  );

  return new Response(
    JSON.stringify({ slots }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

function getEligibleUserIds(calendar: Record<string, unknown>): string[] {
  if (calendar.type === "user" && calendar.owner_user_id) {
    return [calendar.owner_user_id as string];
  }

  const members = (calendar.members as Array<{ active: boolean; user_id: string }>) || [];
  return members.filter((m) => m.active).map((m) => m.user_id);
}

async function getBusyBlocks(
  supabase: ReturnType<typeof createClient>,
  calendar: Record<string, unknown>,
  startDate: string,
  endDate: string
): Promise<Array<{ userId: string; start: Date; end: Date }>> {
  const busyBlocks: Array<{ userId: string; start: Date; end: Date }> = [];

  const eligibleUserIds = getEligibleUserIds(calendar);

  const { data: existingAppointments } = await supabase
    .from("appointments")
    .select("assigned_user_id, start_at_utc, end_at_utc")
    .eq("calendar_id", calendar.id)
    .eq("status", "scheduled")
    .gte("start_at_utc", startDate)
    .lte("start_at_utc", endDate);

  for (const apt of existingAppointments || []) {
    if (apt.assigned_user_id) {
      busyBlocks.push({
        userId: apt.assigned_user_id,
        start: new Date(apt.start_at_utc),
        end: new Date(apt.end_at_utc),
      });
    }
  }

  if (eligibleUserIds.length > 0) {
    const { data: googleEvents } = await supabase
      .from("google_calendar_events")
      .select("user_id, start_time, end_time, status, all_day, appointment_id, transparency")
      .in("user_id", eligibleUserIds)
      .gte("end_time", startDate)
      .lte("start_time", endDate);

    for (const evt of googleEvents || []) {
      if (!evt.user_id || !evt.start_time || !evt.end_time) continue;
      if (evt.status === "cancelled") continue;
      if (evt.appointment_id) continue;
      if (evt.transparency === "transparent") continue;
      busyBlocks.push({
        userId: evt.user_id,
        start: new Date(evt.start_time),
        end: new Date(evt.end_time),
      });
    }
  }

  const { data: blockedSlots } = await supabase
    .from("blocked_slots")
    .select("user_id, start_at_utc, end_at_utc")
    .eq("calendar_id", calendar.id)
    .gte("end_at_utc", startDate)
    .lte("start_at_utc", endDate);

  for (const slot of blockedSlots || []) {
    const start = new Date(slot.start_at_utc);
    const end = new Date(slot.end_at_utc);
    if (slot.user_id) {
      busyBlocks.push({ userId: slot.user_id, start, end });
    } else {
      for (const userId of eligibleUserIds) {
        busyBlocks.push({ userId, start, end });
      }
    }
  }

  return busyBlocks;
}

function dateStrInZone(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayOfWeekInZone(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" })
    .format(d)
    .toLowerCase();
}

function dateInZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string
): Date {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(naiveUtcMs));
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10);
  const h = get("hour") % 24;
  const tzMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    h,
    get("minute"),
    get("second")
  );
  const offsetMs = tzMs - naiveUtcMs;
  return new Date(naiveUtcMs - offsetMs);
}

function generateSlots(
  startDate: string,
  endDate: string,
  calendar: Record<string, unknown>,
  rules: Array<Record<string, unknown>>,
  appointmentType: Record<string, unknown>,
  eligibleUserIds: string[],
  busyBlocks: Array<{ userId: string; start: Date; end: Date }>,
  isCollective: boolean
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const now = new Date();
  const minNoticeTime = new Date(
    now.getTime() + (appointmentType.min_notice_minutes as number) * 60 * 1000
  );

  const calendarLevelRule = rules.find((r) => r.user_id === null) || rules[0];
  if (!calendarLevelRule) return slots;

  const ruleTimezone =
    (calendarLevelRule.timezone as string) || "America/New_York";
  const seenDates = new Set<string>();

  for (
    let cursor = new Date(startDateObj);
    cursor <= endDateObj;
    cursor = new Date(cursor.getTime() + 86400000)
  ) {
    const noonUtc = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate(),
        12,
        0
      )
    );
    const dateStr = dateStrInZone(noonUtc, ruleTimezone);
    if (seenDates.has(dateStr)) continue;
    seenDates.add(dateStr);

    const dayOfWeek = dayOfWeekInZone(noonUtc, ruleTimezone);

    const dayRanges = getDayRanges(calendarLevelRule, dateStr, dayOfWeek);
    if (dayRanges.length === 0) continue;

    const [yyyy, mm, dd] = dateStr.split("-").map(Number);

    for (const range of dayRanges) {
      const [sh, sm] = range.start.split(":").map(Number);
      const [eh, em] = range.end.split(":").map(Number);
      const rangeStart = dateInZone(yyyy, mm, dd, sh, sm, ruleTimezone);
      const rangeEnd = dateInZone(yyyy, mm, dd, eh, em, ruleTimezone);

      let current = new Date(rangeStart);
      const durationMs = (appointmentType.duration_minutes as number) * 60 * 1000;
      const intervalMs = (appointmentType.slot_interval_minutes as number) * 60 * 1000;

      while (current.getTime() + durationMs <= rangeEnd.getTime()) {
        const slotEnd = new Date(current.getTime() + durationMs);

        if (current < minNoticeTime) {
          current = new Date(current.getTime() + intervalMs);
          continue;
        }

        const bufferBefore = (appointmentType.buffer_before_minutes as number) * 60 * 1000;
        const bufferAfter = (appointmentType.buffer_after_minutes as number) * 60 * 1000;
        const bufferedStart = new Date(current.getTime() - bufferBefore);
        const bufferedEnd = new Date(slotEnd.getTime() + bufferAfter);

        const availableUserIds: string[] = [];

        for (const userId of eligibleUserIds) {
          const userRule = rules.find((r) => r.user_id === userId);
          const effectiveRule = userRule || calendarLevelRule;
          const memberTz = (effectiveRule.timezone as string) || ruleTimezone;
          const memberDayRanges = getDayRanges(
            effectiveRule,
            dateStr,
            dayOfWeek
          );

          const withinMemberSchedule = memberDayRanges.some((mr) => {
            const [msh, msm] = mr.start.split(":").map(Number);
            const [meh, mem] = mr.end.split(":").map(Number);
            const mStart = dateInZone(yyyy, mm, dd, msh, msm, memberTz);
            const mEnd = dateInZone(yyyy, mm, dd, meh, mem, memberTz);
            return current >= mStart && slotEnd <= mEnd;
          });

          if (!withinMemberSchedule) continue;

          const userBusyBlocks = busyBlocks.filter((b) => b.userId === userId);
          const hasConflict = userBusyBlocks.some(
            (b) => bufferedStart < b.end && bufferedEnd > b.start
          );

          if (!hasConflict) {
            availableUserIds.push(userId);
          }
        }

        if (isCollective) {
          if (availableUserIds.length === eligibleUserIds.length && eligibleUserIds.length > 0) {
            slots.push({
              start: current.toISOString(),
              end: slotEnd.toISOString(),
              eligible_user_ids: availableUserIds,
            });
          }
        } else {
          if (availableUserIds.length > 0) {
            slots.push({
              start: current.toISOString(),
              end: slotEnd.toISOString(),
              eligible_user_ids: availableUserIds,
            });
          }
        }

        current = new Date(current.getTime() + intervalMs);
      }
    }
  }

  return slots;
}

function getDayRanges(
  rule: Record<string, unknown>,
  dateStr: string,
  dayOfWeek: string
): TimeRange[] {
  const overrides = (rule.overrides as DateOverride[]) || [];
  const override = overrides.find((o) => o.date === dateStr);

  if (override) {
    if (!override.available) return [];
    return override.ranges || [];
  }

  const schedule = rule.rules as DaySchedule;
  return schedule[dayOfWeek] || [];
}

async function handleSubmitBooking(
  req: Request,
  supabase: ReturnType<typeof createClient>
) {
  const body = await req.json();
  const {
    calendar_id: calendarId,
    appointment_type_id: appointmentTypeId,
    start_utc: startUtc,
    end_utc: endUtc,
    visitor_timezone: visitorTimezone,
    answers,
  } = body;

  if (!calendarId || !appointmentTypeId || !startUtc || !endUtc || !answers) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: calendar } = await supabase
    .from("calendars")
    .select("*, members:calendar_members(*)")
    .eq("id", calendarId)
    .single();

  if (!calendar) {
    return new Response(
      JSON.stringify({ error: "Calendar not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: appointmentType } = await supabase
    .from("appointment_types")
    .select("*")
    .eq("id", appointmentTypeId)
    .single();

  if (!appointmentType) {
    return new Response(
      JSON.stringify({ error: "Appointment type not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const eligibleUserIds = getEligibleUserIds(calendar);
  const assignedUserId = await assignUser(
    supabase,
    calendar,
    eligibleUserIds,
    startUtc,
    appointmentType.max_per_day
  );

  let contactId = null;
  if (answers.email || answers.phone) {
    contactId = await findOrCreateContact(
      supabase,
      calendar.org_id,
      calendar.department_id,
      answers
    );
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      org_id: calendar.org_id,
      calendar_id: calendarId,
      appointment_type_id: appointmentTypeId,
      contact_id: contactId,
      assigned_user_id: assignedUserId,
      start_at_utc: startUtc,
      end_at_utc: endUtc,
      visitor_timezone: visitorTimezone || "America/New_York",
      answers,
      source: "booking",
      status: "scheduled",
      history: [{ action: "created", timestamp: new Date().toISOString() }],
    })
    .select()
    .single();

  if (appointmentError) {
    console.error("Failed to create appointment:", appointmentError);
    return new Response(
      JSON.stringify({ error: "Failed to create appointment" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (contactId) {
    await supabase.from("contact_timeline_events").insert({
      contact_id: contactId,
      event_type: "appointment_booked",
      event_data: {
        appointment_id: appointment.id,
        start_time: startUtc,
        appointment_type: appointmentType.name,
      },
    });
  }

  const syncResult = await syncAppointmentToGoogle(appointment.id, "create");
  const googleMeetLink = syncResult?.meetLink || null;

  enqueueBookingEmail(appointment.id, "confirmation");

  return new Response(
    JSON.stringify({
      success: true,
      appointment: {
        id: appointment.id,
        start_at_utc: appointment.start_at_utc,
        end_at_utc: appointment.end_at_utc,
        reschedule_token: appointment.reschedule_token,
        cancel_token: appointment.cancel_token,
        google_meet_link: googleMeetLink,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function assignUser(
  supabase: ReturnType<typeof createClient>,
  calendar: Record<string, unknown>,
  eligibleUserIds: string[],
  startUtc: string,
  maxPerDay: number | null
): Promise<string> {
  if (calendar.type === "user" && calendar.owner_user_id) {
    return calendar.owner_user_id as string;
  }

  const members = (calendar.members as Array<{
    active: boolean;
    user_id: string;
    weight: number;
    priority: number;
  }>) || [];

  let activeMembers = members.filter(
    (m) => m.active && eligibleUserIds.includes(m.user_id)
  );

  if (activeMembers.length === 0) {
    throw new Error("No team members available");
  }

  if (maxPerDay) {
    const dayStart = startUtc.split("T")[0] + "T00:00:00.000Z";
    const dayEnd = startUtc.split("T")[0] + "T23:59:59.999Z";

    const filteredMembers = [];
    for (const member of activeMembers) {
      const { count } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("calendar_id", calendar.id)
        .eq("assigned_user_id", member.user_id)
        .eq("status", "scheduled")
        .gte("start_at_utc", dayStart)
        .lt("start_at_utc", dayEnd);

      if ((count || 0) < maxPerDay) {
        filteredMembers.push(member);
      }
    }

    if (filteredMembers.length === 0) {
      throw new Error("All team members have reached their daily limit");
    }

    activeMembers = filteredMembers;
  }

  const settings = calendar.settings as { assignment_mode: string; last_assigned_index: number };

  if (settings.assignment_mode === "collective") {
    return activeMembers[0].user_id;
  }

  if (settings.assignment_mode === "priority") {
    const sorted = [...activeMembers].sort((a, b) => b.priority - a.priority);
    return sorted[0].user_id;
  }

  const totalWeight = activeMembers.reduce((sum, m) => sum + m.weight, 0);
  const expandedList: string[] = [];
  for (const member of activeMembers) {
    for (let i = 0; i < member.weight; i++) {
      expandedList.push(member.user_id);
    }
  }

  const currentIndex = settings.last_assigned_index % expandedList.length;
  const selectedUserId = expandedList[currentIndex];

  await supabase
    .from("calendars")
    .update({
      settings: {
        ...settings,
        last_assigned_index: (settings.last_assigned_index + 1) % totalWeight,
      },
    })
    .eq("id", calendar.id);

  return selectedUserId;
}

async function findOrCreateContact(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  departmentId: string | null,
  answers: { name?: string; email?: string; phone?: string }
): Promise<string | null> {
  if (answers.email) {
    const { data: existingByEmail } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", answers.email)
      .eq("status", "active")
      .is("merged_into_contact_id", null)
      .maybeSingle();

    if (existingByEmail) return existingByEmail.id;
  }

  if (answers.phone) {
    const normalizedPhone = answers.phone.replace(/\D/g, "");
    const { data: existingByPhone } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .is("merged_into_contact_id", null)
      .or(`phone.eq.${normalizedPhone},phone.eq.${answers.phone}`)
      .maybeSingle();

    if (existingByPhone) return existingByPhone.id;
  }

  let effectiveDepartmentId = departmentId;
  if (!effectiveDepartmentId) {
    const { data: departments } = await supabase
      .from("departments")
      .select("id")
      .eq("organization_id", organizationId)
      .limit(1);

    effectiveDepartmentId = departments?.[0]?.id;
  }

  if (!effectiveDepartmentId) return null;

  const nameParts = (answers.name || "").trim().split(" ");
  const firstName = nameParts[0] || "Guest";
  const lastName = nameParts.slice(1).join(" ") || "";

  const { data: newContact, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: organizationId,
      department_id: effectiveDepartmentId,
      first_name: firstName,
      last_name: lastName,
      email: answers.email || null,
      phone: answers.phone?.replace(/\D/g, "") || null,
      source: "booking",
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create contact:", error);
    return null;
  }

  return newContact.id;
}

async function handleReschedule(
  req: Request,
  supabase: ReturnType<typeof createClient>
) {
  const body = await req.json();
  const { token, new_start_utc: newStartUtc, new_end_utc: newEndUtc } = body;

  if (!token || !newStartUtc || !newEndUtc) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*")
    .eq("reschedule_token", token)
    .eq("status", "scheduled")
    .maybeSingle();

  if (!appointment) {
    return new Response(
      JSON.stringify({ error: "Appointment not found or already canceled" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const historyEntry = {
    action: "rescheduled",
    timestamp: new Date().toISOString(),
    previous_start: appointment.start_at_utc,
    previous_end: appointment.end_at_utc,
  };

  const { data: updated, error } = await supabase
    .from("appointments")
    .update({
      start_at_utc: newStartUtc,
      end_at_utc: newEndUtc,
      history: [...(appointment.history || []), historyEntry],
    })
    .eq("id", appointment.id)
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to reschedule" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (appointment.contact_id) {
    await supabase.from("contact_timeline_events").insert({
      contact_id: appointment.contact_id,
      event_type: "appointment_rescheduled",
      event_data: {
        appointment_id: appointment.id,
        old_time: appointment.start_at_utc,
        new_time: newStartUtc,
      },
    });
  }

  enqueueBookingEmail(appointment.id, "rescheduled");
  enqueueGoogleSync(appointment.id, "reschedule");

  return new Response(
    JSON.stringify({
      success: true,
      appointment: {
        id: updated.id,
        start_at_utc: updated.start_at_utc,
        end_at_utc: updated.end_at_utc,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleCancel(
  req: Request,
  supabase: ReturnType<typeof createClient>
) {
  const body = await req.json();
  const { token, reason } = body;

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Missing token" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*")
    .eq("cancel_token", token)
    .eq("status", "scheduled")
    .maybeSingle();

  if (!appointment) {
    return new Response(
      JSON.stringify({ error: "Appointment not found or already canceled" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const historyEntry = {
    action: "canceled",
    timestamp: new Date().toISOString(),
    reason: reason || undefined,
  };

  const { error } = await supabase
    .from("appointments")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      history: [...(appointment.history || []), historyEntry],
    })
    .eq("id", appointment.id);

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to cancel" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (appointment.contact_id) {
    await supabase.from("contact_timeline_events").insert({
      contact_id: appointment.contact_id,
      event_type: "appointment_canceled",
      event_data: {
        appointment_id: appointment.id,
        reason,
      },
    });
  }

  enqueueBookingEmail(appointment.id, "canceled");
  enqueueGoogleSync(appointment.id, "delete");

  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleGetAppointment(
  req: Request,
  supabase: ReturnType<typeof createClient>
) {
  const url = new URL(req.url);
  const rescheduleToken = url.searchParams.get("reschedule_token");
  const cancelToken = url.searchParams.get("cancel_token");

  if (!rescheduleToken && !cancelToken) {
    return new Response(
      JSON.stringify({ error: "Missing token" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let query = supabase
    .from("appointments")
    .select(`
      *,
      calendar:calendars(id, name, slug),
      appointment_type:appointment_types(id, name, duration_minutes, location_type, location_value)
    `);

  if (rescheduleToken) {
    query = query.eq("reschedule_token", rescheduleToken);
  } else {
    query = query.eq("cancel_token", cancelToken);
  }

  const { data: appointment } = await query.maybeSingle();

  if (!appointment) {
    return new Response(
      JSON.stringify({ error: "Appointment not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      appointment: {
        id: appointment.id,
        status: appointment.status,
        start_at_utc: appointment.start_at_utc,
        end_at_utc: appointment.end_at_utc,
        visitor_timezone: appointment.visitor_timezone,
        google_meet_link: appointment.google_meet_link,
        calendar: appointment.calendar,
        appointment_type: appointment.appointment_type,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
