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
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
      return jsonResponse({ success: false, error: "Authorization required" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ success: false, error: "Invalid token" }, 401);
    }

    const { data: userData } = await supabase
      .from("users")
      .select("id, organization_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!userData) {
      return jsonResponse({ success: false, error: "User not found" }, 404);
    }

    const url = new URL(req.url);
    const jobId = url.searchParams.get("job_id");
    if (!jobId) {
      return jsonResponse({ success: false, error: "job_id is required" }, 400);
    }

    const { data: job } = await supabase
      .from("media_generation_jobs")
      .select("*, kie_models(model_key, type)")
      .eq("id", jobId)
      .eq("organization_id", userData.organization_id)
      .maybeSingle();

    if (!job) {
      return jsonResponse({ success: false, error: "Job not found" }, 404);
    }

    const { data: assets } = await supabase
      .from("media_assets")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    const activeStatuses = ["waiting", "queuing", "generating"];
    if (!activeStatuses.includes(job.status) || !job.kie_task_id || !kieApiKey) {
      return jsonResponse({
        success: true,
        data: { job, assets: assets || [] },
      });
    }

    const modelKey = job.kie_models?.model_key || "";
    const isVeo = modelKey.startsWith("google/veo-");

    const statusResult = await getTaskStatus(kieApiKey, job.kie_task_id, isVeo);

    if (!statusResult.success) {
      return jsonResponse({
        success: true,
        data: { job, assets: assets || [] },
      });
    }

    const newStatus = statusResult.status || job.status;
    const mediaType = job.kie_models?.type || "image";

    if (newStatus === "success" && statusResult.resultUrls && statusResult.resultUrls.length > 0) {
      await supabase
        .from("media_generation_jobs")
        .update({
          status: "success",
          result_urls: statusResult.resultUrls,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      for (let i = 0; i < statusResult.resultUrls.length; i++) {
        try {
          await downloadAndStoreAsset(supabase, statusResult.resultUrls[i], job, i, mediaType);
        } catch (dlErr) {
          console.error("[media-job-status] Asset download error:", dlErr);
        }
      }

      const { data: updatedAssets } = await supabase
        .from("media_assets")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      return jsonResponse({
        success: true,
        data: {
          job: { ...job, status: "success", result_urls: statusResult.resultUrls },
          assets: updatedAssets || [],
        },
      });
    }

    if (newStatus === "fail") {
      await supabase
        .from("media_generation_jobs")
        .update({
          status: "fail",
          error_message: statusResult.error || "Generation failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return jsonResponse({
        success: true,
        data: {
          job: { ...job, status: "fail", error_message: statusResult.error },
          assets: assets || [],
        },
      });
    }

    if (newStatus !== job.status) {
      await supabase
        .from("media_generation_jobs")
        .update({ status: newStatus })
        .eq("id", job.id);
    }

    if (job.upgrade_task_ids && kieApiKey) {
      const upgrades = job.upgrade_task_ids as Record<string, { taskId: string; status: string; url?: string }>;
      let upgradesChanged = false;

      for (const [resolution, upgrade] of Object.entries(upgrades)) {
        if (upgrade.status === "pending" && upgrade.taskId) {
          const upgradeStatus = await getTaskStatus(kieApiKey, upgrade.taskId, isVeo);
          if (upgradeStatus.success && upgradeStatus.status === "success" && upgradeStatus.resultUrls?.length) {
            upgrade.status = "complete";
            upgrade.url = upgradeStatus.resultUrls[0];
            upgradesChanged = true;

            const existingAssets = await supabase
              .from("media_assets")
              .select("id")
              .eq("job_id", job.id);
            const nextIndex = existingAssets.data?.length || 0;

            try {
              await downloadAndStoreAsset(
                supabase, upgradeStatus.resultUrls[0], job, nextIndex, "video",
                { resolution, upgrade: true }
              );
            } catch (err) {
              console.error("[media-job-status] Upgrade download error:", err);
            }
          } else if (upgradeStatus.success && upgradeStatus.status === "fail") {
            upgrade.status = "failed";
            upgradesChanged = true;
          }
        }
      }

      if (upgradesChanged) {
        await supabase
          .from("media_generation_jobs")
          .update({ upgrade_task_ids: upgrades })
          .eq("id", job.id);
      }
    }

    return jsonResponse({
      success: true,
      data: {
        job: { ...job, status: newStatus },
        assets: assets || [],
      },
    });
  } catch (err) {
    console.error("[media-job-status] Error:", err);
    return jsonResponse(
      { success: false, error: err instanceof Error ? err.message : "Unexpected error" },
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
