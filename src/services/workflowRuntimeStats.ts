import { supabase } from '../lib/supabase';

export interface AutomationOverviewStats {
  totalWorkflows: number;
  publishedWorkflows: number;
  draftWorkflows: number;
  totalEnrollmentsActive: number;
  totalEnrollmentsToday: number;
  totalCompletedToday: number;
  totalErroredToday: number;
  pendingApprovals: number;
  pendingDelayedJobs: number;
  eventsProcessedToday: number;
}

export interface WorkflowHealthRow {
  id: string;
  name: string;
  status: string;
  activeEnrollments: number;
  completedLast24h: number;
  erroredLast24h: number;
  avgCompletionMinutes: number | null;
  lastTriggeredAt: string | null;
}

export interface EventProcessingStats {
  hour: string;
  processed: number;
  errors: number;
}

export async function getAutomationOverview(orgId: string): Promise<AutomationOverviewStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [
    workflowsResult,
    activeEnrollmentsResult,
    todayEnrollmentsResult,
    completedTodayResult,
    erroredTodayResult,
    approvalsResult,
    delayedResult,
    eventsResult,
  ] = await Promise.all([
    supabase
      .from('workflows')
      .select('status', { count: 'exact' })
      .eq('org_id', orgId)
      .neq('status', 'archived'),
    supabase
      .from('workflow_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('status', ['active', 'waiting']),
    supabase
      .from('workflow_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', todayIso),
    supabase
      .from('workflow_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .gte('completed_at', todayIso),
    supabase
      .from('workflow_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'errored')
      .gte('updated_at', todayIso),
    supabase
      .from('workflow_approval_queue')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'pending'),
    supabase
      .from('delayed_action_queue')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'waiting'),
    supabase
      .from('event_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .not('processed_at', 'is', null)
      .gte('created_at', todayIso),
  ]);

  const workflows = workflowsResult.data || [];
  const publishedCount = workflows.filter((w) => w.status === 'published').length;
  const draftCount = workflows.filter((w) => w.status === 'draft').length;

  return {
    totalWorkflows: workflowsResult.count ?? 0,
    publishedWorkflows: publishedCount,
    draftWorkflows: draftCount,
    totalEnrollmentsActive: activeEnrollmentsResult.count ?? 0,
    totalEnrollmentsToday: todayEnrollmentsResult.count ?? 0,
    totalCompletedToday: completedTodayResult.count ?? 0,
    totalErroredToday: erroredTodayResult.count ?? 0,
    pendingApprovals: approvalsResult.count ?? 0,
    pendingDelayedJobs: delayedResult.count ?? 0,
    eventsProcessedToday: eventsResult.count ?? 0,
  };
}

export async function getWorkflowHealthRows(orgId: string): Promise<WorkflowHealthRow[]> {
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  const { data: workflows, error } = await supabase
    .from('workflows')
    .select('id, name, status')
    .eq('org_id', orgId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });

  if (error || !workflows) return [];

  const workflowIds = workflows.map((w) => w.id);
  if (workflowIds.length === 0) return [];

  const { data: enrollments } = await supabase
    .from('workflow_enrollments')
    .select('workflow_id, status, created_at, completed_at')
    .in('workflow_id', workflowIds);

  const enrollmentsByWorkflow = new Map<string, typeof enrollments>();
  for (const e of enrollments || []) {
    const list = enrollmentsByWorkflow.get(e.workflow_id) || [];
    list.push(e);
    enrollmentsByWorkflow.set(e.workflow_id, list);
  }

  return workflows.map((w) => {
    const wEnrollments = enrollmentsByWorkflow.get(w.id) || [];
    const active = wEnrollments.filter((e) => e.status === 'active' || e.status === 'waiting').length;
    const completedRecent = wEnrollments.filter(
      (e) => e.status === 'completed' && e.completed_at && e.completed_at >= yesterday
    ).length;
    const erroredRecent = wEnrollments.filter(
      (e) => e.status === 'errored' && e.created_at >= yesterday
    ).length;

    const completedWithTime = wEnrollments.filter(
      (e) => e.status === 'completed' && e.completed_at
    );
    let avgMinutes: number | null = null;
    if (completedWithTime.length > 0) {
      const totalMs = completedWithTime.reduce((sum, e) => {
        return sum + (new Date(e.completed_at!).getTime() - new Date(e.created_at).getTime());
      }, 0);
      avgMinutes = Math.round(totalMs / completedWithTime.length / 60000);
    }

    const sorted = [...wEnrollments].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return {
      id: w.id,
      name: w.name,
      status: w.status,
      activeEnrollments: active,
      completedLast24h: completedRecent,
      erroredLast24h: erroredRecent,
      avgCompletionMinutes: avgMinutes,
      lastTriggeredAt: sorted[0]?.created_at || null,
    };
  });
}

