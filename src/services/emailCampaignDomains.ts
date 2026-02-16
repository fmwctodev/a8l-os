import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type {
  EmailCampaignDomain,
  EmailWarmupConfig,
  EmailWarmupDailyStat,
  EmailCampaignDomainEvent,
  EmailWarmupAIRecommendation,
  CreateEmailCampaignDomainInput,
  UpdateEmailCampaignDomainInput,
  UpdateEmailWarmupConfigInput,
  CampaignDomainStatusSummary,
} from '../types';

const SLUG = 'email-campaign-domains';

export async function getCampaignDomains(orgId: string): Promise<EmailCampaignDomain[]> {
  const { data, error } = await supabase
    .from('email_campaign_domains')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getCampaignDomainById(id: string): Promise<EmailCampaignDomain | null> {
  const { data, error } = await supabase
    .from('email_campaign_domains')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCampaignDomainWithConfig(id: string): Promise<EmailCampaignDomain | null> {
  const { data: domain, error: domainError } = await supabase
    .from('email_campaign_domains')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (domainError) throw domainError;
  if (!domain) return null;

  const { data: config } = await supabase
    .from('email_warmup_config')
    .select('*')
    .eq('campaign_domain_id', id)
    .maybeSingle();

  return { ...domain, warmup_config: config || undefined };
}

export async function createCampaignDomain(
  input: CreateEmailCampaignDomainInput
): Promise<{ success: boolean; domain?: EmailCampaignDomain; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'create', ...input } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true, domain: result.domain };
}

export async function updateCampaignDomain(
  id: string,
  input: UpdateEmailCampaignDomainInput
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('email_campaign_domains')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteCampaignDomain(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'delete', domainId: id } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function verifyCampaignDomainDNS(
  id: string
): Promise<{ success: boolean; verified?: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'verify', domainId: id } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true, verified: result.verified };
}

export async function startWarmup(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'start_warmup', domainId: id } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function pauseWarmup(
  id: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'pause_warmup', domainId: id, reason } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function resumeWarmup(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'resume_warmup', domainId: id } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function syncWarmupStats(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'sync_stats', domainId: id } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function getWarmupProgress(
  domainId: string,
  days: number = 30
): Promise<EmailWarmupDailyStat[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('email_warmup_daily_stats')
    .select('*')
    .eq('campaign_domain_id', domainId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getWarmupConfig(
  domainId: string
): Promise<EmailWarmupConfig | null> {
  const { data, error } = await supabase
    .from('email_warmup_config')
    .select('*')
    .eq('campaign_domain_id', domainId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateWarmupConfig(
  domainId: string,
  config: UpdateEmailWarmupConfigInput
): Promise<{ success: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from('email_warmup_config')
    .select('id')
    .eq('campaign_domain_id', domainId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('email_warmup_config')
      .update({
        ...config,
        updated_at: new Date().toISOString(),
      })
      .eq('campaign_domain_id', domainId);

    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from('email_warmup_config')
      .insert({
        campaign_domain_id: domainId,
        ...config,
      });

    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getCampaignDomainEvents(
  domainId: string,
  limit: number = 50
): Promise<EmailCampaignDomainEvent[]> {
  const { data, error } = await supabase
    .from('email_campaign_domain_events')
    .select(`
      *,
      actor:users!email_campaign_domain_events_actor_id_fkey(id, name, email, avatar_url)
    `)
    .eq('campaign_domain_id', domainId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getAIRecommendations(
  domainId: string
): Promise<EmailWarmupAIRecommendation[]> {
  const { data, error } = await supabase
    .from('email_warmup_ai_recommendations')
    .select('*')
    .eq('campaign_domain_id', domainId)
    .is('applied_at', null)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPendingAIRecommendationsCount(
  orgId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('email_warmup_ai_recommendations')
    .select('id, campaign_domain_id!inner(organization_id)', { count: 'exact', head: true })
    .eq('campaign_domain_id.organization_id', orgId)
    .is('applied_at', null)
    .is('dismissed_at', null);

  if (error) return 0;
  return count || 0;
}

export async function acknowledgeRecommendation(
  recommendationId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('email_warmup_ai_recommendations')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', recommendationId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function applyRecommendation(
  recommendationId: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'apply_recommendation', recommendationId } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function dismissRecommendation(
  recommendationId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('email_warmup_ai_recommendations')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', recommendationId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getCampaignDomainStatusSummary(
  orgId: string
): Promise<CampaignDomainStatusSummary> {
  const { data: domains } = await supabase
    .from('email_campaign_domains')
    .select('id, status, current_daily_limit')
    .eq('organization_id', orgId);

  const domainList = domains || [];
  const warmedDomains = domainList.filter(d => d.status === 'warmed');
  const warmingDomains = domainList.filter(d => d.status === 'warming_up');
  const totalDailyLimit = domainList
    .filter(d => d.status === 'warmed' || d.status === 'warming_up')
    .reduce((sum, d) => sum + (d.current_daily_limit || 0), 0);

  const blockingReasons: string[] = [];
  if (warmedDomains.length === 0 && warmingDomains.length === 0) {
    blockingReasons.push('No campaign domains configured');
  } else if (warmedDomains.length === 0) {
    blockingReasons.push('No fully warmed domains available');
  }

  const pendingCount = await getPendingAIRecommendationsCount(orgId);

  return {
    isReady: warmedDomains.length > 0,
    hasWarmedDomain: warmedDomains.length > 0,
    warmingDomainsCount: warmingDomains.length,
    totalDailyLimit,
    blockingReasons,
    hasAIRecommendations: pendingCount > 0,
  };
}
