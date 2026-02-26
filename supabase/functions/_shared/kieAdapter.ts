const KIE_BASE = "https://api.kie.ai/api/v1";
const VEO_BASE = `${KIE_BASE}/veo`;
const JOBS_BASE = `${KIE_BASE}/jobs`;

export interface KieResult {
  success: boolean;
  taskId?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export interface KieStatusResult {
  success: boolean;
  status?: string;
  resultUrls?: string[];
  error?: string;
  data?: Record<string, unknown>;
}

interface VeoGenerateParams {
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  callbackUrl?: string;
  generationType?: string;
  imageUrls?: string[];
  model?: string;
}

interface StandardGenerateParams {
  modelKey: string;
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  negativePrompt?: string;
  inputUrls?: string[];
  callbackUrl?: string;
}

async function kiePost(
  apiKey: string,
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { ok: response.ok && data.code === 200, data };
}

async function kieGet(
  apiKey: string,
  url: string
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await response.json();
  return { ok: response.ok, data };
}

function extractTaskId(data: Record<string, unknown>): string | undefined {
  const d = data.data as Record<string, unknown> | undefined;
  return (d?.taskId || d?.task_id) as string | undefined;
}

function extractResultUrls(data: Record<string, unknown>): string[] {
  const d = data.data as Record<string, unknown> | undefined;
  const info = d?.info as Record<string, unknown> | undefined;
  return (
    (info?.resultUrls as string[]) ||
    (info?.result_urls as string[]) ||
    (d?.resultUrls as string[]) ||
    []
  );
}

export async function generateTextToVideo(
  apiKey: string,
  params: VeoGenerateParams,
  endpointOverride?: string
): Promise<KieResult> {
  const isVeo = !params.model || params.model.startsWith("google/veo-");
  if (isVeo) {
    const url = endpointOverride || `${VEO_BASE}/generate`;
    const body: Record<string, unknown> = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio || "16:9",
      duration: params.duration || 8,
      generationType: params.generationType || "TEXT_2_VIDEO",
    };
    if (params.callbackUrl) body.callBackUrl = params.callbackUrl;
    if (params.model) body.model = params.model;
    const result = await kiePost(apiKey, url, body);
    if (!result.ok) {
      return { success: false, error: result.data.msg as string || "Veo generation failed" };
    }
    return { success: true, taskId: extractTaskId(result.data), data: result.data };
  }

  return generateStandard(apiKey, {
    modelKey: params.model!,
    prompt: params.prompt,
    aspectRatio: params.aspectRatio,
    duration: params.duration,
    callbackUrl: params.callbackUrl,
  });
}

export async function generateImageToVideo(
  apiKey: string,
  params: VeoGenerateParams & { imageUrls: string[] },
  endpointOverride?: string
): Promise<KieResult> {
  const isVeo = !params.model || params.model.startsWith("google/veo-");
  if (isVeo) {
    const url = endpointOverride || `${VEO_BASE}/generate`;
    const body: Record<string, unknown> = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio || "16:9",
      duration: params.duration || 8,
      generationType: "REFERENCE_2_VIDEO",
      imageUrls: params.imageUrls,
    };
    if (params.callbackUrl) body.callBackUrl = params.callbackUrl;
    if (params.model) body.model = params.model;
    const result = await kiePost(apiKey, url, body);
    if (!result.ok) {
      return { success: false, error: result.data.msg as string || "Image-to-video failed" };
    }
    return { success: true, taskId: extractTaskId(result.data), data: result.data };
  }

  return generateStandard(apiKey, {
    modelKey: params.model!,
    prompt: params.prompt,
    aspectRatio: params.aspectRatio,
    duration: params.duration,
    inputUrls: params.imageUrls,
    callbackUrl: params.callbackUrl,
  });
}

export async function generateMultiImageToVideo(
  apiKey: string,
  params: VeoGenerateParams & { imageUrls: string[] },
  endpointOverride?: string
): Promise<KieResult> {
  const isVeo = !params.model || params.model.startsWith("google/veo-");
  if (isVeo) {
    const url = endpointOverride || `${VEO_BASE}/generate`;
    const body: Record<string, unknown> = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio || "16:9",
      duration: params.duration || 8,
      generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      imageUrls: params.imageUrls.slice(0, 2),
    };
    if (params.callbackUrl) body.callBackUrl = params.callbackUrl;
    if (params.model) body.model = params.model;
    const result = await kiePost(apiKey, url, body);
    if (!result.ok) {
      return { success: false, error: result.data.msg as string || "Multi-image-to-video failed" };
    }
    return { success: true, taskId: extractTaskId(result.data), data: result.data };
  }

  return generateStandard(apiKey, {
    modelKey: params.model!,
    prompt: params.prompt,
    aspectRatio: params.aspectRatio,
    duration: params.duration,
    inputUrls: params.imageUrls,
    callbackUrl: params.callbackUrl,
  });
}

