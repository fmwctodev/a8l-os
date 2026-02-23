import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type {
  SocialProvider,
  SocialAIActionType,
  AIGenerateObjective,
  AIToneOption,
  AIContentLength,
  AIRepurposeSourceType,
  AIRepurposeAction,
  AISuggestionResult,
  AIGenerateNewResult,
  AIRepurposeResult,
  AIHashtagSuggestion,
  AICTASuggestion,
  ActiveBrandboardForAI,
  SocialPostAIMetadata,
  Organization,
} from '../types';

interface QuickSuggestionOptions {
  content: string;
  action_type: SocialAIActionType;
  platform: SocialProvider | 'all';
  post_id?: string;
  brand_kit_id?: string;
  brand_voice_id?: string;
  location_context?: string;
  tone_override?: AIToneOption;
}

interface GenerateNewOptions {
  objective: AIGenerateObjective;
  tone: AIToneOption;
  length: AIContentLength;
  platforms: SocialProvider[];
  custom_prompt?: string;
  brand_kit_id?: string;
  brand_voice_id?: string;
  post_id?: string;
}

interface RepurposeOptions {
  source_type: AIRepurposeSourceType;
  source_content: string;
  action: AIRepurposeAction;
  target_platform: SocialProvider;
  brand_voice_id?: string;
  post_id?: string;
}

interface HashtagOptions {
  content: string;
  platform: SocialProvider;
  count?: number;
  include_trending?: boolean;
  include_niche?: boolean;
  include_brand?: boolean;
}

interface CTAOptions {
  content: string;
  objective?: AIGenerateObjective;
  platform: SocialProvider;
  count?: number;
}

