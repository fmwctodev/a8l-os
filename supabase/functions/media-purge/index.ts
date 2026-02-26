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
      .select("id, storage_path, job_id")
      .lt("expires_at", now)
      .limit(100);

    if (queryError) {
      console.error("[media-purge] Query error:", queryError);
      return new Response(
        JSON.stringify({ success: false, error: queryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!expiredAssets || expiredAssets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, purged: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let purgedCount = 0;
    const errors: string[] = [];

    for (const asset of expiredAssets) {
      try {
        if (asset.storage_path) {
          const { error: storageError } = await supabase.storage
            .from("social-media-assets")
            .remove([asset.storage_path]);

          if (storageError) {
            console.warn("[media-purge] Storage delete error:", asset.storage_path, storageError);
          }
        }

        const { error: deleteError } = await supabase
          .from("media_assets")
          .delete()
          .eq("id", asset.id);

        if (deleteError) {
          errors.push(`Failed to delete asset ${asset.id}: ${deleteError.message}`);
        } else {
          purgedCount++;
        }
      } catch (err) {
        errors.push(`Error processing asset ${asset.id}: ${err}`);
      }
    }

    const { error: jobCleanupError } = await supabase
      .from("media_generation_jobs")
      .update({ status: "expired" })
      .in("status", ["success"])
      .lt("completed_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .is("result_urls", null);

    if (jobCleanupError) {
      console.warn("[media-purge] Job cleanup error:", jobCleanupError);
    }

    console.log(`[media-purge] Purged ${purgedCount}/${expiredAssets.length} expired assets`);

    return new Response(
      JSON.stringify({
        success: true,
        purged: purgedCount,
        total_expired: expiredAssets.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[media-purge] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
