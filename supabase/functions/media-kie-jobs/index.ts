import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const params: Record<string, unknown> = {
      aspect_ratio:
        payload.aspect_ratio || model.default_params?.aspect_ratio || "16:9",
      ...(payload.resolution && { resolution: payload.resolution }),
      ...(payload.duration && { duration: payload.duration }),
      ...(payload.negative_prompt && {
        negative_prompt: payload.negative_prompt,
      }),
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

    let sourceImageUrl: string | null = null;
    if (payload.source_upload_id) {
      const { data: upload } = await supabase
        .from("media_source_uploads")
        .select("public_url")
        .eq("id", payload.source_upload_id)
        .maybeSingle();
      if (upload) {
        sourceImageUrl = upload.public_url;
      }
    }

    const isVeoModel =
      model.model_key.startsWith("google/veo-");
    let kieEndpoint: string;
    let kieBody: Record<string, unknown>;

    if (isVeoModel) {
      kieEndpoint =
        model.api_endpoint_override || "https://api.kie.ai/api/v1/veo/generate";
      kieBody = {
        prompt: finalPrompt,
        aspect_ratio: params.aspect_ratio,
        duration: params.duration || model.default_params?.duration || 8,
        callBackUrl: webhookUrl,
      };
    } else {
      kieEndpoint = "https://api.kie.ai/api/v1/jobs/createTask";
      const input: Record<string, unknown> = {
        prompt: finalPrompt,
        aspect_ratio: params.aspect_ratio,
      };
      if (params.resolution) input.resolution = params.resolution;
      if (params.duration) input.duration = params.duration;
      if (params.negative_prompt)
        input.negative_prompt = params.negative_prompt;
      if (sourceImageUrl) input.input_urls = [sourceImageUrl];

      kieBody = {
        model: model.model_key,
        callBackUrl: webhookUrl,
        input,
      };
    }

    let kieResponse: Response;
    try {
      kieResponse = await fetch(kieEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${kieApiKey}`,
        },
        body: JSON.stringify(kieBody),
      });
    } catch (fetchErr) {
      console.error("Kie.ai API call failed:", fetchErr);
      await supabase
        .from("media_generation_jobs")
        .update({
          status: "fail",
          error_message: `Kie.ai API unreachable: ${fetchErr instanceof Error ? fetchErr.message : "unknown"}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return jsonResponse({
        success: true,
        data: { ...job, status: "fail", error_message: "Kie.ai API unreachable" },
      });
    }

    const kieResult = await kieResponse.json();

    if (!kieResponse.ok || kieResult.code !== 200) {
      const errMsg = kieResult.msg || kieResult.message || "Unknown Kie.ai error";
      await supabase
        .from("media_generation_jobs")
        .update({
          status: "fail",
          error_message: errMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return jsonResponse({
        success: true,
        data: { ...job, status: "fail", error_message: errMsg },
      });
    }

    const taskId = kieResult.data?.taskId || kieResult.data?.task_id;
    await supabase
      .from("media_generation_jobs")
      .update({
        kie_task_id: taskId,
        status: "queuing",
      })
      .eq("id", job.id);

    return jsonResponse({
      success: true,
      data: { ...job, kie_task_id: taskId, status: "queuing" },
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

async function handleListJobs(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  req: Request
) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const postId = url.searchParams.get("post_id");
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
