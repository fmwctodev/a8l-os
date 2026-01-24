import { supabase } from '../lib/supabase';
import type {
  AIReportQuery,
  AIQueryRequest,
  AIQueryResponse,
  AIReportQueryFilters,
  ReportTimeRange,
  AIQueryDataScope,
} from '../types';

export async function askQuestion(
  orgId: string,
  userId: string,
  request: AIQueryRequest
): Promise<AIQueryResponse> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-report-query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organization_id: orgId,
        user_id: userId,
        query_text: request.query_text,
        data_scope: request.data_scope,
        time_range: request.time_range,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to process query');
  }

  return result;
}

export async function getQueryHistory(
  orgId: string,
  userId: string,
  filters?: AIReportQueryFilters
): Promise<AIReportQuery[]> {
  let query = supabase
    .from('ai_report_queries')
    .select('*, user:users(id, first_name, last_name, email), saved_as_report:reports(*)')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.search) {
    query = query.ilike('query_text', `%${filters.search}%`);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  } else {
    query = query.limit(50);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getQueryById(queryId: string): Promise<AIReportQuery | null> {
  const { data, error } = await supabase
    .from('ai_report_queries')
    .select('*, user:users(id, first_name, last_name, email), saved_as_report:reports(*)')
    .eq('id', queryId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveQueryAsReport(
  queryId: string,
  orgId: string,
  userId: string,
  reportName: string,
  visibility: 'private' | 'department' | 'organization',
  departmentId?: string
): Promise<{ reportId: string }> {
  const query = await getQueryById(queryId);
  if (!query) {
    throw new Error('Query not found');
  }

  const responseData = query.response_data;
  const dataSources = query.data_sources_used || [];
  const primaryDataSource = dataSources[0] || 'contacts';

  const { data: report, error: reportError } = await supabase
    .from('reports')
    .insert({
      organization_id: orgId,
      name: reportName,
      description: `AI-generated report from query: "${query.query_text}"`,
      data_source: primaryDataSource,
      config: {
        dimensions: [],
        metrics: [],
        filters: [],
        timeRange: query.time_range || { type: 'preset', preset: 'last_30_days' },
        sorting: [],
      },
      visualization_type: responseData?.chart_type || 'table',
      visibility,
      department_id: visibility === 'department' ? departmentId : null,
      report_type: 'ai_generated',
      created_by: userId,
    })
    .select()
    .single();

  if (reportError) throw reportError;

  const { error: updateError } = await supabase
    .from('ai_report_queries')
    .update({ saved_as_report_id: report.id })
    .eq('id', queryId);

  if (updateError) {
    console.error('Failed to link query to report:', updateError);
  }

  return { reportId: report.id };
}

export async function deleteQuery(queryId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_report_queries')
    .delete()
    .eq('id', queryId);

  if (error) throw error;
}

export async function getAIReportingStats(
  orgId: string,
  userId: string
): Promise<{
  totalQueries: number;
  savedReports: number;
  totalTokensUsed: number;
  avgExecutionTime: number;
}> {
  const { data, error } = await supabase
    .from('ai_report_queries')
    .select('id, tokens_used, execution_time_ms, saved_as_report_id')
    .eq('organization_id', orgId)
    .eq('user_id', userId);

  if (error) throw error;

  const queries = data || [];
  const totalQueries = queries.length;
  const savedReports = queries.filter(q => q.saved_as_report_id).length;
  const totalTokensUsed = queries.reduce((sum, q) => sum + (q.tokens_used || 0), 0);
  const avgExecutionTime = totalQueries > 0
    ? queries.reduce((sum, q) => sum + (q.execution_time_ms || 0), 0) / totalQueries
    : 0;

  return {
    totalQueries,
    savedReports,
    totalTokensUsed,
    avgExecutionTime: Math.round(avgExecutionTime),
  };
}

export const defaultTimeRange: ReportTimeRange = {
  type: 'preset',
  preset: 'last_30_days',
};

export const defaultDataScope: AIQueryDataScope = 'my_data';

export const exampleQueries = [
  'How many new contacts did we get this month?',
  'What is the total value of won opportunities this quarter?',
  'Show me the top 5 lead sources by contact count',
  'How many conversations are currently open?',
  'What is our average deal size?',
  'Show appointments scheduled for next week',
  'How many invoices are overdue?',
  'What is the average response time for conversations?',
  'Show revenue by month for this year',
  'Which agent has the most completed tasks?',
];
