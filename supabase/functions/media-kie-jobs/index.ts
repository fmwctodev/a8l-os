import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateTextToVideo,
  generateImageToVideo,
  generateMultiImageToVideo,
  generateTextToImage,
  get1080pVideo,
  get4kVideo,
} from "../_shared/kieAdapter.ts";
import { getRequiredAspectRatio, validateAspectRatio } from "../_shared/platformAspectMatrix.ts";
import { buildStructuredPrompt } from "../_shared/promptBuilder.ts";
import type { StylePreset } from "../_shared/promptBuilder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateJobPayload {
  model_id: string;
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: string;
  resolution?: string;
  duration?: number;
  source_upload_id?: string;
  brand_kit_id?: string;
  post_id?: string;
  extra_params?: Record<string, unknown>;
  job_type?: string;
  style_preset_id?: string;
  source_image_urls?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
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
      .select("id, organization_id, role_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!userData) {
      return jsonError("USER_NOT_FOUND", "User not found", 404);
    }

    const { data: roleData } = await supabase
      .from("roles")
      .select("name")
      .eq("id", userData.role_id)
      .maybeSingle();
    const roleName = roleData?.name || "";

    if (roleName !== "SuperAdmin" && roleName !== "Admin") {
      return jsonError(
        "PERMISSION_DENIED",
        "Only Admin and SuperAdmin users can generate media",
        403
      );
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const upgradeType = url.searchParams.get("upgrade");
      const jobId = url.searchParams.get("job_id");

      if (upgradeType && jobId) {
        return await handleUpgrade(supabase, userData.organization_id, jobId, upgradeType, kieApiKey, supabaseUrl);
      }

      return await handleListJobs(supabase, userData.organization_id, req);
    }

    if (req.method !== "POST") {
      return jsonError("METHOD_NOT_ALLOWED", "Use POST to create jobs", 405);
    }

    const payload: CreateJobPayload = await req.json();

    if (!payload.model_id || !payload.prompt) {
      return jsonError(
        "VALIDATION_ERROR",
        "model_id and prompt are required",
        400
      );
    }

    const { data: model } = await supabase
      .from("kie_models")
      .select("*")
      .eq("id", payload.model_id)
      .maybeSingle();

    if (!model) {
      return jsonError("MODEL_NOT_FOUND", "Kie model not found", 404);
    }

    if (!model.enabled) {
      return jsonError(
        "MODEL_DISABLED",
        "This model is currently disabled",
        400
      );
    }

    let stylePreset: StylePreset | null = null;
    if (payload.style_preset_id) {
      const { data: preset } = await supabase
        .from("media_style_presets")
        .select("*")
        .eq("id", payload.style_preset_id)
        .eq("enabled", true)
        .maybeSingle();
      stylePreset = preset;
    }

    let jobType = payload.job_type || null;
    if (!jobType) {
      if (model.type === "image") {
        jobType = "text_to_image";
      } else if (payload.source_image_urls?.length || payload.source_upload_id) {
        jobType = payload.source_image_urls && payload.source_image_urls.length > 1
          ? "multi_image_to_video"
          : "image_to_video";
      } else {
        jobType = "text_to_video";
      }
    }

    if (jobType === "ugc_short_video" && !stylePreset) {
      const { data: ugcPreset } = await supabase
        .from("media_style_presets")
        .select("*")
        .eq("name", "ugc")
        .eq("enabled", true)
        .maybeSingle();
      stylePreset = ugcPreset;
    }
    if (jobType === "explainer_long_video" && !stylePreset) {
      const { data: explainerPreset } = await supabase
        .from("media_style_presets")
        .select("*")
        .eq("name", "explainer")
        .eq("enabled", true)
        .maybeSingle();
      stylePreset = explainerPreset;
    }

    let effectiveDuration = payload.duration;
    let effectiveAspect = payload.aspect_ratio || model.default_params?.aspect_ratio as string || "16:9";

    if (jobType === "ugc_short_video") {
      effectiveAspect = "9:16";
      if (!effectiveDuration || effectiveDuration > 30) effectiveDuration = 30;
    } else if (jobType === "explainer_long_video") {
      effectiveAspect = "16:9";
      if (!effectiveDuration || effectiveDuration > 60) effectiveDuration = 60;
    }

    if (stylePreset?.recommended_aspect_ratio && !payload.aspect_ratio) {
      effectiveAspect = stylePreset.recommended_aspect_ratio;
    }

    let finalPrompt = payload.prompt;

    if (payload.brand_kit_id) {
      const { data: brandKit } = await supabase
        .from("brand_kits")
        .select("name, primary_color, secondary_color, font_family")
        .eq("id", payload.brand_kit_id)
        .eq("organization_id", userData.organization_id)
        .maybeSingle();

      if (brandKit) {
        const brandContext = `Brand: ${brandKit.name}. Colors: ${brandKit.primary_color || "default"}, ${brandKit.secondary_color || "default"}. Font: ${brandKit.font_family || "default"}.`;
        finalPrompt = `${brandContext} ${finalPrompt}`;
      }
    }

    finalPrompt = buildStructuredPrompt(finalPrompt, stylePreset);

    const params: Record<string, unknown> = {
      aspect_ratio: effectiveAspect,
      ...(payload.resolution && { resolution: payload.resolution }),
      ...(effectiveDuration && { duration: effectiveDuration }),
      ...(payload.negative_prompt && { negative_prompt: payload.negative_prompt }),
      ...(payload.extra_params || {}),
    };

    const { data: job, error: jobError } = await supabase
      .from("media_generation_jobs")
      .insert({
        organization_id: userData.organization_id,
        created_by: userData.id,
        model_id: payload.model_id,
        prompt: finalPrompt,
        negative_prompt: payload.negative_prompt || null,
        params,
        status: "waiting",
        brand_kit_id: payload.brand_kit_id || null,
        source_upload_id: payload.source_upload_id || null,
        post_id: payload.post_id || null,
        job_type: jobType,
        style_preset_id: stylePreset?.id || null,
        source_image_urls: payload.source_image_urls || [],
      })
      .select()
      .single();

    if (jobError) {
      console.error("Failed to create job:", jobError);
      return jsonError("JOB_CREATE_FAILED", jobError.message, 500);
    }

    if (!kieApiKey) {
      await supabase
        .from("media_generation_jobs")
        .update({
          status: "fail",
          error_message: "KIE_API_KEY not configured",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return jsonResponse({
        success: true,
        data: {
          ...job,
          status: "fail",
          error_message: "KIE_API_KEY not configured. Contact your administrator.",
        },
      });
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/media-kie-webhook`;
    const modelKey = model.model_key as string;
    const isVeo = modelKey.startsWith("google/veo-");
    const endpointOverride = model.api_endpoint_override as string | null;

    let sourceImageUrls: string[] = payload.source_image_urls || [];
    if (!sourceImageUrls.length && payload.source_upload_id) {
      const { data: upload } = await supabase
        .from("media_source_uploads")
        .select("public_url")
        .eq("id", payload.source_upload_id)
        .maybeSingle();
      if (upload?.public_url) {
        sourceImageUrls = [upload.public_url];
      }
    }

    let kieResult;

    if (jobType === "text_to_image") {
      kieResult = await generateTextToImage(kieApiKey, {
        modelKey,
        prompt: finalPrompt,
        aspectRatio: effectiveAspect,
        resolution: payload.resolution,
        negativePrompt: payload.negative_prompt,
        callbackUrl: webhookUrl,
        endpointOverride: endpointOverride || undefined,
      });
    } else if (jobType === "image_to_video" && sourceImageUrls.length > 0) {
      kieResult = await generateImageToVideo(
        kieApiKey,
        {
          prompt: finalPrompt,
          aspectRatio: effectiveAspect,
          duration: effectiveDuration || model.default_params?.duration as number || 8,
          callbackUrl: webhookUrl,
          imageUrls: sourceImageUrls,
          model: isVeo ? undefined : modelKey,
        },
        isVeo ? (endpointOverride || undefined) : undefined
      );
    } else if (jobType === "multi_image_to_video" && sourceImageUrls.length > 1) {
      kieResult = await generateMultiImageToVideo(
        kieApiKey,
        {
          prompt: finalPrompt,
          aspectRatio: effectiveAspect,
          duration: effectiveDuration || model.default_params?.duration as number || 8,
          callbackUrl: webhookUrl,
          imageUrls: sourceImageUrls,
          model: isVeo ? undefined : modelKey,
        },
        isVeo ? (endpointOverride || undefined) : undefined
      );
    } else {
      kieResult = await generateTextToVideo(
        kieApiKey,
        {
          prompt: finalPrompt,
          aspectRatio: effectiveAspect,
          duration: effectiveDuration || model.default_params?.duration as number || 8,
          callbackUrl: webhookUrl,
          model: isVeo ? undefined : modelKey,
        },
        isVeo ? (endpointOverride || undefined) : undefined
      );
    }

    if (!kieResult.success) {
      await supabase
        .from("media_generation_jobs")
        .update({
          status: "fail",
          error_message: kieResult.error || "Kie.ai API error",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return jsonResponse({
        success: true,
        data: { ...job, status: "fail", error_message: kieResult.error },
      });
    }

    await supabase
      .from("media_generation_jobs")
      .update({
        kie_task_id: kieResult.taskId,
        status: "queuing",
      })
      .eq("id", job.id);

    return jsonResponse({
      success: true,
      data: { ...job, kie_task_id: kieResult.taskId, status: "queuing" },
    });
  } catch (err) {
    console.error("media-kie-jobs error:", err);
    return jsonError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Unexpected error",
      500
    );
  }
});

async function handleUpgrade(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  jobId: string,
  upgradeType: string,
  kieApiKey: string | undefined,
  supabaseUrl: string
) {
  if (!kieApiKey) {
    return jsonError("CONFIG_ERROR", "KIE_API_KEY not configured", 500);
  }

  const { data: job } = await supabase
    .from("media_generation_jobs")
    .select("*, kie_models(model_key)")
    .eq("id", jobId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!job) {
    return jsonError("JOB_NOT_FOUND", "Job not found", 404);
  }

  if (job.status !== "success") {
    return jsonError("INVALID_STATE", "Job must be completed before upgrading", 400);
  }

  const modelKey = job.kie_models?.model_key || "";
  if (!modelKey.startsWith("google/veo-")) {
    return jsonError("NOT_SUPPORTED", "Upgrades only available for Veo models", 400);
  }

  const webhookUrl = `${supabaseUrl}/functions/v1/media-kie-webhook`;

  let result;
  if (upgradeType === "1080p") {
    result = await get1080pVideo(kieApiKey, job.kie_task_id, 0);
  } else if (upgradeType === "4k") {
    result = await get4kVideo(kieApiKey, job.kie_task_id, 0, webhookUrl);
  } else {
    return jsonError("INVALID_UPGRADE", "Use upgrade=1080p or upgrade=4k", 400);
  }

  if (!result.success) {
    return jsonError("UPGRADE_FAILED", result.error || "Upgrade request failed", 500);
  }

  const existingUpgrades = job.upgrade_task_ids || {};
  existingUpgrades[upgradeType] = { taskId: result.taskId, status: "pending" };

  await supabase
    .from("media_generation_jobs")
    .update({ upgrade_task_ids: existingUpgrades })
    .eq("id", job.id);

  return jsonResponse({
    success: true,
    data: {
      upgrade_type: upgradeType,
      task_id: result.taskId,
      data: result.data,
    },
  });
}

async function handleListJobs(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  req: Request
) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const postId = url.searchParams.get("post_id");
  const jobType = url.searchParams.get("job_type");
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  let query = supabase
    .from("media_generation_jobs")
    .select("*, kie_models(display_name, type, badge_label)", { count: "exact" })
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (postId) query = query.eq("post_id", postId);
  if (jobType) query = query.eq("job_type", jobType);

  const { data, error, count } = await query;

  if (error) {
    return jsonError("QUERY_ERROR", error.message, 500);
  }

  return jsonResponse({ success: true, data, total: count });
}

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
