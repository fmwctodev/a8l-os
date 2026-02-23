import { supabase } from '../lib/supabase';
import type { SocialContentPattern } from '../types';

export async function recordPattern(
  orgId: string,
  data: Omit<SocialContentPattern, 'id' | 'organization_id' | 'created_at'>
): Promise<SocialContentPattern> {
  const { data: pattern, error } = await supabase
    .from('social_content_patterns')
    .insert({
      organization_id: orgId,
      ...data,
    })
    .select()
    .single();

  if (error) throw error;
  return pattern;
}

export async function getTopPatterns(
  orgId: string,
  platform?: string,
  limit = 20
): Promise<SocialContentPattern[]> {
  let query = supabase
    .from('social_content_patterns')
    .select('*')
    .eq('organization_id', orgId)
    .order('engagement_rate', { ascending: false })
    .limit(limit);

  if (platform) {
    query = query.eq('platform', platform);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPerformanceInsights(
  orgId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  avgEngagement: number;
  topHookTypes: Array<{ hook_type: string; avg_engagement: number; count: number }>;
  bestPostingHours: Array<{ hour: number; avg_engagement: number }>;
  bestPostingDays: Array<{ day: number; avg_engagement: number }>;
  platformBreakdown: Array<{ platform: string; avg_engagement: number; count: number }>;
}> {
  let query = supabase
    .from('social_content_patterns')
    .select('*')
    .eq('organization_id', orgId);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data, error } = await query;
  if (error) throw error;

  const patterns = data || [];
  if (patterns.length === 0) {
    return {
      avgEngagement: 0,
      topHookTypes: [],
      bestPostingHours: [],
      bestPostingDays: [],
      platformBreakdown: [],
    };
  }

  const totalEngagement = patterns.reduce((s, p) => s + (p.engagement_rate || 0), 0);
  const avgEngagement = totalEngagement / patterns.length;

  const hookMap = new Map<string, { total: number; count: number }>();
  const hourMap = new Map<number, { total: number; count: number }>();
  const dayMap = new Map<number, { total: number; count: number }>();
  const platformMap = new Map<string, { total: number; count: number }>();

  for (const p of patterns) {
    if (p.hook_type) {
      const h = hookMap.get(p.hook_type) || { total: 0, count: 0 };
      h.total += p.engagement_rate || 0;
      h.count++;
      hookMap.set(p.hook_type, h);
    }

    const hr = hourMap.get(p.posting_hour) || { total: 0, count: 0 };
    hr.total += p.engagement_rate || 0;
    hr.count++;
    hourMap.set(p.posting_hour, hr);

    const d = dayMap.get(p.posting_day) || { total: 0, count: 0 };
    d.total += p.engagement_rate || 0;
    d.count++;
    dayMap.set(p.posting_day, d);

    if (p.platform) {
      const pl = platformMap.get(p.platform) || { total: 0, count: 0 };
      pl.total += p.engagement_rate || 0;
      pl.count++;
      platformMap.set(p.platform, pl);
    }
  }

  const topHookTypes = Array.from(hookMap.entries())
    .map(([hook_type, v]) => ({ hook_type, avg_engagement: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avg_engagement - a.avg_engagement)
    .slice(0, 10);

  const bestPostingHours = Array.from(hourMap.entries())
    .map(([hour, v]) => ({ hour, avg_engagement: v.total / v.count }))
    .sort((a, b) => b.avg_engagement - a.avg_engagement);

  const bestPostingDays = Array.from(dayMap.entries())
    .map(([day, v]) => ({ day, avg_engagement: v.total / v.count }))
    .sort((a, b) => b.avg_engagement - a.avg_engagement);

  const platformBreakdown = Array.from(platformMap.entries())
    .map(([platform, v]) => ({ platform, avg_engagement: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avg_engagement - a.avg_engagement);

  return { avgEngagement, topHookTypes, bestPostingHours, bestPostingDays, platformBreakdown };
}
