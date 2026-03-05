import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';
import type {
  AIReport,
  AIReportFilters,
  AIReportStats,
  GenerateReportRequest,
  GenerateReportResponse,
  ReportScope,
} from '../types/aiReports';

const REPORT_SELECT = `
  *,
  created_by_user:users!ai_reports_created_by_user_id_fkey(id, name, email, avatar_url)
`;

export async function generateReport(
  organizationId: string,
  userId: string,
  request: GenerateReportRequest
): Promise<GenerateReportResponse> {
  const response = await callEdgeFunction('ai-report-generate', {
    prompt: request.prompt,
    scope: request.scope,
    timeframe: request.timeframe,
    parent_report_id: request.parent_report_id || null,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    return {
      success: false,
      report_id: data.report_id || '',
      error: data.error?.message || data.error || 'Report generation failed',
    };
  }

  return {
    success: true,
    report_id: data.report_id,
    report: data.report,
  };
}

export async function getAIReports(
  organizationId: string,
  filters?: AIReportFilters
): Promise<AIReport[]> {
  let query = supabase
    .from('ai_reports')
    .select(REPORT_SELECT)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (filters?.category) {
    query = query.eq('report_category', filters.category);
  }
  if (filters?.scope) {
    query = query.eq('scope', filters.scope);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    query = query.ilike('report_name', `%${filters.search}%`);
  }

  const { data, error } = await query.limit(100);

  if (error) throw error;
  return (data || []) as AIReport[];
}

export async function getAIReportById(reportId: string): Promise<AIReport | null> {
  const { data, error } = await supabase
    .from('ai_reports')
    .select(REPORT_SELECT)
    .eq('id', reportId)
    .maybeSingle();

  if (error) throw error;
  return data as AIReport | null;
}

export async function getReportVersions(reportId: string): Promise<AIReport[]> {
  const report = await getAIReportById(reportId);
  if (!report) return [];

  const rootId = report.parent_report_id || report.id;

  const { data, error } = await supabase
    .from('ai_reports')
    .select(REPORT_SELECT)
    .or(`id.eq.${rootId},parent_report_id.eq.${rootId}`)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as AIReport[];
}

export async function duplicateReport(
  reportId: string,
  userId: string
): Promise<AIReport> {
  const original = await getAIReportById(reportId);
  if (!original) throw new Error('Report not found');

  const { data, error } = await supabase
    .from('ai_reports')
    .insert({
      organization_id: original.organization_id,
      created_by_user_id: userId,
      scope: original.scope,
      report_category: original.report_category,
      report_name: `${original.report_name} (Copy)`,
      timeframe_start: original.timeframe_start,
      timeframe_end: original.timeframe_end,
      status: original.status,
      plan_json: original.plan_json,
      result_json: original.result_json,
      rendered_html: original.rendered_html,
      csv_data: original.csv_data,
      prompt: original.prompt,
      data_sources_used: original.data_sources_used,
      filters_applied: original.filters_applied,
    })
    .select(REPORT_SELECT)
    .single();

  if (error) throw error;
  return data as AIReport;
}

export async function deleteReport(reportId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_reports')
    .delete()
    .eq('id', reportId);

  if (error) throw error;
}

export async function getAIReportStats(organizationId: string): Promise<AIReportStats> {
  const [totalRes, runningRes, scheduledRes, lastRes] = await Promise.all([
    supabase
      .from('ai_reports')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('ai_reports')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'running'),
    supabase
      .from('ai_report_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_active', true),
    supabase
      .from('ai_reports')
      .select('created_at')
      .eq('organization_id', organizationId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    totalReports: totalRes.count || 0,
    runningReports: runningRes.count || 0,
    scheduledReports: scheduledRes.count || 0,
    lastGeneratedDate: lastRes.data?.created_at || null,
  };
}

export async function pollReportStatus(
  reportId: string,
  onUpdate?: (report: AIReport) => void,
  maxAttempts = 60,
  intervalMs = 3000
): Promise<AIReport> {
  for (let i = 0; i < maxAttempts; i++) {
    const report = await getAIReportById(reportId);
    if (!report) throw new Error('Report not found');

    if (onUpdate) onUpdate(report);

    if (report.status === 'complete' || report.status === 'failed') {
      return report;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Report generation timed out');
}

export function getReportCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    sales: 'Sales',
    marketing: 'Marketing',
    ops: 'Operations',
    reputation: 'Reputation',
    finance: 'Finance',
    projects: 'Projects',
    custom: 'Custom',
  };
  return labels[category] || 'Custom';
}

export function getScopeLabel(scope: ReportScope): string {
  const labels: Record<string, string> = {
    my: 'My Data',
    team: 'Team',
    org: 'Organization',
  };
  return labels[scope] || scope;
}

export const SUGGESTED_PROMPTS = [
  'Sales performance report for last 30 days',
  'Revenue breakdown by source this quarter',
  'Outstanding invoices and overdue payments',
  'Contact acquisition trends this month',
  'Task completion rates by team member',
  'Appointment show rate analysis',
  'Marketing form conversion funnel',
  'Customer review sentiment summary',
  'Pipeline health and deal velocity',
  'AI agent usage and performance metrics',
];

export const REPORT_CATEGORIES = [
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'ops', label: 'Operations' },
  { value: 'reputation', label: 'Reputation' },
  { value: 'finance', label: 'Finance' },
  { value: 'projects', label: 'Projects' },
  { value: 'custom', label: 'Custom' },
] as const;

export const TIMEFRAME_OPTIONS = [
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
] as const;

export const SCOPE_OPTIONS = [
  { value: 'my' as ReportScope, label: 'My Data', minRole: null },
  { value: 'team' as ReportScope, label: 'Team Data', minRole: 'Manager' },
  { value: 'org' as ReportScope, label: 'Organization Data', minRole: 'Admin' },
] as const;
