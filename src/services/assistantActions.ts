import { supabase } from '../lib/supabase';
import type { AssistantActionLog, ActionExecutionStatus } from '../types/assistant';

interface ActionLogFilters {
  targetModule?: string;
  executionStatus?: ActionExecutionStatus;
  limit?: number;
  offset?: number;
}

export async function getActionLogs(
  userId: string,
  filters: ActionLogFilters = {}
): Promise<{ data: AssistantActionLog[]; count: number }> {
  const { targetModule, executionStatus, limit = 30, offset = 0 } = filters;

  let query = supabase
    .from('assistant_action_logs')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  if (targetModule && targetModule !== 'all') {
    query = query.eq('target_module', targetModule);
  }

  if (executionStatus) {
    query = query.eq('execution_status', executionStatus);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return {
    data: (data || []) as AssistantActionLog[],
    count: count || 0,
  };
}

export async function getActionLogDetail(logId: string): Promise<AssistantActionLog | null> {
  const { data, error } = await supabase
    .from('assistant_action_logs')
    .select('*')
    .eq('id', logId)
    .maybeSingle();

  if (error) throw error;
  return data as AssistantActionLog | null;
}

export async function getRecentActions(
  userId: string,
  limit: number = 20
): Promise<AssistantActionLog[]> {
  const { data, error } = await supabase
    .from('assistant_action_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as AssistantActionLog[];
}