export async function getActiveBrandboardForAI(orgId: string): Promise<ActiveBrandboardForAI> {
  const { data: kit } = await supabase
    .from('brand_kits')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('active', true)
    .is('archived_at', null)
    .maybeSingle();

  const { data: voice } = await supabase
    .from('brand_voices')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('active', true)
    .is('archived_at', null)
    .maybeSingle();

  let kitVersion = null;
  let voiceVersion = null;

  if (kit) {
    const { data: version } = await supabase
      .from('brand_kit_versions')
      .select('version_number')
      .eq('brand_kit_id', kit.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (version) {
      kitVersion = {
        id: kit.id,
        name: kit.name,
        version: version.version_number,
      };
    }
  }

  if (voice) {
    const { data: version } = await supabase
      .from('brand_voice_versions')
      .select('version_number, tone_settings, dos, donts, vocabulary_preferred, vocabulary_prohibited, ai_system_prompt')
      .eq('brand_voice_id', voice.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (version) {
      voiceVersion = {
        id: voice.id,
        name: voice.name,
        version: version.version_number,
        tone_settings: version.tone_settings || { formality: 50, friendliness: 50, energy: 50, confidence: 50 },
        dos: version.dos || [],
        donts: version.donts || [],
        vocabulary_preferred: version.vocabulary_preferred || [],
        vocabulary_prohibited: version.vocabulary_prohibited || [],
        ai_system_prompt: version.ai_system_prompt,
      };
    }
  }

  return {
    brand_kit: kitVersion,
    brand_voice: voiceVersion,
  };
}

export async function getOrganizationLocation(orgId: string): Promise<{
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
} | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('business_address, business_city, business_state, business_country, business_timezone')
    .eq('id', orgId)
    .maybeSingle();

  if (error || !data) return null;

  if (!data.business_city && !data.business_state && !data.business_country) {
    return null;
  }

  return {
    address: data.business_address || undefined,
    city: data.business_city || undefined,
    state: data.business_state || undefined,
    country: data.business_country || undefined,
    timezone: data.business_timezone || undefined,
  };
}

async function callAISocialContentFunction(action: string, payload: Record<string, unknown>): Promise<unknown> {
  const response = await fetchEdge('ai-social-content', {
    body: { action, ...payload },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `AI request failed: ${response.status}`);
  }

  return response.json();
}

export async function generateQuickSuggestion(
  options: QuickSuggestionOptions
): Promise<AISuggestionResult> {
  const result = await callAISocialContentFunction('quick_suggestion', {
    content: options.content,
    action_type: options.action_type,
    platform: options.platform,
    post_id: options.post_id,
    brand_kit_id: options.brand_kit_id,
    brand_voice_id: options.brand_voice_id,
    location_context: options.location_context,
    tone_override: options.tone_override,
  }) as AISuggestionResult;

  return result;
}

export async function generateNewContent(
  options: GenerateNewOptions
): Promise<AIGenerateNewResult> {
  const result = await callAISocialContentFunction('generate_new', {
    objective: options.objective,
    tone: options.tone,
    length: options.length,
    platforms: options.platforms,
    custom_prompt: options.custom_prompt,
    brand_kit_id: options.brand_kit_id,
    brand_voice_id: options.brand_voice_id,
    post_id: options.post_id,
  }) as AIGenerateNewResult;

  return result;
}

export async function repurposeContent(
  options: RepurposeOptions
): Promise<AIRepurposeResult> {
  const result = await callAISocialContentFunction('repurpose', {
    source_type: options.source_type,
    source_content: options.source_content,
    action: options.action,
    target_platform: options.target_platform,
    brand_voice_id: options.brand_voice_id,
    post_id: options.post_id,
  }) as AIRepurposeResult;

  return result;
}

export async function generateHashtags(
  options: HashtagOptions
): Promise<AIHashtagSuggestion[]> {
  const result = await callAISocialContentFunction('generate_hashtags', {
    content: options.content,
    platform: options.platform,
    count: options.count || 10,
    include_trending: options.include_trending ?? true,
    include_niche: options.include_niche ?? true,
    include_brand: options.include_brand ?? true,
  }) as { hashtags: AIHashtagSuggestion[] };

  return result.hashtags;
}

export async function generateCTA(
  options: CTAOptions
): Promise<AICTASuggestion[]> {
  const result = await callAISocialContentFunction('generate_cta', {
    content: options.content,
    objective: options.objective,
    platform: options.platform,
    count: options.count || 5,
  }) as { ctas: AICTASuggestion[] };

  return result.ctas;
}

export async function markAIMetadataAsApplied(metadataId: string): Promise<void> {
  const { error } = await supabase
    .from('social_post_ai_metadata')
    .update({
      applied: true,
      applied_at: new Date().toISOString(),
    })
    .eq('id', metadataId);

  if (error) throw error;
}

export async function getAIMetadataForPost(postId: string): Promise<SocialPostAIMetadata[]> {
  const { data, error } = await supabase
    .from('social_post_ai_metadata')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAIUsageStats(
  orgId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  total_generations: number;
  applied_count: number;
  by_action_type: Record<SocialAIActionType, number>;
  by_platform: Record<string, number>;
  total_tokens: number;
}> {
  let query = supabase
    .from('social_post_ai_metadata')
    .select('action_type, platform, tokens_used, applied')
    .eq('organization_id', orgId);

  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  const records = data || [];
  const byActionType: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};
  let totalTokens = 0;
  let appliedCount = 0;

  for (const record of records) {
    byActionType[record.action_type] = (byActionType[record.action_type] || 0) + 1;
    if (record.platform) {
      byPlatform[record.platform] = (byPlatform[record.platform] || 0) + 1;
    }
    totalTokens += record.tokens_used || 0;
    if (record.applied) {
      appliedCount += 1;
    }
  }

  return {
    total_generations: records.length,
    applied_count: appliedCount,
    by_action_type: byActionType as Record<SocialAIActionType, number>,
    by_platform: byPlatform,
    total_tokens: totalTokens,
  };
}

export async function scrapeURL(url: string): Promise<{
  title: string;
  description: string;
  content: string;
  url: string;
}> {
  const result = await callAISocialContentFunction('scrape_url', { url });
  return result as { title: string; description: string; content: string; url: string };
}

export async function extractYouTubeContent(url: string): Promise<{
  title: string;
  description: string;
  transcript: string;
  channel: string;
  duration: string;
}> {
  const result = await callAISocialContentFunction('extract_youtube', { url });
  return result as { title: string; description: string; transcript: string; channel: string; duration: string };
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
