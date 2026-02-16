import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DELAY_MINUTES = 15;
const BATCH_LIMIT = 50;

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const { connection_id, org_id, user_id } = body;

    if (!connection_id || !org_id || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing connection_id, org_id, or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseClient();

    const { data: events, error: eventsError } = await supabase
      .from("google_calendar_events")
      .select("google_event_id, summary, start_time, end_time, organizer_email, attendees, hangout_link, conference_data, html_link, status")
      .eq("connection_id", connection_id)
      .eq("status", "confirmed")
      .lt("end_time", new Date().toISOString())
      .not("hangout_link", "is", null)
      .order("end_time", { ascending: false })
      .limit(BATCH_LIMIT);

    if (eventsError) {
      console.error("[MeetDetector] Failed to fetch events:", eventsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch calendar events" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ success: true, detected: 0, message: "No completed Meet events found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventIds = events.map((e: { google_event_id: string }) => e.google_event_id);
    const { data: existingSessions } = await supabase
      .from("google_meet_sessions")
      .select("google_event_id")
      .eq("connection_id", connection_id)
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
          org_id,
          user_id,
          connection_id,
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
        console.error("[MeetDetector] Insert error:", insertError);
        continue;
      }

      detected++;
    }

    console.log(`[MeetDetector] Detected ${detected} new Meet sessions for connection ${connection_id}`);

    return new Response(
      JSON.stringify({ success: true, detected, scanned: events.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[MeetDetector] Unhandled error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
