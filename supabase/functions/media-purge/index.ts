import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date().toISOString();

    const { data: expiredAssets, error: queryError } = await supabase
      .from("media_assets")
      .select("id, storage_path, organization_id")
      .lt("expires_at", now)
      .limit(500);

    if (queryError) {
      console.error("[media-purge] Query error:", queryError);
      return new Response(
        JSON.stringify({ success: false, error: queryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!expiredAssets || expiredAssets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, purged: 0, message: "No expired assets" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[media-purge] Found ${expiredAssets.length} expired assets`);

    let purgedCount = 0;
    let errorCount = 0;

    const storagePaths = expiredAssets
      .map((a: { storage_path: string }) => a.storage_path)
      .filter(Boolean);

    if (storagePaths.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < storagePaths.length; i += batchSize) {
        const batch = storagePaths.slice(i, i + batchSize);
        const { error: removeError } = await supabase.storage
          .from("social-media-assets")
          .remove(batch);

        if (removeError) {
          console.error("[media-purge] Storage remove error:", removeError);
          errorCount += batch.length;
        }
      }
    }

    const expiredIds = expiredAssets.map((a: { id: string }) => a.id);
    const dbBatchSize = 100;
    for (let i = 0; i < expiredIds.length; i += dbBatchSize) {
      const batch = expiredIds.slice(i, i + dbBatchSize);
      const { error: deleteError } = await supabase
        .from("media_assets")
        .delete()
        .in("id", batch);

      if (deleteError) {
        console.error("[media-purge] DB delete error:", deleteError);
        errorCount += batch.length;
      } else {
        purgedCount += batch.length;
      }
    }

    const { data: staleJobs } = await supabase
      .from("media_generation_jobs")
      .select("id")
      .in("status", ["waiting", "queuing", "generating"])
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(200);

    let staleJobsCleaned = 0;
    if (staleJobs && staleJobs.length > 0) {
      const staleIds = staleJobs.map((j: { id: string }) => j.id);
      const { error: staleError } = await supabase
        .from("media_generation_jobs")
        .update({
          status: "fail",
          error_message: "Job timed out after 24 hours",
          completed_at: new Date().toISOString(),
        })
        .in("id", staleIds);

      if (!staleError) {
        staleJobsCleaned = staleIds.length;
      }
    }

    console.log(
      `[media-purge] Complete: purged=${purgedCount}, errors=${errorCount}, staleJobs=${staleJobsCleaned}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        purged: purgedCount,
        errors: errorCount,
        stale_jobs_cleaned: staleJobsCleaned,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[media-purge] Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unexpected error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
