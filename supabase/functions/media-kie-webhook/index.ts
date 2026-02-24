import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
      .select("*")
      .eq("kie_task_id", taskId)
      .maybeSingle();

    if (jobError || !job) {
      console.error("[media-kie-webhook] Job not found for taskId:", taskId);
      return new Response(
        JSON.stringify({ success: false, error: "Job not found" }),
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
      await supabase
        .from("media_generation_jobs")
        .update({
          status: "success",
          result_urls: resultUrls,
          webhook_received_at: new Date().toISOString(),
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
        const resultUrl = resultUrls[i];
        try {
          const fileResponse = await fetch(resultUrl);
          if (!fileResponse.ok) {
            console.error(`[media-kie-webhook] Failed to download: ${resultUrl}`);
            continue;
          }

          const contentType =
            fileResponse.headers.get("content-type") || (mediaType === "video" ? "video/mp4" : "image/png");
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

          if (uploadError) {
            console.error("[media-kie-webhook] Storage upload error:", uploadError);
            continue;
          }

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
            metadata: { source_url: resultUrl, index: i },
          });
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
