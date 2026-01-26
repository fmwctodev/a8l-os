import { supabase } from '../lib/supabase';
import type {
  AIWorkflowLearningSignal,
  AIOutcomeType,
  AIWorkflowActionType,
  AIActionPerformanceStats,
  AINodePerformance,
} from '../types';

export async function captureOutcomeSignal(input: {
  org_id: string;
  workflow_id: string;
  node_id: string;
  agent_id?: string | null;
  workflow_ai_run_id: string;
  contact_id?: string | null;
  conversation_id?: string | null;
  channel?: string | null;
  ai_action_type: AIWorkflowActionType;
  outcome_type: AIOutcomeType;
  outcome_value?: number | null;
  sentiment_score?: number | null;
  time_to_outcome_ms?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<AIWorkflowLearningSignal> {
  const { data, error } = await supabase
    .from('ai_workflow_learning_signals')
    .insert({
      org_id: input.org_id,
      workflow_id: input.workflow_id,
      node_id: input.node_id,
      agent_id: input.agent_id,
      workflow_ai_run_id: input.workflow_ai_run_id,
      contact_id: input.contact_id,
      conversation_id: input.conversation_id,
      channel: input.channel,
      ai_action_type: input.ai_action_type,
      outcome_type: input.outcome_type,
      outcome_value: input.outcome_value,
      sentiment_score: input.sentiment_score,
      time_to_outcome_ms: input.time_to_outcome_ms,
      metadata: input.metadata || {},
      captured_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as AIWorkflowLearningSignal;
}

export async function findRecentAIRunForContact(
  contactId: string,
  actionTypes: AIWorkflowActionType[],
  windowMs: number = 24 * 60 * 60 * 1000
): Promise<{ id: string; workflow_id: string; node_id: string; agent_id: string | null; ai_action_type: AIWorkflowActionType; created_at: string } | null> {
  const cutoffTime = new Date(Date.now() - windowMs).toISOString();

  const { data, error } = await supabase
    .from('workflow_ai_runs')
    .select('id, workflow_id, node_id, agent_id, ai_action_type, created_at')
    .eq('contact_id', contactId)
    .in('ai_action_type', actionTypes)
    .eq('status', 'success')
    .gte('created_at', cutoffTime)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function linkReplyToAIAction(
  orgId: string,
  contactId: string,
  conversationId: string,
  messageReceivedAt: string
): Promise<AIWorkflowLearningSignal | null> {
  const recentRun = await findRecentAIRunForContact(
    contactId,
    ['ai_conversation_reply', 'ai_email_draft', 'ai_follow_up_message'],
    24 * 60 * 60 * 1000
  );

  if (!recentRun) return null;

  const timeToOutcome = new Date(messageReceivedAt).getTime() - new Date(recentRun.created_at).getTime();

  return captureOutcomeSignal({
    org_id: orgId,
    workflow_id: recentRun.workflow_id,
    node_id: recentRun.node_id,
    agent_id: recentRun.agent_id,
    workflow_ai_run_id: recentRun.id,
    contact_id: contactId,
    conversation_id: conversationId,
    ai_action_type: recentRun.ai_action_type,
    outcome_type: 'reply_received',
    time_to_outcome_ms: timeToOutcome,
  });
}

export async function linkBookingToAIAction(
  orgId: string,
  contactId: string,
  appointmentId: string,
  bookedAt: string
): Promise<AIWorkflowLearningSignal | null> {
  const recentRun = await findRecentAIRunForContact(
    contactId,
    ['ai_booking_assist', 'ai_conversation_reply', 'ai_follow_up_message'],
    48 * 60 * 60 * 1000
  );

  if (!recentRun) return null;

  const timeToOutcome = new Date(bookedAt).getTime() - new Date(recentRun.created_at).getTime();

  return captureOutcomeSignal({
    org_id: orgId,
    workflow_id: recentRun.workflow_id,
    node_id: recentRun.node_id,
    agent_id: recentRun.agent_id,
    workflow_ai_run_id: recentRun.id,
    contact_id: contactId,
    ai_action_type: recentRun.ai_action_type,
    outcome_type: 'booking_made',
    time_to_outcome_ms: timeToOutcome,
    metadata: { appointment_id: appointmentId },
  });
}

export async function linkDealToQualification(
  orgId: string,
  contactId: string,
  opportunityId: string,
  closedAt: string,
  won: boolean
): Promise<AIWorkflowLearningSignal | null> {
  const recentRun = await findRecentAIRunForContact(
    contactId,
    ['ai_lead_qualification'],
    30 * 24 * 60 * 60 * 1000
  );

  if (!recentRun) return null;

  const timeToOutcome = new Date(closedAt).getTime() - new Date(recentRun.created_at).getTime();

  return captureOutcomeSignal({
    org_id: orgId,
    workflow_id: recentRun.workflow_id,
    node_id: recentRun.node_id,
    agent_id: recentRun.agent_id,
    workflow_ai_run_id: recentRun.id,
    contact_id: contactId,
    ai_action_type: 'ai_lead_qualification',
    outcome_type: won ? 'deal_won' : 'no_response',
    time_to_outcome_ms: timeToOutcome,
    metadata: { opportunity_id: opportunityId, won },
  });
}

export async function recordSentimentSignal(
  orgId: string,
  workflowAiRunId: string,
  sentimentScore: number,
  isPositive: boolean
): Promise<AIWorkflowLearningSignal> {
  const { data: run, error: runError } = await supabase
    .from('workflow_ai_runs')
    .select('workflow_id, node_id, agent_id, contact_id, conversation_id, ai_action_type')
    .eq('id', workflowAiRunId)
    .single();

  if (runError) throw runError;

  return captureOutcomeSignal({
    org_id: orgId,
    workflow_id: run.workflow_id,
    node_id: run.node_id,
    agent_id: run.agent_id,
    workflow_ai_run_id: workflowAiRunId,
    contact_id: run.contact_id,
    conversation_id: run.conversation_id,
    ai_action_type: run.ai_action_type,
    outcome_type: isPositive ? 'positive_sentiment' : 'negative_sentiment',
    sentiment_score: sentimentScore,
  });
}

export async function getSignalsByAIRun(
  workflowAiRunId: string
): Promise<AIWorkflowLearningSignal[]> {
  const { data, error } = await supabase
    .from('ai_workflow_learning_signals')
    .select('*')
    .eq('workflow_ai_run_id', workflowAiRunId)
    .order('captured_at', { ascending: true });

  if (error) throw error;
  return data as AIWorkflowLearningSignal[];
}

export async function getSignalsByWorkflow(
  workflowId: string,
  options?: {
    outcomeType?: AIOutcomeType;
    actionType?: AIWorkflowActionType;
    dateRange?: { start: string; end: string };
    limit?: number;
  }
): Promise<AIWorkflowLearningSignal[]> {
  let query = supabase
    .from('ai_workflow_learning_signals')
    .select('*')
    .eq('workflow_id', workflowId);

  if (options?.outcomeType) {
    query = query.eq('outcome_type', options.outcomeType);
  }
  if (options?.actionType) {
    query = query.eq('ai_action_type', options.actionType);
  }
  if (options?.dateRange) {
    query = query
      .gte('captured_at', options.dateRange.start)
      .lte('captured_at', options.dateRange.end);
  }

  query = query.order('captured_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as AIWorkflowLearningSignal[];
}

export async function getActionPerformanceStats(
  workflowId: string,
  actionType: AIWorkflowActionType,
  dateRange?: { start: string; end: string }
): Promise<AIActionPerformanceStats> {
  let runsQuery = supabase
    .from('workflow_ai_runs')
    .select('id, status, latency_ms, tokens_used')
    .eq('workflow_id', workflowId)
    .eq('ai_action_type', actionType);

  let signalsQuery = supabase
    .from('ai_workflow_learning_signals')
    .select('outcome_type')
    .eq('workflow_id', workflowId)
    .eq('ai_action_type', actionType);

  if (dateRange) {
    runsQuery = runsQuery
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);
    signalsQuery = signalsQuery
      .gte('captured_at', dateRange.start)
      .lte('captured_at', dateRange.end);
  }

  const [runsResult, signalsResult] = await Promise.all([
    runsQuery,
    signalsQuery,
  ]);

  if (runsResult.error) throw runsResult.error;
  if (signalsResult.error) throw signalsResult.error;

  const runs = runsResult.data || [];
  const signals = signalsResult.data || [];

  const totalRuns = runs.length;
  const successRuns = runs.filter(r => r.status === 'success').length;
  const successRate = totalRuns > 0 ? successRuns / totalRuns : 0;

  const completedRuns = runs.filter(r => r.latency_ms != null);
  const avgLatencyMs = completedRuns.length
    ? completedRuns.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / completedRuns.length
    : 0;

  const avgTokens = runs.length
    ? runs.reduce((sum, r) => sum + (r.tokens_used || 0), 0) / runs.length
    : 0;

  const outcomes = signals.reduce((acc, s) => {
    acc[s.outcome_type as AIOutcomeType] = (acc[s.outcome_type as AIOutcomeType] || 0) + 1;
    return acc;
  }, {} as Record<AIOutcomeType, number>);

  const replyCount = outcomes.reply_received || 0;
  const bookingCount = outcomes.booking_made || 0;
  const dealWonCount = outcomes.deal_won || 0;

  return {
    total_runs: totalRuns,
    success_rate: successRate,
    avg_latency_ms: Math.round(avgLatencyMs),
    avg_tokens: Math.round(avgTokens),
    outcomes,
    reply_rate: totalRuns > 0 ? replyCount / totalRuns : 0,
    booking_rate: totalRuns > 0 ? bookingCount / totalRuns : 0,
    conversion_rate: totalRuns > 0 ? dealWonCount / totalRuns : 0,
  };
}

export async function getNodePerformance(
  workflowId: string,
  nodeId: string,
  dateRange?: { start: string; end: string }
): Promise<AINodePerformance> {
  let runsQuery = supabase
    .from('workflow_ai_runs')
    .select('status')
    .eq('workflow_id', workflowId)
    .eq('node_id', nodeId);

  let signalsQuery = supabase
    .from('ai_workflow_learning_signals')
    .select('outcome_type')
    .eq('workflow_id', workflowId)
    .eq('node_id', nodeId);

  if (dateRange) {
    runsQuery = runsQuery
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);
    signalsQuery = signalsQuery
      .gte('captured_at', dateRange.start)
      .lte('captured_at', dateRange.end);
  }

  const [runsResult, signalsResult] = await Promise.all([
    runsQuery,
    signalsQuery,
  ]);

  if (runsResult.error) throw runsResult.error;
  if (signalsResult.error) throw signalsResult.error;

  const runs = runsResult.data || [];
  const signals = signalsResult.data || [];

  const totalRuns = runs.length;
  const successCount = runs.filter(r => r.status === 'success').length;
  const failureCount = runs.filter(r => r.status === 'failed').length;
  const pendingApprovalCount = runs.filter(r => r.status === 'pending_approval').length;

  const outcomes = signals.reduce((acc, s) => {
    acc[s.outcome_type as AIOutcomeType] = (acc[s.outcome_type as AIOutcomeType] || 0) + 1;
    return acc;
  }, {} as Record<AIOutcomeType, number>);

  return {
    node_id: nodeId,
    workflow_id: workflowId,
    total_runs: totalRuns,
    success_count: successCount,
    failure_count: failureCount,
    pending_approval_count: pendingApprovalCount,
    success_rate: totalRuns > 0 ? successCount / totalRuns : 0,
    avg_latency_ms: 0,
    outcomes,
  };
}

export async function getTopPerformingPrompts(
  orgId: string,
  limit: number = 10
): Promise<Array<{
  workflow_id: string;
  node_id: string;
  ai_action_type: AIWorkflowActionType;
  success_rate: number;
  reply_rate: number;
  total_runs: number;
}>> {
  const { data: runs, error: runsError } = await supabase
    .from('workflow_ai_runs')
    .select('workflow_id, node_id, ai_action_type, status')
    .eq('org_id', orgId);

  if (runsError) throw runsError;

  const { data: signals, error: signalsError } = await supabase
    .from('ai_workflow_learning_signals')
    .select('workflow_id, node_id, outcome_type')
    .eq('org_id', orgId);

  if (signalsError) throw signalsError;

  const nodeStats = new Map<string, {
    workflow_id: string;
    node_id: string;
    ai_action_type: AIWorkflowActionType;
    total: number;
    success: number;
    replies: number;
  }>();

  for (const run of runs || []) {
    const key = `${run.workflow_id}:${run.node_id}`;
    if (!nodeStats.has(key)) {
      nodeStats.set(key, {
        workflow_id: run.workflow_id,
        node_id: run.node_id,
        ai_action_type: run.ai_action_type,
        total: 0,
        success: 0,
        replies: 0,
      });
    }
    const stats = nodeStats.get(key)!;
    stats.total++;
    if (run.status === 'success') stats.success++;
  }

  for (const signal of signals || []) {
    const key = `${signal.workflow_id}:${signal.node_id}`;
    const stats = nodeStats.get(key);
    if (stats && signal.outcome_type === 'reply_received') {
      stats.replies++;
    }
  }

  const results = Array.from(nodeStats.values())
    .filter(s => s.total >= 5)
    .map(s => ({
      workflow_id: s.workflow_id,
      node_id: s.node_id,
      ai_action_type: s.ai_action_type,
      success_rate: s.total > 0 ? s.success / s.total : 0,
      reply_rate: s.total > 0 ? s.replies / s.total : 0,
      total_runs: s.total,
    }))
    .sort((a, b) => (b.success_rate + b.reply_rate) - (a.success_rate + a.reply_rate))
    .slice(0, limit);

  return results;
}

export async function generateRecommendations(
  workflowId: string
): Promise<Array<{
  type: 'warning' | 'suggestion' | 'improvement';
  nodeId?: string;
  message: string;
  metric?: string;
  value?: number;
}>> {
  const recommendations: Array<{
    type: 'warning' | 'suggestion' | 'improvement';
    nodeId?: string;
    message: string;
    metric?: string;
    value?: number;
  }> = [];

  const { data: runs, error: runsError } = await supabase
    .from('workflow_ai_runs')
    .select('node_id, status, ai_action_type, latency_ms')
    .eq('workflow_id', workflowId);

  if (runsError) throw runsError;

  const nodeRuns = new Map<string, { total: number; failed: number; avgLatency: number; latencies: number[] }>();

  for (const run of runs || []) {
    if (!nodeRuns.has(run.node_id)) {
      nodeRuns.set(run.node_id, { total: 0, failed: 0, avgLatency: 0, latencies: [] });
    }
    const stats = nodeRuns.get(run.node_id)!;
    stats.total++;
    if (run.status === 'failed') stats.failed++;
    if (run.latency_ms) stats.latencies.push(run.latency_ms);
  }

  for (const [nodeId, stats] of nodeRuns) {
    const failureRate = stats.total > 0 ? stats.failed / stats.total : 0;
    if (failureRate > 0.2 && stats.total >= 5) {
      recommendations.push({
        type: 'warning',
        nodeId,
        message: `High failure rate detected (${Math.round(failureRate * 100)}%). Consider reviewing the agent configuration or prompt.`,
        metric: 'failure_rate',
        value: failureRate,
      });
    }

    if (stats.latencies.length > 0) {
      const avgLatency = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
      if (avgLatency > 5000) {
        recommendations.push({
          type: 'suggestion',
          nodeId,
          message: `High average latency (${Math.round(avgLatency)}ms). Consider reducing context size or using a faster model.`,
          metric: 'avg_latency_ms',
          value: avgLatency,
        });
      }
    }
  }

  const { data: signals, error: signalsError } = await supabase
    .from('ai_workflow_learning_signals')
    .select('node_id, outcome_type')
    .eq('workflow_id', workflowId);

  if (signalsError) throw signalsError;

  const nodeOutcomes = new Map<string, { runs: number; replies: number }>();
  for (const [nodeId, stats] of nodeRuns) {
    nodeOutcomes.set(nodeId, { runs: stats.total, replies: 0 });
  }

  for (const signal of signals || []) {
    const stats = nodeOutcomes.get(signal.node_id);
    if (stats && signal.outcome_type === 'reply_received') {
      stats.replies++;
    }
  }

  for (const [nodeId, stats] of nodeOutcomes) {
    if (stats.runs >= 10) {
      const replyRate = stats.replies / stats.runs;
      if (replyRate > 0.5) {
        recommendations.push({
          type: 'improvement',
          nodeId,
          message: `Great reply rate (${Math.round(replyRate * 100)}%)! This node is performing well.`,
          metric: 'reply_rate',
          value: replyRate,
        });
      } else if (replyRate < 0.1) {
        recommendations.push({
          type: 'suggestion',
          nodeId,
          message: `Low reply rate (${Math.round(replyRate * 100)}%). Consider adjusting the message tone or timing.`,
          metric: 'reply_rate',
          value: replyRate,
        });
      }
    }
  }

  return recommendations;
}
