import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_RETRIES = 5;

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

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const { count: pendingCount } = await supabase
      .from("google_meet_sessions")
      .select("id", { count: "exact", head: true })
      .eq("processed", false)
      .in("status", ["detected", "queued"])
      .lt("retry_count", MAX_RETRIES)
      .lte("first_check_after", now);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: noArtifactRetries } = await supabase
      .from("google_meet_sessions")
      .select("id")
      .eq("status", "no_artifacts")
      .eq("processed", true)
      .gt("event_end_time", fortyEightHoursAgo)
      .lt("event_end_time", twoHoursAgo)
      .limit(5);

    if (noArtifactRetries && noArtifactRetries.length > 0) {
      const retryIds = noArtifactRetries.map((s: { id: string }) => s.id);
      await supabase
        .from("google_meet_sessions")
        .update({
          status: "detected",
          processed: false,
          retry_count: 0,
          updated_at: now,
        })
        .in("id", retryIds);

      console.log(`[MeetCron] Reset ${retryIds.length} no_artifacts sessions for retry`);
    }

    const totalPending = (pendingCount || 0) + (noArtifactRetries?.length || 0);

    if (totalPending === 0) {
      return new Response(
        JSON.stringify({ success: true, pending: 0, message: "No sessions to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    try {
      const processorUrl = `${supabaseUrl}/functions/v1/meet-processing-job`;
      const resp = await fetch(processorUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!resp.ok) {
        console.error("[MeetCron] Processor invocation failed:", await resp.text());
      } else {
        const result = await resp.json();
        console.log("[MeetCron] Processor result:", JSON.stringify(result));
      }
    } catch (invokeErr) {
      console.error("[MeetCron] Failed to invoke processor:", invokeErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pending: totalPending,
        noArtifactRetries: noArtifactRetries?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[MeetCron] Unhandled error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