export async function generateTextToImage(
  apiKey: string,
  params: StandardGenerateParams
): Promise<KieResult> {
  return generateStandard(apiKey, params);
}

async function generateStandard(
  apiKey: string,
  params: StandardGenerateParams
): Promise<KieResult> {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio || "16:9",
  };
  if (params.duration) input.duration = params.duration;
  if (params.resolution) input.resolution = params.resolution;
  if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
  if (params.inputUrls?.length) input.input_urls = params.inputUrls;

  const body: Record<string, unknown> = {
    model: params.modelKey,
    input,
  };
  if (params.callbackUrl) body.callBackUrl = params.callbackUrl;

  const result = await kiePost(apiKey, `${JOBS_BASE}/createTask`, body);
  if (!result.ok) {
    return { success: false, error: result.data.msg as string || "Standard generation failed" };
  }
  return { success: true, taskId: extractTaskId(result.data), data: result.data };
}

export async function getTaskStatus(
  apiKey: string,
  taskId: string,
  isVeo: boolean
): Promise<KieStatusResult> {
  const url = isVeo
    ? `${VEO_BASE}/record-info?taskId=${taskId}`
    : `${JOBS_BASE}/recordInfo?taskId=${taskId}`;

  const result = await kieGet(apiKey, url);
  if (!result.ok) {
    return { success: false, error: "Failed to poll task status" };
  }

  const d = result.data.data as Record<string, unknown> | undefined;
  const status = d?.status as string | undefined;
  const resultUrls = extractResultUrls(result.data);
  const errorMsg = d?.error as string | undefined;

  return { success: true, status, resultUrls, error: errorMsg, data: result.data };
}

export async function get1080pVideo(
  apiKey: string,
  taskId: string,
  index = 0
): Promise<KieResult> {
  const url = `${VEO_BASE}/get-1080p-video?taskId=${taskId}&index=${index}`;
  const result = await kieGet(apiKey, url);
  if (!result.ok) {
    return { success: false, error: result.data.msg as string || "1080p upgrade failed" };
  }
  return { success: true, taskId: extractTaskId(result.data), data: result.data };
}

export async function get4kVideo(
  apiKey: string,
  taskId: string,
  index = 0,
  callbackUrl?: string
): Promise<KieResult> {
  const body: Record<string, unknown> = { taskId, index };
  if (callbackUrl) body.callBackUrl = callbackUrl;

  const result = await kiePost(apiKey, `${VEO_BASE}/get-4k-video`, body);
  if (!result.ok) {
    return { success: false, error: result.data.msg as string || "4K upgrade failed" };
  }
  return { success: true, taskId: extractTaskId(result.data), data: result.data };
}

export async function extendVideo(
  apiKey: string,
  taskId: string,
  prompt: string,
  model?: string,
  callbackUrl?: string
): Promise<KieResult> {
  const body: Record<string, unknown> = { taskId, prompt };
  if (model) body.model = model;
  if (callbackUrl) body.callBackUrl = callbackUrl;

  const result = await kiePost(apiKey, `${VEO_BASE}/extend`, body);
  if (!result.ok) {
    return { success: false, error: result.data.msg as string || "Video extension failed" };
  }
  return { success: true, taskId: extractTaskId(result.data), data: result.data };
}

export async function downloadAndStoreAsset(
  supabase: ReturnType<typeof import("npm:@supabase/supabase-js@2").createClient>,
  resultUrl: string,
  job: Record<string, unknown>,
  index: number,
  mediaType: string,
  metadataExtra?: Record<string, unknown>
): Promise<string | null> {
  const fileResponse = await fetch(resultUrl);
  if (!fileResponse.ok) return null;

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
  const storagePath = `${job.organization_id}/${job.id}/${index}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("social-media-assets")
    .upload(storagePath, fileBlob, { contentType, upsert: true });

  if (uploadError) return null;

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
    metadata: { source_url: resultUrl, index, ...metadataExtra },
  });

  return publicUrlData.publicUrl;
}
