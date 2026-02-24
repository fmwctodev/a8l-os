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
      .select("*, kie_models(display_name, type, badge_label)")
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
      const isVeo = job.kie_models?.display_name?.toLowerCase().includes("veo");
      const pollUrl = isVeo
        ? `https://api.kie.ai/api/v1/veo/record-info?taskId=${job.kie_task_id}`
        : `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${job.kie_task_id}`;

      try {
        const pollResponse = await fetch(pollUrl, {
          headers: { Authorization: `Bearer ${kieApiKey}` },
        });

        if (pollResponse.ok) {
          const pollResult = await pollResponse.json();
          const remoteStatus = pollResult.data?.status;
          const resultUrls =
            pollResult.data?.info?.resultUrls ||
            pollResult.data?.info?.result_urls ||
            pollResult.data?.resultUrls ||
            [];

          if (remoteStatus === "success" && resultUrls.length > 0) {
            await supabase
              .from("media_generation_jobs")
              .update({
                status: "success",
                result_urls: resultUrls,
                completed_at: new Date().toISOString(),
              })
              .eq("id", job.id);

            const { data: modelData } = await supabase
              .from("kie_models")
              .select("type")
              .eq("id", job.model_id)
              .maybeSingle();
            const mediaType = modelData?.type || "image";

            for (let i = 0; i < resultUrls.length; i++) {
              try {
                const fileResponse = await fetch(resultUrls[i]);
                if (!fileResponse.ok) continue;

                const contentType =
                  fileResponse.headers.get("content-type") ||
                  (mediaType === "video" ? "video/mp4" : "image/png");
                const fileBlob = await fileResponse.blob();
                const ext = contentType.includes("mp4")
                  ? "mp4"
                  : contentType.includes("webm")
                    ? "webm"
                    : contentType.includes("png")
                      ? "png"
                      : contentType.includes("webp")
                        ? "webp"
                        : "jpg";
                const storagePath = `${job.organization_id}/${job.id}/${i}.${ext}`;

                const { error: uploadError } = await supabase.storage
                  .from("social-media-assets")
                  .upload(storagePath, fileBlob, {
                    contentType,
                    upsert: true,
                  });

                if (uploadError) continue;

                const { data: publicUrlData } = supabase.storage
                  .from("social-media-assets")
                  .getPublicUrl(storagePath);

                await supabase.from("media_assets").insert({
                  organization_id: job.organization_id,
                  created_by: job.created_by,
                  job_id: job.id,
                  storage_path: storagePath,
                  public_url: publicUrlData.publicUrl,
                  media_type: mediaType,
                  mime_type: contentType,
                  file_size_bytes: fileBlob.size,
                  metadata: { source_url: resultUrls[i], index: i },
                });
              } catch {
                console.error("[media-job-status] Asset download error for index", i);
              }
            }

            job.status = "success";
            job.result_urls = resultUrls;
          } else if (remoteStatus === "fail") {
            const errMsg = pollResult.data?.error || "Generation failed remotely";
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

    let assets: unknown[] = [];
    if (job.status === "success") {
      const { data: assetData } = await supabase
        .from("media_assets")
        .select("*")
        .eq("job_id", job.id)
        .order("created_at", { ascending: true });
      assets = assetData || [];
    }

    return jsonResponse({
      success: true,
      data: { job, assets },
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
