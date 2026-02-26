import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { downloadAndStoreAsset } from "../_shared/kieAdapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface KieWebhookPayload {
  code: number;
  msg: string;
  data: {
    taskId: string;
    task_id?: string;
    status?: string;
    info?: {
      resultUrls?: string[];
      result_urls?: string[];
    };
    resultUrls?: string[];
    error?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload: KieWebhookPayload = await req.json();
    console.log("[media-kie-webhook] Received:", JSON.stringify(payload));

    const taskId = payload.data?.taskId || payload.data?.task_id;
    if (!taskId) {
      console.error("[media-kie-webhook] No taskId in payload");
      return new Response(
        JSON.stringify({ success: false, error: "Missing taskId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: job, error: jobError } = await supabase
      .from("media_generation_jobs")
      .select("*, kie_models(type)")
      .eq("kie_task_id", taskId)
      .maybeSingle();

    if (!job) {
      const { data: upgradeJob } = await supabase
        .from("media_generation_jobs")
        .select("*, kie_models(type)")
        .filter("upgrade_task_ids", "cs", JSON.stringify({ [taskId]: {} }))
        .limit(1)
        .maybeSingle();

      if (upgradeJob) {
        return await handleUpgradeWebhook(supabase, upgradeJob, taskId, payload);
      }

      console.error("[media-kie-webhook] Job not found for taskId:", taskId);
      return new Response(
        JSON.stringify({ success: false, error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (jobError) {
      console.error("[media-kie-webhook] DB error:", jobError);
      return new Response(
        JSON.stringify({ success: false, error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuccess = payload.code === 200 && payload.msg === "success";
    const resultUrls =
      payload.data?.info?.resultUrls ||
      payload.data?.info?.result_urls ||
      payload.data?.resultUrls ||
      [];

    if (isSuccess && resultUrls.length > 0) {
      await supabase
        .from("media_generation_jobs")
        .update({
          status: "success",
          result_urls: resultUrls,
          webhook_received_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      const mediaType = job.kie_models?.type || "image";

      for (let i = 0; i < resultUrls.length; i++) {
        try {
          await downloadAndStoreAsset(supabase, resultUrls[i], job, i, mediaType);
        } catch (downloadErr) {
          console.error("[media-kie-webhook] Asset download/upload error:", downloadErr);
        }
      }
    } else {
      const status = payload.data?.status || "fail";
      const errorMsg = payload.data?.error || payload.msg || "Generation failed";

      if (status === "generating" || status === "queuing") {
        await supabase
          .from("media_generation_jobs")
          .update({
            status,
            webhook_received_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      } else {
        await supabase
          .from("media_generation_jobs")
          .update({
            status: "fail",
            error_message: errorMsg,
            webhook_received_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[media-kie-webhook] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleUpgradeWebhook(
  supabase: ReturnType<typeof createClient>,
  job: Record<string, unknown>,
  taskId: string,
  payload: KieWebhookPayload
) {
  const upgrades = (job.upgrade_task_ids || {}) as Record<string, { taskId: string; status: string; url?: string }>;
  let matchedResolution: string | null = null;

  for (const [resolution, upgrade] of Object.entries(upgrades)) {
    if (upgrade.taskId === taskId) {
      matchedResolution = resolution;
      break;
    }
  }

  if (!matchedResolution) {
    return new Response(
      JSON.stringify({ success: false, error: "Upgrade task not matched" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const isSuccess = payload.code === 200 && payload.msg === "success";
  const resultUrls =
    payload.data?.info?.resultUrls ||
    payload.data?.info?.result_urls ||
    payload.data?.resultUrls ||
    [];

  if (isSuccess && resultUrls.length > 0) {
    upgrades[matchedResolution].status = "complete";
    upgrades[matchedResolution].url = resultUrls[0];

    const existingAssets = await supabase
      .from("media_assets")
      .select("id")
      .eq("job_id", job.id);
    const nextIndex = existingAssets.data?.length || 0;

    try {
      await downloadAndStoreAsset(
        supabase, resultUrls[0], job, nextIndex, "video",
        { resolution: matchedResolution, upgrade: true }
      );
    } catch (err) {
      console.error(`[media-kie-webhook] Upgrade asset download error:`, err);
    }
  } else {
    upgrades[matchedResolution].status = "failed";
  }

  await supabase
    .from("media_generation_jobs")
    .update({ upgrade_task_ids: upgrades })
    .eq("id", job.id);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
