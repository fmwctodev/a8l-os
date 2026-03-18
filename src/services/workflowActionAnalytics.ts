import { supabase } from '../lib/supabase';

export interface ActionLog {
  id: string;
  org_id: string;
  enrollment_id: string | null;
  action_type: string;
  status: 'success' | 'failed' | 'skipped' | 'pending';
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActionStats {
  action_type: string;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  success_rate: number;
}

export async function logActionExecution(
  orgId: string,
  enrollmentId: string | null,
  actionType: string,
  status: ActionLog['status'],
  notes?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabase.from('workflow_action_logs').insert({
    org_id: orgId,
    enrollment_id: enrollmentId,
    action_type: actionType,
    status,
    notes: notes ?? null,
    metadata: metadata ?? {},
  });
}

export async function getActionStats(orgId: string, days = 30): Promise<ActionStats[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('workflow_action_logs')
    .select('action_type, status')
    .eq('org_id', orgId)
    .gte('created_at', since.toISOString());

  if (error || !data) return [];

  const map = new Map<string, ActionStats>();

  for (const row of data) {
    if (!map.has(row.action_type)) {
      map.set(row.action_type, { action_type: row.action_type, total: 0, success: 0, failed: 0, skipped: 0, success_rate: 0 });
    }
    const s = map.get(row.action_type)!;
    s.total++;
    if (row.status === 'success') s.success++;
    else if (row.status === 'failed') s.failed++;
    else if (row.status === 'skipped') s.skipped++;
  }

  for (const s of map.values()) {
    s.success_rate = s.total > 0 ? Math.round((s.success / s.total) * 100) : 0;
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export async function getActionErrorRate(orgId: string, actionType: string, days = 7): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from('workflow_action_logs')
    .select('status')
    .eq('org_id', orgId)
    .eq('action_type', actionType)
    .gte('created_at', since.toISOString());

  if (!data || data.length === 0) return 0;
  const failed = data.filter(r => r.status === 'failed').length;
  return Math.round((failed / data.length) * 100);
}

export async function getRecentActionLogs(
  orgId: string,
  limit = 50,
  actionType?: string
): Promise<ActionLog[]> {
  let query = supabase
    .from('workflow_action_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (actionType) {
    query = query.eq('action_type', actionType);
  }

  const { data } = await query;
  return (data ?? []) as ActionLog[];
}

export async function getActionLogsByEnrollment(enrollmentId: string): Promise<ActionLog[]> {
  const { data } = await supabase
    .from('workflow_action_logs')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: true });

  return (data ?? []) as ActionLog[];
}
