import { supabase } from '../lib/supabase';

export interface WorkflowAnalyticsMetrics {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  failedEnrollments: number;
  stoppedEnrollments: number;
  avgCompletionTimeMs: number | null;
  dropOffRate: number;
  previousPeriod?: {
    totalEnrollments: number;
    completedEnrollments: number;
    failedEnrollments: number;
  };
}

export interface StepFunnelData {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  reached: number;
  succeeded: number;
  failed: number;
  waiting: number;
  skipped: number;
  avgDurationMs: number | null;
  branches?: {
    condition: string;
    count: number;
    percentage: number;
  }[];
}

export interface ErrorAggregate {
  nodeId: string;
  nodeName: string;
  errorType: string;
  errorMessage: string;
  count: number;
  lastOccurred: string;
  retrySuccessRate: number;
}

export interface AIPerformanceMetrics {
  totalRuns: number;
  avgLatencyMs: number;
  avgTokensUsed: number;
  approvalRate: number;
  rejectionReasons: { reason: string; count: number }[];
  replyRate: number;
  bookingRate: number;
  dealWonRate: number;
}

export interface WorkflowAnalytics {
  workflowId: string;
  timeRange: string;
  versionFilter: number | null;
  metrics: WorkflowAnalyticsMetrics;
  stepFunnel: StepFunnelData[];
  errors: ErrorAggregate[];
  aiPerformance: AIPerformanceMetrics | null;
  attribution: {
    messagesSent: number;
    appointmentsBooked: number;
    revenueInfluenced: number;
  };
  computedAt: string;
}

export type TimeRange = '7d' | '30d' | '90d' | 'custom';