export interface WorkflowNodeStats {
  /** Number of distinct enrollments that have entered this node. */
  entered: number;
  /** Number of distinct enrollments that fully completed this node (node_completed). */
  completed: number;
  /** Number of node_started events without a matching node_completed (errored or in-progress). */
  inProgress: number;
  /** Number of times an action errored at this node. */
  errored: number;
  /** Average duration in milliseconds across completed runs of this node. */
  avgDurationMs: number | null;
  /** Most recent execution_log timestamp for this node. */
  lastExecutedAt: string | null;
}

/**
 * Aggregates workflow_execution_logs by node_id for a single workflow.
 *
 * Returns a map of node_id → stats, suitable for the canvas overlay badge.
 * The map only contains nodes that have at least one log entry — nodes that
 * have never run won't appear (the overlay component should treat missing
 * keys as zero across the board).
 */
export async function getWorkflowNodeStats(
  workflowId: string,
  options: { sinceHours?: number } = {}
): Promise<Record<string, WorkflowNodeStats>> {
  const sinceIso = options.sinceHours
    ? new Date(Date.now() - options.sinceHours * 3600000).toISOString()
    : null;

  const { data: enrollments } = await supabase
    .from('workflow_enrollments')
    .select('id')
    .eq('workflow_id', workflowId);

  const enrollmentIds = (enrollments || []).map((e) => e.id);
  if (enrollmentIds.length === 0) return {};

  let logsQuery = supabase
    .from('workflow_execution_logs')
    .select('enrollment_id, node_id, event_type, duration_ms, created_at')
    .in('enrollment_id', enrollmentIds);

  if (sinceIso) {
    logsQuery = logsQuery.gte('created_at', sinceIso);
  }

  const { data: logs } = await logsQuery;

  const byNode = new Map<
    string,
    {
      enteredEnrollments: Set<string>;
      completedEnrollments: Set<string>;
      erroredCount: number;
      durations: number[];
      lastAt: string | null;
    }
  >();

  for (const log of logs || []) {
    if (!log.node_id) continue;

    const entry =
      byNode.get(log.node_id) ||
      {
        enteredEnrollments: new Set<string>(),
        completedEnrollments: new Set<string>(),
        erroredCount: 0,
        durations: [] as number[],
        lastAt: null as string | null,
      };

    if (log.event_type === 'node_started' || log.event_type === 'trigger_fired') {
      entry.enteredEnrollments.add(log.enrollment_id);
    }
    if (log.event_type === 'node_completed') {
      entry.completedEnrollments.add(log.enrollment_id);
      if (typeof log.duration_ms === 'number') {
        entry.durations.push(log.duration_ms);
      }
    }
    if (
      log.event_type === 'node_failed' ||
      log.event_type === 'node_errored' ||
      log.event_type === 'action_failed'
    ) {
      entry.erroredCount += 1;
    }

    if (!entry.lastAt || log.created_at > entry.lastAt) {
      entry.lastAt = log.created_at;
    }

    byNode.set(log.node_id, entry);
  }

  const out: Record<string, WorkflowNodeStats> = {};
  for (const [nodeId, entry] of byNode.entries()) {
    const entered = entry.enteredEnrollments.size;
    const completed = entry.completedEnrollments.size;
    const avgDurationMs =
      entry.durations.length > 0
        ? Math.round(entry.durations.reduce((a, b) => a + b, 0) / entry.durations.length)
        : null;

    out[nodeId] = {
      entered,
      completed,
      inProgress: Math.max(0, entered - completed - entry.erroredCount),
      errored: entry.erroredCount,
      avgDurationMs,
      lastExecutedAt: entry.lastAt,
    };
  }

  return out;
}

export async function getEventProcessingTimeline(
  orgId: string,
  hours = 24
): Promise<EventProcessingStats[]> {
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  const { data: events } = await supabase
    .from('event_outbox')
    .select('created_at, processed_at')
    .eq('org_id', orgId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  const buckets = new Map<string, { processed: number; errors: number }>();
  for (const e of events || []) {
    const hour = new Date(e.created_at).toISOString().substring(0, 13) + ':00';
    const bucket = buckets.get(hour) || { processed: 0, errors: 0 };
    if (e.processed_at) {
      bucket.processed++;
    } else {
      bucket.errors++;
    }
    buckets.set(hour, bucket);
  }

  return Array.from(buckets.entries())
    .map(([hour, data]) => ({ hour, ...data }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}
