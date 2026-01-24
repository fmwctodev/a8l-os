import { supabase } from '../lib/supabase';
import type { AIUsageLog, AIUsageMetrics, AIUsageLogFilters, ExportFormat } from '../types';

export interface PaginatedLogs {
  data: AIUsageLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getUsageMetrics(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<AIUsageMetrics> {
  const { data: logs, error } = await supabase
    .from('ai_usage_logs')
    .select('*')
    .eq('org_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (error) throw error;

  const allLogs = logs || [];
  const successfulLogs = allLogs.filter(l => l.status === 'success');
  const failedLogs = allLogs.filter(l => l.status === 'failed');

  const agentCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();

  let totalDuration = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  allLogs.forEach(log => {
    agentCounts.set(log.agent_name, (agentCounts.get(log.agent_name) || 0) + 1);
    modelCounts.set(log.model_key, (modelCounts.get(log.model_key) || 0) + 1);

    const day = log.created_at.split('T')[0];
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);

    totalDuration += log.duration_ms || 0;
    totalInputTokens += log.input_tokens || 0;
    totalOutputTokens += log.output_tokens || 0;
  });

  return {
    total_runs: allLogs.length,
    successful_runs: successfulLogs.length,
    failed_runs: failedLogs.length,
    success_rate: allLogs.length > 0 ? (successfulLogs.length / allLogs.length) * 100 : 100,
    error_rate: allLogs.length > 0 ? (failedLogs.length / allLogs.length) * 100 : 0,
    avg_duration_ms: allLogs.length > 0 ? Math.round(totalDuration / allLogs.length) : 0,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    runs_by_agent: Array.from(agentCounts.entries())
      .map(([agent_name, count]) => ({ agent_name, count }))
      .sort((a, b) => b.count - a.count),
    runs_by_model: Array.from(modelCounts.entries())
      .map(([model_key, count]) => ({ model_key, count }))
      .sort((a, b) => b.count - a.count),
    runs_by_day: Array.from(dayCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function getUsageLogs(
  orgId: string,
  filters: AIUsageLogFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedLogs> {
  let query = supabase
    .from('ai_usage_logs')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }
  if (filters.agentIds && filters.agentIds.length > 0) {
    query = query.in('agent_id', filters.agentIds);
  }
  if (filters.userIds && filters.userIds.length > 0) {
    query = query.in('user_id', filters.userIds);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.search) {
    query = query.or(`action_summary.ilike.%${filters.search}%,agent_name.ilike.%${filters.search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: data || [],
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function exportLogsCSV(
  orgId: string,
  filters: AIUsageLogFilters
): Promise<string> {
  const logs = await getAllLogsForExport(orgId, filters);

  const headers = [
    'Timestamp',
    'Agent Name',
    'User',
    'Model',
    'Action',
    'Status',
    'Duration (ms)',
    'Input Tokens',
    'Output Tokens',
    'Error Message',
  ];

  const rows = logs.map(log => [
    log.created_at,
    escapeCSV(log.agent_name),
    escapeCSV(log.user_name || ''),
    escapeCSV(log.model_key),
    escapeCSV(log.action_summary),
    log.status,
    log.duration_ms.toString(),
    (log.input_tokens || '').toString(),
    (log.output_tokens || '').toString(),
    escapeCSV(log.error_message || ''),
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

export async function exportLogsJSON(
  orgId: string,
  filters: AIUsageLogFilters
): Promise<string> {
  const logs = await getAllLogsForExport(orgId, filters);

  const exportData = logs.map(log => ({
    timestamp: log.created_at,
    agent_name: log.agent_name,
    agent_id: log.agent_id,
    user_name: log.user_name,
    user_id: log.user_id,
    model: log.model_key,
    action: log.action_summary,
    status: log.status,
    duration_ms: log.duration_ms,
    input_tokens: log.input_tokens,
    output_tokens: log.output_tokens,
    error_message: log.error_message,
    metadata: log.metadata,
  }));

  return JSON.stringify(exportData, null, 2);
}

async function getAllLogsForExport(
  orgId: string,
  filters: AIUsageLogFilters
): Promise<AIUsageLog[]> {
  let query = supabase
    .from('ai_usage_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }
  if (filters.agentIds && filters.agentIds.length > 0) {
    query = query.in('agent_id', filters.agentIds);
  }
  if (filters.userIds && filters.userIds.length > 0) {
    query = query.in('user_id', filters.userIds);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.search) {
    query = query.or(`action_summary.ilike.%${filters.search}%,agent_name.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function createUsageLog(
  orgId: string,
  input: {
    agent_id: string | null;
    agent_name: string;
    user_id: string | null;
    user_name?: string;
    model_key: string;
    action_summary: string;
    status: 'success' | 'failed';
    error_message?: string;
    duration_ms: number;
    input_tokens?: number;
    output_tokens?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<AIUsageLog> {
  const { data, error } = await supabase
    .from('ai_usage_logs')
    .insert({
      org_id: orgId,
      ...input,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