function getDateRangeFilter(timeRange: TimeRange, customStart?: string, customEnd?: string): { start: string; end: string } {
  const end = new Date();
  let start = new Date();

  switch (timeRange) {
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case 'custom':
      if (customStart && customEnd) {
        return { start: customStart, end: customEnd };
      }
      start.setDate(start.getDate() - 30);
      break;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function getCacheKey(timeRange: string, versionFilter: number | null): string {
  return `${timeRange}:${versionFilter ?? 'all'}`;
}

export async function getWorkflowAnalytics(
  workflowId: string,
  timeRange: TimeRange = '30d',
  versionFilter: number | null = null,
  customStart?: string,
  customEnd?: string,
  bypassCache = false
): Promise<WorkflowAnalytics> {
  const cacheKey = getCacheKey(timeRange, versionFilter);

  if (!bypassCache) {
    const { data: cached } = await supabase
      .from('workflow_analytics_cache')
      .select('metrics, computed_at')
      .eq('workflow_id', workflowId)
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      return cached.metrics as WorkflowAnalytics;
    }
  }

  const dateRange = getDateRangeFilter(timeRange, customStart, customEnd);

  const [
    enrollmentMetrics,
    stepFunnelData,
    errorAggregates,
    aiMetrics,
    attributionData
  ] = await Promise.all([
    fetchEnrollmentMetrics(workflowId, dateRange, versionFilter),
    fetchStepFunnelData(workflowId, dateRange, versionFilter),
    fetchErrorAggregates(workflowId, dateRange, versionFilter),
    fetchAIPerformanceMetrics(workflowId, dateRange, versionFilter),
    fetchAttributionData(workflowId, dateRange, versionFilter)
  ]);

  const analytics: WorkflowAnalytics = {
    workflowId,
    timeRange,
    versionFilter,
    metrics: enrollmentMetrics,
    stepFunnel: stepFunnelData,
    errors: errorAggregates,
    aiPerformance: aiMetrics,
    attribution: attributionData,
    computedAt: new Date().toISOString()
  };

  const { data: workflow } = await supabase
    .from('workflows')
    .select('org_id')
    .eq('id', workflowId)
    .single();

  if (workflow) {
    await supabase
      .from('workflow_analytics_cache')
      .upsert({
        org_id: workflow.org_id,
        workflow_id: workflowId,
        cache_key: cacheKey,
        time_range: timeRange,
        version_filter: versionFilter,
        metrics: analytics,
        computed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      }, {
        onConflict: 'org_id,workflow_id,cache_key'
      });
  }

  return analytics;
}

async function fetchEnrollmentMetrics(
  workflowId: string,
  dateRange: { start: string; end: string },
  versionFilter: number | null
): Promise<WorkflowAnalyticsMetrics> {
  let query = supabase
    .from('workflow_enrollments')
    .select('id, status, started_at, completed_at, workflow_version_number')
    .eq('workflow_id', workflowId)
    .gte('started_at', dateRange.start)
    .lte('started_at', dateRange.end);

  if (versionFilter !== null) {
    query = query.eq('workflow_version_number', versionFilter);
  }

  const { data: enrollments } = await query;

  if (!enrollments || enrollments.length === 0) {
    return {
      totalEnrollments: 0,
      activeEnrollments: 0,
      completedEnrollments: 0,
      failedEnrollments: 0,
      stoppedEnrollments: 0,
      avgCompletionTimeMs: null,
      dropOffRate: 0
    };
  }

  const total = enrollments.length;
  const active = enrollments.filter(e => e.status === 'active').length;
  const completed = enrollments.filter(e => e.status === 'completed').length;
  const failed = enrollments.filter(e => e.status === 'errored').length;
  const stopped = enrollments.filter(e => e.status === 'stopped').length;

  const completedWithTime = enrollments.filter(
    e => e.status === 'completed' && e.completed_at && e.started_at
  );

  let avgCompletionTimeMs: number | null = null;
  if (completedWithTime.length > 0) {
    const totalMs = completedWithTime.reduce((sum, e) => {
      const start = new Date(e.started_at).getTime();
      const end = new Date(e.completed_at!).getTime();
      return sum + (end - start);
    }, 0);
    avgCompletionTimeMs = Math.round(totalMs / completedWithTime.length);
  }

  const dropOffRate = total > 0 ? (stopped + failed) / total : 0;

  const previousStart = new Date(dateRange.start);
  const previousEnd = new Date(dateRange.start);
  const rangeDays = Math.round(
    (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)
  );
  previousStart.setDate(previousStart.getDate() - rangeDays);

  let prevQuery = supabase
    .from('workflow_enrollments')
    .select('status')
    .eq('workflow_id', workflowId)
    .gte('started_at', previousStart.toISOString())
    .lt('started_at', dateRange.start);

  if (versionFilter !== null) {
    prevQuery = prevQuery.eq('workflow_version_number', versionFilter);
  }

  const { data: prevEnrollments } = await prevQuery;

  const previousPeriod = prevEnrollments ? {
    totalEnrollments: prevEnrollments.length,
    completedEnrollments: prevEnrollments.filter(e => e.status === 'completed').length,
    failedEnrollments: prevEnrollments.filter(e => e.status === 'errored').length
  } : undefined;

  return {
    totalEnrollments: total,
    activeEnrollments: active,
    completedEnrollments: completed,
    failedEnrollments: failed,
    stoppedEnrollments: stopped,
    avgCompletionTimeMs,
    dropOffRate,
    previousPeriod
  };
}

async function fetchStepFunnelData(
  workflowId: string,
  dateRange: { start: string; end: string },
  versionFilter: number | null
): Promise<StepFunnelData[]> {
  const { data: workflow } = await supabase
    .from('workflows')
    .select('published_definition')
    .eq('id', workflowId)
    .single();

  if (!workflow?.published_definition) {
    return [];
  }

  const definition = workflow.published_definition as {
    nodes: { id: string; type: string; data: { label?: string; name?: string } }[];
    edges: { source: string; target: string; sourceHandle?: string }[];
  };

  let enrollmentQuery = supabase
    .from('workflow_enrollments')
    .select('id')
    .eq('workflow_id', workflowId)
    .gte('started_at', dateRange.start)
    .lte('started_at', dateRange.end);

  if (versionFilter !== null) {
    enrollmentQuery = enrollmentQuery.eq('workflow_version_number', versionFilter);
  }

  const { data: enrollments } = await enrollmentQuery;
  const enrollmentIds = enrollments?.map(e => e.id) || [];

  if (enrollmentIds.length === 0) {
    return definition.nodes.map(node => ({
      nodeId: node.id,
      nodeName: node.data.label || node.data.name || node.id,
      nodeType: node.type,
      reached: 0,
      succeeded: 0,
      failed: 0,
      waiting: 0,
      skipped: 0,
      avgDurationMs: null
    }));
  }

  const { data: logs } = await supabase
    .from('workflow_execution_logs')
    .select('node_id, event_type, duration_ms, payload')
    .in('enrollment_id', enrollmentIds);

  const nodeStats = new Map<string, {
    reached: number;
    succeeded: number;
    failed: number;
    waiting: number;
    skipped: number;
    totalDurationMs: number;
    durationCount: number;
    branchCounts: Map<string, number>;
  }>();

  definition.nodes.forEach(node => {
    nodeStats.set(node.id, {
      reached: 0,
      succeeded: 0,
      failed: 0,
      waiting: 0,
      skipped: 0,
      totalDurationMs: 0,
      durationCount: 0,
      branchCounts: new Map()
    });
  });

  logs?.forEach(log => {
    const stats = nodeStats.get(log.node_id);
    if (!stats) return;

    switch (log.event_type) {
      case 'node_started':
        stats.reached++;
        break;
      case 'node_completed':
        stats.succeeded++;
        if (log.duration_ms) {
          stats.totalDurationMs += log.duration_ms;
          stats.durationCount++;
        }
        if (log.payload?.branch) {
          const current = stats.branchCounts.get(log.payload.branch) || 0;
          stats.branchCounts.set(log.payload.branch, current + 1);
        }
        break;
      case 'node_failed':
        stats.failed++;
        break;
      case 'node_waiting':
        stats.waiting++;
        break;
      case 'node_skipped':
        stats.skipped++;
        break;
    }
  });

  return definition.nodes.map(node => {
    const stats = nodeStats.get(node.id)!;
    const branches: { condition: string; count: number; percentage: number }[] = [];

    if (stats.branchCounts.size > 0) {
      const totalBranches = Array.from(stats.branchCounts.values()).reduce((a, b) => a + b, 0);
      stats.branchCounts.forEach((count, condition) => {
        branches.push({
          condition,
          count,
          percentage: totalBranches > 0 ? (count / totalBranches) * 100 : 0
        });
      });
    }

    return {
      nodeId: node.id,
      nodeName: node.data.label || node.data.name || node.id,
      nodeType: node.type,
      reached: stats.reached,
      succeeded: stats.succeeded,
      failed: stats.failed,
      waiting: stats.waiting,
      skipped: stats.skipped,
      avgDurationMs: stats.durationCount > 0
        ? Math.round(stats.totalDurationMs / stats.durationCount)
        : null,
      branches: branches.length > 0 ? branches : undefined
    };
  });
}

async function fetchErrorAggregates(
  workflowId: string,
  dateRange: { start: string; end: string },
  versionFilter: number | null
): Promise<ErrorAggregate[]> {
  let enrollmentQuery = supabase
    .from('workflow_enrollments')
    .select('id')
    .eq('workflow_id', workflowId)
    .gte('started_at', dateRange.start)
    .lte('started_at', dateRange.end);

  if (versionFilter !== null) {
    enrollmentQuery = enrollmentQuery.eq('workflow_version_number', versionFilter);
  }

  const { data: enrollments } = await enrollmentQuery;
  const enrollmentIds = enrollments?.map(e => e.id) || [];

  if (enrollmentIds.length === 0) {
    return [];
  }

  const { data: errorLogs } = await supabase
    .from('workflow_execution_logs')
    .select('node_id, payload, created_at')
    .in('enrollment_id', enrollmentIds)
    .eq('event_type', 'node_failed')
    .order('created_at', { ascending: false });

  if (!errorLogs || errorLogs.length === 0) {
    return [];
  }

  const { data: workflow } = await supabase
    .from('workflows')
    .select('published_definition')
    .eq('id', workflowId)
    .single();

  const definition = workflow?.published_definition as {
    nodes: { id: string; data: { label?: string; name?: string } }[];
  } | null;

  const nodeNameMap = new Map<string, string>();
  definition?.nodes.forEach(node => {
    nodeNameMap.set(node.id, node.data.label || node.data.name || node.id);
  });

  const errorMap = new Map<string, {
    nodeId: string;
    nodeName: string;
    errorType: string;
    errorMessage: string;
    count: number;
    lastOccurred: string;
    retrySuccesses: number;
    retryAttempts: number;
  }>();

  errorLogs.forEach(log => {
    const errorType = log.payload?.error_type || 'unknown';
    const errorMessage = log.payload?.error_message || 'Unknown error';
    const key = `${log.node_id}:${errorType}:${errorMessage}`;

    const existing = errorMap.get(key);
    if (existing) {
      existing.count++;
      if (new Date(log.created_at) > new Date(existing.lastOccurred)) {
        existing.lastOccurred = log.created_at;
      }
    } else {
      errorMap.set(key, {
        nodeId: log.node_id,
        nodeName: nodeNameMap.get(log.node_id) || log.node_id,
        errorType,
        errorMessage,
        count: 1,
        lastOccurred: log.created_at,
        retrySuccesses: 0,
        retryAttempts: 0
      });
    }
  });

  return Array.from(errorMap.values())
    .map(e => ({
      nodeId: e.nodeId,
      nodeName: e.nodeName,
      errorType: e.errorType,
      errorMessage: e.errorMessage,
      count: e.count,
      lastOccurred: e.lastOccurred,
      retrySuccessRate: e.retryAttempts > 0 ? e.retrySuccesses / e.retryAttempts : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

async function fetchAIPerformanceMetrics(
  workflowId: string,
  dateRange: { start: string; end: string },
  versionFilter: number | null
): Promise<AIPerformanceMetrics | null> {
  const { data: workflow } = await supabase
    .from('workflows')
    .select('published_definition')
    .eq('id', workflowId)
    .single();

  const definition = workflow?.published_definition as {
    nodes: { type: string; data: { actionType?: string } }[];
  } | null;

  const hasAINodes = definition?.nodes.some(
    n => n.type === 'action' && n.data.actionType?.startsWith('ai_')
  );

  if (!hasAINodes) {
    return null;
  }

  let enrollmentQuery = supabase
    .from('workflow_enrollments')
    .select('id')
    .eq('workflow_id', workflowId)
    .gte('started_at', dateRange.start)
    .lte('started_at', dateRange.end);

  if (versionFilter !== null) {
    enrollmentQuery = enrollmentQuery.eq('workflow_version_number', versionFilter);
  }

  const { data: enrollments } = await enrollmentQuery;
  const enrollmentIds = enrollments?.map(e => e.id) || [];

  if (enrollmentIds.length === 0) {
    return {
      totalRuns: 0,
      avgLatencyMs: 0,
      avgTokensUsed: 0,
      approvalRate: 0,
      rejectionReasons: [],
      replyRate: 0,
      bookingRate: 0,
      dealWonRate: 0
    };
  }

  const { data: aiRuns } = await supabase
    .from('workflow_ai_runs')
    .select('*')
    .in('enrollment_id', enrollmentIds);

  if (!aiRuns || aiRuns.length === 0) {
    return {
      totalRuns: 0,
      avgLatencyMs: 0,
      avgTokensUsed: 0,
      approvalRate: 0,
      rejectionReasons: [],
      replyRate: 0,
      bookingRate: 0,
      dealWonRate: 0
    };
  }

  const totalRuns = aiRuns.length;
  const avgLatencyMs = Math.round(
    aiRuns.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / totalRuns
  );
  const avgTokensUsed = Math.round(
    aiRuns.reduce((sum, r) => sum + (r.tokens_used || 0), 0) / totalRuns
  );

  const pendingApproval = aiRuns.filter(r => r.status === 'pending_approval');
  const approved = aiRuns.filter(r => r.status === 'approved');
  const rejected = aiRuns.filter(r => r.status === 'rejected');

  const approvalRate = pendingApproval.length + approved.length + rejected.length > 0
    ? approved.length / (approved.length + rejected.length + pendingApproval.length)
    : 1;

  const rejectionReasons: { reason: string; count: number }[] = [];
  const reasonCounts = new Map<string, number>();
  rejected.forEach(r => {
    const reason = r.rejection_reason || 'No reason provided';
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  });
  reasonCounts.forEach((count, reason) => {
    rejectionReasons.push({ reason, count });
  });

  const { data: signals } = await supabase
    .from('ai_workflow_learning_signals')
    .select('signal_type, signal_value')
    .in('ai_run_id', aiRuns.map(r => r.id));

  let replies = 0;
  let bookings = 0;
  let deals = 0;

  signals?.forEach(s => {
    if (s.signal_type === 'reply_received' && s.signal_value) replies++;
    if (s.signal_type === 'appointment_booked' && s.signal_value) bookings++;
    if (s.signal_type === 'deal_won' && s.signal_value) deals++;
  });

  return {
    totalRuns,
    avgLatencyMs,
    avgTokensUsed,
    approvalRate,
    rejectionReasons: rejectionReasons.sort((a, b) => b.count - a.count),
    replyRate: totalRuns > 0 ? replies / totalRuns : 0,
    bookingRate: totalRuns > 0 ? bookings / totalRuns : 0,
    dealWonRate: totalRuns > 0 ? deals / totalRuns : 0
  };
}

async function fetchAttributionData(
  workflowId: string,
  dateRange: { start: string; end: string },
  versionFilter: number | null
): Promise<{ messagesSent: number; appointmentsBooked: number; revenueInfluenced: number }> {
  let enrollmentQuery = supabase
    .from('workflow_enrollments')
    .select('id, contact_id')
    .eq('workflow_id', workflowId)
    .gte('started_at', dateRange.start)
    .lte('started_at', dateRange.end);

  if (versionFilter !== null) {
    enrollmentQuery = enrollmentQuery.eq('workflow_version_number', versionFilter);
  }

  const { data: enrollments } = await enrollmentQuery;

  if (!enrollments || enrollments.length === 0) {
    return { messagesSent: 0, appointmentsBooked: 0, revenueInfluenced: 0 };
  }

  const enrollmentIds = enrollments.map(e => e.id);

  const { data: logs } = await supabase
    .from('workflow_execution_logs')
    .select('payload')
    .in('enrollment_id', enrollmentIds)
    .eq('event_type', 'node_completed');

  let messagesSent = 0;
  let appointmentsBooked = 0;

  logs?.forEach(log => {
    if (log.payload?.action_type === 'send_sms' || log.payload?.action_type === 'send_email') {
      messagesSent++;
    }
    if (log.payload?.action_type === 'book_appointment' && log.payload?.appointment_id) {
      appointmentsBooked++;
    }
  });

  const contactIds = enrollments.map(e => e.contact_id);
  const thirtyDaysAgo = new Date(dateRange.start);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: paidInvoices } = await supabase
    .from('invoices')
    .select('amount_paid')
    .in('contact_id', contactIds)
    .eq('status', 'paid')
    .gte('paid_at', thirtyDaysAgo.toISOString())
    .lte('paid_at', dateRange.end);

  const revenueInfluenced = paidInvoices?.reduce(
    (sum, inv) => sum + (inv.amount_paid || 0),
    0
  ) || 0;

  return {
    messagesSent,
    appointmentsBooked,
    revenueInfluenced
  };
}

export async function getVersionComparison(
  workflowId: string,
  version1: number,
  version2: number,
  timeRange: TimeRange = '30d'
): Promise<{
  version1Metrics: WorkflowAnalyticsMetrics;
  version2Metrics: WorkflowAnalyticsMetrics;
  deltas: {
    completionRateChange: number;
    avgTimeChange: number;
    dropOffRateChange: number;
  };
}> {
  const [analytics1, analytics2] = await Promise.all([
    getWorkflowAnalytics(workflowId, timeRange, version1),
    getWorkflowAnalytics(workflowId, timeRange, version2)
  ]);

  const v1CompletionRate = analytics1.metrics.totalEnrollments > 0
    ? analytics1.metrics.completedEnrollments / analytics1.metrics.totalEnrollments
    : 0;
  const v2CompletionRate = analytics2.metrics.totalEnrollments > 0
    ? analytics2.metrics.completedEnrollments / analytics2.metrics.totalEnrollments
    : 0;

  return {
    version1Metrics: analytics1.metrics,
    version2Metrics: analytics2.metrics,
    deltas: {
      completionRateChange: v2CompletionRate - v1CompletionRate,
      avgTimeChange: (analytics2.metrics.avgCompletionTimeMs || 0) -
        (analytics1.metrics.avgCompletionTimeMs || 0),
      dropOffRateChange: analytics2.metrics.dropOffRate - analytics1.metrics.dropOffRate
    }
  };
}

export async function invalidateAnalyticsCache(workflowId: string): Promise<void> {
  await supabase
    .from('workflow_analytics_cache')
    .delete()
    .eq('workflow_id', workflowId);
}
