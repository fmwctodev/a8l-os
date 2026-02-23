import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type {
  SocialCampaign,
  SocialCampaignStatus,
  SocialCampaignFrequency,
  HookStylePreset,
  SocialProvider,
  SocialPost,
} from '../types';

export async function getCampaigns(
  orgId: string,
  status?: SocialCampaignStatus[]
): Promise<SocialCampaign[]> {
  let query = supabase
    .from('social_campaigns')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (status && status.length > 0) {
    query = query.in('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCampaignById(
  id: string
): Promise<SocialCampaign | null> {
  const { data, error } = await supabase
    .from('social_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCampaign(
  orgId: string,
  userId: string,
  input: {
    name: string;
    description?: string;
    theme?: string;
    frequency: SocialCampaignFrequency;
    platforms: SocialProvider[];
    content_type?: string;
    hook_style_preset?: HookStylePreset;
    approval_required?: boolean;
    autopilot_mode?: boolean;
  }
): Promise<SocialCampaign> {
  const { data, error } = await supabase
    .from('social_campaigns')
    .insert({
      organization_id: orgId,
      created_by: userId,
      name: input.name,
      description: input.description || '',
      theme: input.theme || '',
      frequency: input.frequency,
      platforms: input.platforms,
      content_type: input.content_type || '',
      hook_style_preset: input.hook_style_preset || 'question',
      approval_required: input.approval_required ?? false,
      autopilot_mode: input.autopilot_mode ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCampaign(
  id: string,
  updates: Partial<Pick<SocialCampaign,
    'name' | 'description' | 'theme' | 'frequency' | 'platforms' |
    'content_type' | 'hook_style_preset' | 'approval_required' |
    'autopilot_mode' | 'status'
  >>
): Promise<SocialCampaign> {
  const { data, error } = await supabase
    .from('social_campaigns')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_campaigns')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleAutopilot(
  id: string,
  enabled: boolean
): Promise<SocialCampaign> {
  return updateCampaign(id, { autopilot_mode: enabled });
}

export async function generatePosts(
  campaignId: string
): Promise<{ generated: number }> {
  const response = await fetchEdge('ai-social-campaign-generator', {
    body: { campaign_id: campaignId },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Campaign generation failed: ${response.status}`);
  }

  return response.json();
}

export async function getCampaignPosts(
  campaignId: string
): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select(`
      *,
      created_by_user:users!social_posts_created_by_fkey(id, name, email, avatar_url)
    `)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
