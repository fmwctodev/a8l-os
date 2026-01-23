import { supabase } from '../lib/supabase';
import type {
  Report,
  ReportRun,
  ReportFilters,
  ReportConfig,
  ReportDataSource,
  ReportVisualizationType,
  ReportVisibility,
  ReportStats,
} from '../types';

export async function getReports(
  organizationId: string,
  filters?: ReportFilters
): Promise<Report[]> {
  let query = supabase
    .from('reports')
    .select(`
      *,
      created_by_user:users!reports_created_by_fkey(id, name, email, avatar_url),
      department:departments(id, name)
    `)
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });

  if (filters?.dataSource) {
    query = query.eq('data_source', filters.dataSource);
  }

  if (filters?.visibility) {
    query = query.eq('visibility', filters.visibility);
  }

  if (filters?.createdBy) {
    query = query.eq('created_by', filters.createdBy);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching reports:', error);
    throw new Error('Failed to fetch reports');
  }

  return data || [];
}

export async function getReportById(reportId: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      created_by_user:users!reports_created_by_fkey(id, name, email, avatar_url),
      department:departments(id, name),
      schedules:report_schedules(*)
    `)
    .eq('id', reportId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching report:', error);
    throw new Error('Failed to fetch report');
  }

  return data;
}

export async function createReport(
  organizationId: string,
  userId: string,
  data: {
    name: string;
    description?: string;
    data_source: ReportDataSource;
    config: ReportConfig;
    visualization_type: ReportVisualizationType;
    visibility?: ReportVisibility;
    department_id?: string;
  }
): Promise<Report> {
  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      name: data.name,
      description: data.description || null,
      data_source: data.data_source,
      config: data.config,
      visualization_type: data.visualization_type,
      visibility: data.visibility || 'private',
      department_id: data.department_id || null,
    })
    .select(`
      *,
      created_by_user:users!reports_created_by_fkey(id, name, email, avatar_url),
      department:departments(id, name)
    `)
    .single();

  if (error) {
    console.error('Error creating report:', error);
    throw new Error('Failed to create report');
  }

  return report;
}

export async function updateReport(
  reportId: string,
  data: {
    name?: string;
    description?: string;
    data_source?: ReportDataSource;
    config?: ReportConfig;
    visualization_type?: ReportVisualizationType;
    visibility?: ReportVisibility;
    department_id?: string | null;
  }
): Promise<Report> {
  const { data: report, error } = await supabase
    .from('reports')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select(`
      *,
      created_by_user:users!reports_created_by_fkey(id, name, email, avatar_url),
      department:departments(id, name)
    `)
    .single();

  if (error) {
    console.error('Error updating report:', error);
    throw new Error('Failed to update report');
  }

  return report;
}

export async function deleteReport(reportId: string): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', reportId);

  if (error) {
    console.error('Error deleting report:', error);
    throw new Error('Failed to delete report');
  }
}

export async function duplicateReport(
  reportId: string,
  userId: string,
  newName: string
): Promise<Report> {
  const original = await getReportById(reportId);
  if (!original) {
    throw new Error('Report not found');
  }

  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      organization_id: original.organization_id,
      created_by: userId,
      name: newName,
      description: original.description,
      data_source: original.data_source,
      config: original.config,
      visualization_type: original.visualization_type,
      visibility: 'private',
      department_id: original.department_id,
    })
    .select(`
      *,
      created_by_user:users!reports_created_by_fkey(id, name, email, avatar_url),
      department:departments(id, name)
    `)
    .single();

  if (error) {
    console.error('Error duplicating report:', error);
    throw new Error('Failed to duplicate report');
  }

  return report;
}

export async function getReportRuns(
  reportId: string,
  limit: number = 50
): Promise<ReportRun[]> {
  const { data, error } = await supabase
    .from('report_runs')
    .select(`
      *,
      triggered_by_user:users(id, name, email, avatar_url),
      exports:report_exports(*)
    `)
    .eq('report_id', reportId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching report runs:', error);
    throw new Error('Failed to fetch report runs');
  }

  return data || [];
}

export async function createReportRun(
  organizationId: string,
  reportId: string,
  triggeredBy: 'user' | 'schedule',
  userId?: string
): Promise<ReportRun> {
  const { data, error } = await supabase
    .from('report_runs')
    .insert({
      organization_id: organizationId,
      report_id: reportId,
      triggered_by: triggeredBy,
      triggered_by_user_id: userId || null,
      status: 'running',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating report run:', error);
    throw new Error('Failed to create report run');
  }

  return data;
}

export async function updateReportRun(
  runId: string,
  data: {
    status?: 'running' | 'success' | 'failed';
    row_count?: number;
    error?: string;
    finished_at?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('report_runs')
    .update(data)
    .eq('id', runId);

  if (error) {
    console.error('Error updating report run:', error);
    throw new Error('Failed to update report run');
  }
}

export async function getReportStats(organizationId: string): Promise<ReportStats> {
  const { data: reports, error: reportsError } = await supabase
    .from('reports')
    .select('id')
    .eq('organization_id', organizationId);

  if (reportsError) {
    throw new Error('Failed to get report stats');
  }

  const { data: schedules, error: schedulesError } = await supabase
    .from('report_schedules')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('enabled', true);

  if (schedulesError) {
    throw new Error('Failed to get schedule stats');
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: exports, error: exportsError } = await supabase
    .from('report_exports')
    .select('id')
    .eq('organization_id', organizationId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (exportsError) {
    throw new Error('Failed to get export stats');
  }

  const { data: lastRun, error: lastRunError } = await supabase
    .from('report_runs')
    .select('finished_at')
    .eq('organization_id', organizationId)
    .eq('status', 'success')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    totalReports: reports?.length || 0,
    scheduledReports: schedules?.length || 0,
    exportsThisMonth: exports?.length || 0,
    lastRunDate: lastRun?.finished_at || null,
  };
}
