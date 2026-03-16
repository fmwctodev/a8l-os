import { supabase } from '../lib/supabase';

interface TriggerEvaluation {
  orgId: string;
  workflowId: string;
  triggerId: string;
  triggerType: string;
  entityType: string;
  entityId: string;
  matched: boolean;
  evaluationTimeMs: number;
  payload?: Record<string, unknown>;
  configSnapshot?: Record<string, unknown>;
}

export async function logTriggerEvaluation(eval_: TriggerEvaluation): Promise<void> {
  try {
    await supabase.from('trigger_evaluation_logs').insert({
      org_id: eval_.orgId,
      workflow_id: eval_.workflowId,
      trigger_id: eval_.triggerId,
      trigger_type: eval_.triggerType,
      entity_type: eval_.entityType,
      entity_id: eval_.entityId,
      matched: eval_.matched,
      evaluation_time_ms: eval_.evaluationTimeMs,
      payload_summary: eval_.payload ? summarizePayload(eval_.payload) : null,
      config_snapshot: eval_.configSnapshot ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[TriggerAnalytics] Failed to log evaluation:', err);
  }
}

export async function getTriggerStats(
  orgId: string,
  workflowId?: string,
  dateRange?: { from: string; to: string }
): Promise<{
  totalEvaluations: number;
  matchedCount: number;
  mismatchCount: number;
  avgEvalTimeMs: number;
  byTriggerType: Record<string, { total: number; matched: number }>;
}> {
  let query = supabase
    .from('trigger_evaluation_logs')
    .select('trigger_type, matched, evaluation_time_ms')
    .eq('org_id', orgId);

  if (workflowId) {
    query = query.eq('workflow_id', workflowId);
  }
  if (dateRange) {
    query = query.gte('created_at', dateRange.from).lte('created_at', dateRange.to);
  }

  const { data, error } = await query.limit(10000);
  if (error || !data) {
    return { totalEvaluations: 0, matchedCount: 0, mismatchCount: 0, avgEvalTimeMs: 0, byTriggerType: {} };
  }

  const byTriggerType: Record<string, { total: number; matched: number }> = {};
  let totalTime = 0;
  let matchedCount = 0;

  for (const row of data) {
    const tt = row.trigger_type as string;
    if (!byTriggerType[tt]) {
      byTriggerType[tt] = { total: 0, matched: 0 };
    }
    byTriggerType[tt].total++;
    if (row.matched) {
      byTriggerType[tt].matched++;
      matchedCount++;
    }
    totalTime += (row.evaluation_time_ms as number) || 0;
  }

  return {
    totalEvaluations: data.length,
    matchedCount,
    mismatchCount: data.length - matchedCount,
    avgEvalTimeMs: data.length > 0 ? Math.round(totalTime / data.length) : 0,
    byTriggerType,
  };
}

export async function getRecentEvaluations(
  orgId: string,
  workflowId: string,
  limit = 50
): Promise<Array<{
  id: string;
  triggerType: string;
  entityId: string;
  matched: boolean;
  evaluationTimeMs: number;
  createdAt: string;
}>> {
  const { data, error } = await supabase
    .from('trigger_evaluation_logs')
    .select('id, trigger_type, entity_id, matched, evaluation_time_ms, created_at')
    .eq('org_id', orgId)
    .eq('workflow_id', workflowId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(row => ({
    id: row.id,
    triggerType: row.trigger_type,
    entityId: row.entity_id,
    matched: row.matched,
    evaluationTimeMs: row.evaluation_time_ms,
    createdAt: row.created_at,
  }));
}

function summarizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  const keys = Object.keys(payload).slice(0, 20);
  for (const key of keys) {
    const val = payload[key];
    if (typeof val === 'string' && val.length > 200) {
      summary[key] = val.substring(0, 200) + '...';
    } else if (Array.isArray(val)) {
      summary[key] = `[Array(${val.length})]`;
    } else {
      summary[key] = val;
    }
  }
  return summary;
}
