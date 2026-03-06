import { supabase } from '../lib/supabase';
import { fetchEdge, parseEdgeFunctionError } from '../lib/edgeFunction';

export interface KieModel {
  id: string;
  provider: string;
  model_key: string;
  display_name: string;
  type: 'image' | 'video';
  supports_aspect_ratios: string[];
  supports_durations: number[];
  supports_resolutions: string[];
  supports_reference_images: boolean;
  supports_negative_prompt: boolean;
  default_params: Record<string, unknown>;
  enabled: boolean;
  is_recommended: boolean;
  display_priority: number;
  badge_label: string | null;
  short_description: string | null;
  api_endpoint_override: string | null;
  min_credits: number;
}

export interface MediaAsset {
  id: string;
  organization_id: string;
  created_by: string;
  job_id: string | null;
  storage_path: string;
  public_url: string;
  thumbnail_url: string | null;
  media_type: 'image' | 'video';
  mime_type: string | null;
  file_size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
  expires_at: string;
  created_at: string;
}

export type JobType =
  | 'text_to_video'
  | 'image_to_video'
  | 'multi_image_to_video'
  | 'text_to_image'
  | 'ugc_short_video'
  | 'explainer_long_video';

export interface UpgradeTaskInfo {
  taskId: string;
  status: 'pending' | 'complete' | 'failed';
  url?: string;
}

export interface MediaGenerationJob {
  id: string;
  organization_id: string;
  created_by: string;
  model_id: string;
  kie_task_id: string | null;
  status: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail' | 'cancelled';
  prompt: string;
  negative_prompt: string | null;
  params: Record<string, unknown>;
  result_urls: string[];
  error_message: string | null;
  webhook_received_at: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  brand_kit_id: string | null;
  source_upload_id: string | null;
  post_id: string | null;
  job_type: JobType | null;
  style_preset_id: string | null;
  source_image_urls: string[];
  upgrade_task_ids: Record<string, UpgradeTaskInfo> | null;
  kie_models?: {
    display_name: string;
    type: string;
    badge_label: string | null;
    model_key?: string;
  };
}

export interface PlatformMediaDefault {
  id: string;
  platform: string;
  content_format: string;
  recommended_model_id: string | null;
  default_aspect_ratio: string | null;
  default_resolution: string | null;
  default_duration: number | null;
  max_duration: number | null;
  max_file_size_mb: number | null;
  prompt_suffix: string | null;
  notes: string | null;
  enabled: boolean;
}

export interface CreateJobParams {
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
  job_type?: JobType;
  style_preset_id?: string;
  source_image_urls?: string[];
  multi_prompt?: Array<{ prompt: string; duration: number }>;
}

export async function getKieModels(type?: 'image' | 'video'): Promise<KieModel[]> {
  let query = supabase
    .from('kie_models')
    .select('*')
    .eq('enabled', true)
    .order('display_priority', { ascending: true });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export const LOCKED_IMAGE_MODEL_KEY = 'nano-banana-2';

export async function getLockedImageModel(): Promise<KieModel | null> {
  const { data, error } = await supabase
    .from('kie_models')
    .select('*')
    .eq('model_key', LOCKED_IMAGE_MODEL_KEY)
    .eq('enabled', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAllKieModels(): Promise<KieModel[]> {
  const { data, error } = await supabase
    .from('kie_models')
    .select('*')
    .order('type')
    .order('display_priority', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createGenerationJob(params: CreateJobParams): Promise<MediaGenerationJob> {
  const response = await fetchEdge('media-kie-jobs', {
    method: 'POST',
    body: params,
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(parseEdgeFunctionError(result, 'Failed to create generation job'));
  }
  return result.data;
}

export interface JobStatusResult {
  job: MediaGenerationJob;
  assets: MediaAsset[];
  can_upgrade_1080p: boolean;
  can_upgrade_4k: boolean;
}

export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  const response = await fetchEdge('media-job-status', {
    method: 'GET',
    params: { job_id: jobId },
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(parseEdgeFunctionError(result, 'Failed to get job status'));
  }
  return result.data;
}

export async function requestUpgrade(
  jobId: string,
  upgradeType: '1080p' | '4k'
): Promise<{ upgrade_type: string; task_id: string }> {
  const response = await fetchEdge('media-kie-jobs', {
    method: 'GET',
    params: { job_id: jobId, upgrade: upgradeType },
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(parseEdgeFunctionError(result, 'Upgrade request failed'));
  }
  return result.data;
}

export async function listGenerationJobs(
  organizationId: string,
  options?: { status?: string; post_id?: string; job_type?: string; limit?: number; offset?: number }
): Promise<{ data: MediaGenerationJob[]; total: number }> {
  const params: Record<string, string> = {};
  if (options?.status) params.status = options.status;
  if (options?.post_id) params.post_id = options.post_id;
  if (options?.job_type) params.job_type = options.job_type;
  if (options?.limit) params.limit = String(options.limit);
  if (options?.offset) params.offset = String(options.offset);

  const response = await fetchEdge('media-kie-jobs', {
    method: 'GET',
    params,
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(parseEdgeFunctionError(result, 'Failed to list jobs'));
  }
  return { data: result.data, total: result.total };
}

export async function getMediaAssets(
  organizationId: string,
  options?: { type?: 'image' | 'video'; limit?: number }
): Promise<MediaAsset[]> {
  let query = supabase
    .from('media_assets')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (options?.type) {
    query = query.eq('media_type', options.type);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getMediaAssetsByJobId(jobId: string): Promise<MediaAsset[]> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAssetsByJobIds(jobIds: string[]): Promise<Record<string, MediaAsset[]>> {
  if (jobIds.length === 0) return {};

  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .in('job_id', jobIds)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const result: Record<string, MediaAsset[]> = {};
  for (const asset of data || []) {
    if (!asset.job_id) continue;
    if (!result[asset.job_id]) result[asset.job_id] = [];
    result[asset.job_id].push(asset);
  }
  return result;
}

export async function getPlatformDefaults(platform?: string): Promise<PlatformMediaDefault[]> {
  let query = supabase
    .from('platform_media_defaults')
    .select('*')
    .eq('enabled', true);

  if (platform) {
    query = query.eq('platform', platform);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function uploadSourceImage(
  organizationId: string,
  userId: string,
  file: File,
  purpose: 'reference_image' | 'avatar' | 'style_transfer' = 'reference_image'
): Promise<{ id: string; public_url: string }> {
  const ext = file.name.split('.').pop() || 'png';
  const storagePath = `${organizationId}/sources/${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('social-media-assets')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from('social-media-assets')
    .getPublicUrl(storagePath);

  const { data: record, error: insertError } = await supabase
    .from('media_source_uploads')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      storage_path: storagePath,
      public_url: publicUrlData.publicUrl,
      filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      purpose,
    })
    .select('id, public_url')
    .single();

  if (insertError) throw insertError;
  return record;
}

export function isJobActive(status: string): boolean {
  return status === 'waiting' || status === 'queuing' || status === 'generating';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    waiting: 'Waiting',
    queuing: 'In Queue',
    generating: 'Generating',
    success: 'Complete',
    fail: 'Failed',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    waiting: 'text-amber-600',
    queuing: 'text-blue-600',
    generating: 'text-blue-600',
    success: 'text-emerald-600',
    fail: 'text-red-600',
    cancelled: 'text-gray-500',
  };
  return colors[status] || 'text-gray-500';
}
