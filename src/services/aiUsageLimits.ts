import { supabase } from '../lib/supabase';
import type { AIUsageLimits, UpdateAIUsageLimitsInput } from '../types';

export async function getUsageLimits(orgId: string): Promise<AIUsageLimits | null> {
  const { data, error } = await supabase
    .from('ai_usage_limits')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createUsageLimits(
  orgId: string,
  input?: Partial<UpdateAIUsageLimitsInput>
): Promise<AIUsageLimits> {
  const { data, error } = await supabase
    .from('ai_usage_limits')
    .insert({
      org_id: orgId,
      max_runs_per_user_day: input?.max_runs_per_user_day ?? 100,
      max_runs_per_agent_day: input?.max_runs_per_agent_day ?? 500,
      cooldown_seconds: input?.cooldown_seconds ?? 5,
      error_threshold: input?.error_threshold ?? 10,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateUsageLimits(
  orgId: string,
  input: UpdateAIUsageLimitsInput
): Promise<AIUsageLimits> {
  const existing = await getUsageLimits(orgId);

  if (!existing) {
    return createUsageLimits(orgId, input);
  }

  const updates: Record<string, unknown> = {};

  if (input.max_runs_per_user_day !== undefined) {
    updates.max_runs_per_user_day = input.max_runs_per_user_day;
  }
  if (input.max_runs_per_agent_day !== undefined) {
    updates.max_runs_per_agent_day = input.max_runs_per_agent_day;
  }
  if (input.cooldown_seconds !== undefined) {
    updates.cooldown_seconds = input.cooldown_seconds;
  }
  if (input.error_threshold !== undefined) {
    updates.error_threshold = input.error_threshold;
  }

  const { data, error } = await supabase
    .from('ai_usage_limits')
    .update(updates)
    .eq('org_id', orgId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getOrCreateUsageLimits(orgId: string): Promise<AIUsageLimits> {
  const existing = await getUsageLimits(orgId);
  if (existing) return existing;
  return createUsageLimits(orgId);
}

export async function checkUserDailyLimit(
  orgId: string,
  userId: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limits = await getOrCreateUsageLimits(orgId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('ai_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .gte('created_at', today.toISOString());

  if (error) throw error;

  const used = count || 0;
  return {
    allowed: used < limits.max_runs_per_user_day,
    used,
    limit: limits.max_runs_per_user_day,
  };
}

export async function checkAgentDailyLimit(
  orgId: string,
  agentId: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limits = await getOrCreateUsageLimits(orgId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('ai_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
    .gte('created_at', today.toISOString());

  if (error) throw error;

  const used = count || 0;
  return {
    allowed: used < limits.max_runs_per_agent_day,
    used,
    limit: limits.max_runs_per_agent_day,
  };
}
