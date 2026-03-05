import type { User } from './index';

export type ReportScope = 'my' | 'team' | 'org';
export type ReportCategory = 'sales' | 'marketing' | 'ops' | 'reputation' | 'finance' | 'projects' | 'custom';
export type AIReportStatus = 'running' | 'complete' | 'failed';

export interface ReportPlanTimeframe {
  preset?: string;
  start: string;
  end: string;
}

export interface ReportPlanDataSource {
  module: string;
  entities: string[];
  fields: string[];
}

export interface ReportPlanAggregation {
  metric: string;
  operation: string;
  field: string;
  filters?: Array<{ field: string; op: string; value: string | number | boolean }>;
}

export interface ReportPlanGroupBy {
  name: string;
  field: string;
  metric: string;
  limit?: number;
}

export interface ReportPlanChart {
  chart_id: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  series: Array<{ label: string; metric: string }>;
  x: string;
}

export interface ReportPlanTable {
  table_id: string;
  type: 'summary' | 'breakdown';
  columns: string[];
  limit?: number;
}

export interface ReportPlan {
  type: 'report_plan';
  report_name: string;
  report_category: ReportCategory;
  scope: ReportScope;
  timeframe: ReportPlanTimeframe;
  data_sources: ReportPlanDataSource[];
  aggregations: ReportPlanAggregation[];
  group_bys: ReportPlanGroupBy[];
  charts: ReportPlanChart[];
  tables: ReportPlanTable[];
  privacy_rules: {
    no_raw_rows: boolean;
    top_n_only: boolean;
    max_groups: number;
  };
}

export interface ReportComposeKPI {
  label: string;
  value: number | string;
  delta_pct?: number | null;
  trend?: 'up' | 'down' | 'flat';
  format?: 'number' | 'currency' | 'percentage';
}

export interface ReportComposeChart {
  chart_id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  config: Record<string, unknown>;
  data: Array<Record<string, unknown>>;
}

export interface ReportComposeTable {
  table_id: string;
  title: string;
  columns: Array<{ key: string; label: string; format?: string }>;
  rows: Array<Record<string, unknown>>;
}

export interface DashboardCard {
  card_id: string;
  title: string;
  value: number | string;
  trend?: 'up' | 'down' | 'flat';
  delta_pct?: number | null;
  category?: ReportCategory;
  module_links?: string[];
}

export interface ReportCompose {
  type: 'report_compose';
  title: string;
  executive_summary: string;
  kpis: ReportComposeKPI[];
  charts: ReportComposeChart[];
  tables: ReportComposeTable[];
  insights: string[];
  recommendations: string[];
  dashboard_cards: DashboardCard[];
}

export interface AIReport {
  id: string;
  organization_id: string;
  created_by_user_id: string;
  scope: ReportScope;
  report_category: ReportCategory;
  report_name: string;
  timeframe_start: string | null;
  timeframe_end: string | null;
  status: AIReportStatus;
  plan_json: ReportPlan | null;
  result_json: ReportCompose | null;
  rendered_html: string | null;
  csv_data: string | null;
  parent_report_id: string | null;
  prompt: string;
  data_sources_used: string[];
  filters_applied: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  delete_at: string;
  created_by_user?: User;
  children?: AIReport[];
}

export interface AIReportSchedule {
  id: string;
  organization_id: string;
  user_id: string;
  report_plan_template_json: Record<string, unknown>;
  original_report_id: string | null;
  cadence_days: number;
  next_run_at: string;
  last_run_at: string | null;
  is_active: boolean;
  report_name_template: string;
  scope: ReportScope;
  prompt_template: string;
  created_at: string;
  updated_at: string;
  user?: User;
  original_report?: AIReport;
}

export interface AIReportFilters {
  category?: ReportCategory;
  scope?: ReportScope;
  status?: AIReportStatus;
  search?: string;
}

export interface AIReportStats {
  totalReports: number;
  runningReports: number;
  scheduledReports: number;
  lastGeneratedDate: string | null;
}

export interface GenerateReportRequest {
  prompt: string;
  scope: ReportScope;
  timeframe: {
    type: 'preset' | 'custom';
    preset?: string;
    customStart?: string;
    customEnd?: string;
  };
  parent_report_id?: string;
}

export interface GenerateReportResponse {
  success: boolean;
  report_id: string;
  report?: AIReport;
  error?: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  reportId?: string;
  report?: AIReport;
  isLoading?: boolean;
}
