import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getTaskStatus, downloadAndStoreAsset } from "../_shared/kieAdapter.ts";

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

  if (req.method !== "GET") {
    return jsonError("METHOD_NOT_ALLOWED", "Use GET", 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const kieApiKey = Deno.env.get("KIE_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("AUTH_REQUIRED", "Authorization header required", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return jsonError("AUTH_FAILED", "Invalid or expired token", 401);
    }

    const { data: userData } = await supabase
      .from("users")
      .select("id, organization_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!userData) {
      return jsonError("USER_NOT_FOUND", "User not found", 404);
    }

    const url = new URL(req.url);
    const jobId = url.searchParams.get("job_id");

    if (!jobId) {
      return jsonError("VALIDATION_ERROR", "job_id query parameter required", 400);
    }

    const { data: job, error: jobError } = await supabase
      .from("media_generation_jobs")
      .select("*, kie_models(display_name, type, badge_label, model_key)")
      .eq("id", jobId)
      .eq("organization_id", userData.organization_id)
      .maybeSingle();

    if (jobError || !job) {
      return jsonError("JOB_NOT_FOUND", "Job not found", 404);
    }

    if (
      job.kie_task_id &&
      kieApiKey &&
      (job.status === "waiting" || job.status === "queuing" || job.status === "generating")
    ) {
      const modelKey = job.kie_models?.model_key || "";
      const isVeo = modelKey.startsWith("google/veo-");

      try {
        const pollResult = await getTaskStatus(kieApiKey, job.kie_task_id, isVeo);

        if (pollResult.success) {
          const remoteStatus = pollResult.status;
          const resultUrls = pollResult.resultUrls || [];

          if (remoteStatus === "success" && resultUrls.length > 0) {
            await supabase
              .from("media_generation_jobs")
              .update({
                status: "success",
                result_urls: resultUrls,
                completed_at: new Date().toISOString(),
              })
              .eq("id", job.id);

            const mediaType = job.kie_models?.type || "image";

            for (let i = 0; i < resultUrls.length; i++) {
              try {
                await downloadAndStoreAsset(supabase, resultUrls[i], job, i, mediaType);
              } catch {
                console.error("[media-job-status] Asset download error for index", i);
              }
            }

            job.status = "success";
            job.result_urls = resultUrls;
          } else if (remoteStatus === "fail") {
            const errMsg = pollResult.error || "Generation failed remotely";
            await supabase
              .from("media_generation_jobs")
              .update({
                status: "fail",
                error_message: errMsg,
                completed_at: new Date().toISOString(),
              })
              .eq("id", job.id);
            job.status = "fail";
            job.error_message = errMsg;
          } else if (remoteStatus && remoteStatus !== job.status) {
            await supabase
              .from("media_generation_jobs")
              .update({ status: remoteStatus })
              .eq("id", job.id);
            job.status = remoteStatus;
          }
        }
      } catch (pollErr) {
        console.error("[media-job-status] Poll error:", pollErr);
      }
    }

    if (kieApiKey && job.upgrade_task_ids) {
      const upgrades = job.upgrade_task_ids as Record<string, { taskId: string; status: string; url?: string }>;
      let upgradesChanged = false;

      for (const [resolution, upgrade] of Object.entries(upgrades)) {
        if (upgrade.status === "pending" && upgrade.taskId) {
          try {
            const upgradeResult = await getTaskStatus(kieApiKey, upgrade.taskId, true);
            if (upgradeResult.success && upgradeResult.status === "success" && upgradeResult.resultUrls?.length) {
              upgrade.status = "complete";
              upgrade.url = upgradeResult.resultUrls[0];
              upgradesChanged = true;

              const existingAssets = await supabase
                .from("media_assets")
                .select("id")
                .eq("job_id", job.id);
              const nextIndex = (existingAssets.data?.length || 0);

              await downloadAndStoreAsset(
                supabase,
                upgradeResult.resultUrls[0],
                job,
                nextIndex,
                "video",
                { resolution, upgrade: true }
              );
            } else if (upgradeResult.status === "fail") {
              upgrade.status = "failed";
              upgradesChanged = true;
            }
          } catch {
            console.error(`[media-job-status] Upgrade poll error for ${resolution}`);
          }
        }
      }

      if (upgradesChanged) {
        await supabase
          .from("media_generation_jobs")
          .update({ upgrade_task_ids: upgrades })
          .eq("id", job.id);
        job.upgrade_task_ids = upgrades;
      }
    }

    let assets: unknown[] = [];
    if (job.status === "success") {
      const { data: assetData } = await supabase
        .from("media_assets")
        .select("*")
        .eq("job_id", job.id)
        .order("created_at", { ascending: true });
      assets = assetData || [];
    }

    const modelKey = job.kie_models?.model_key || "";
    const isVeoModel = modelKey.startsWith("google/veo-");
    const canUpgrade = job.status === "success" && isVeoModel;

    return jsonResponse({
      success: true,
      data: {
        job,
        assets,
        can_upgrade_1080p: canUpgrade,
        can_upgrade_4k: canUpgrade,
      },
    });
  } catch (err) {
    console.error("[media-job-status] Error:", err);
    return jsonError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Unexpected error",
      500
    );
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(code: string, message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
