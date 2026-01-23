import type { ReportDataSource, ReportDimension, ReportMetric, ReportAggregation, ReportDateGrouping } from '../types';

interface DimensionDefinition {
  field: string;
  label: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  supportsDateGrouping?: boolean;
}

interface MetricDefinition {
  field: string;
  label: string;
  aggregation: ReportAggregation;
  format?: 'number' | 'percentage' | 'currency' | 'duration';
}

interface DataSourceConfig {
  label: string;
  dimensions: DimensionDefinition[];
  metrics: MetricDefinition[];
  primaryDateField: string;
  baseTable: string;
}

export const dataSourceConfigs: Record<ReportDataSource, DataSourceConfig> = {
  contacts: {
    label: 'Contacts',
    primaryDateField: 'created_at',
    baseTable: 'contacts',
    dimensions: [
      { field: 'created_at', label: 'Created Date', dataType: 'date', supportsDateGrouping: true },
      { field: 'updated_at', label: 'Updated Date', dataType: 'date', supportsDateGrouping: true },
      { field: 'status', label: 'Status', dataType: 'string' },
      { field: 'source', label: 'Source', dataType: 'string' },
      { field: 'department_id', label: 'Department', dataType: 'string' },
      { field: 'owner_id', label: 'Owner', dataType: 'string' },
      { field: 'city', label: 'City', dataType: 'string' },
      { field: 'state', label: 'State', dataType: 'string' },
      { field: 'country', label: 'Country', dataType: 'string' },
      { field: 'company', label: 'Company', dataType: 'string' },
    ],
    metrics: [
      { field: 'id', label: 'Total Contacts', aggregation: 'count' },
      { field: 'id', label: 'Unique Contacts', aggregation: 'count_distinct' },
    ],
  },

  conversations: {
    label: 'Conversations',
    primaryDateField: 'created_at',
    baseTable: 'conversations',
    dimensions: [
      { field: 'created_at', label: 'Created Date', dataType: 'date', supportsDateGrouping: true },
      { field: 'last_message_at', label: 'Last Message Date', dataType: 'date', supportsDateGrouping: true },
      { field: 'status', label: 'Status', dataType: 'string' },
      { field: 'department_id', label: 'Department', dataType: 'string' },
      { field: 'assigned_user_id', label: 'Assigned User', dataType: 'string' },
    ],
    metrics: [
      { field: 'id', label: 'Total Conversations', aggregation: 'count' },
      { field: 'unread_count', label: 'Total Unread', aggregation: 'sum' },
      { field: 'unread_count', label: 'Avg Unread', aggregation: 'avg' },
    ],
  },

  appointments: {
    label: 'Appointments',
    primaryDateField: 'start_at_utc',
    baseTable: 'appointments',
    dimensions: [
      { field: 'start_at_utc', label: 'Appointment Date', dataType: 'date', supportsDateGrouping: true },
      { field: 'created_at', label: 'Created Date', dataType: 'date', supportsDateGrouping: true },
      { field: 'status', label: 'Status', dataType: 'string' },
      { field: 'source', label: 'Source', dataType: 'string' },
      { field: 'assigned_user_id', label: 'Assigned User', dataType: 'string' },
      { field: 'calendar_id', label: 'Calendar', dataType: 'string' },
      { field: 'appointment_type_id', label: 'Appointment Type', dataType: 'string' },
    ],
    metrics: [
      { field: 'id', label: 'Total Appointments', aggregation: 'count' },
      { field: 'status_scheduled', label: 'Scheduled', aggregation: 'count' },
      { field: 'status_completed', label: 'Completed', aggregation: 'count' },
      { field: 'status_canceled', label: 'Canceled', aggregation: 'count' },
      { field: 'status_no_show', label: 'No Show', aggregation: 'count' },
    ],
  },

  forms: {
    label: 'Form Submissions',
    primaryDateField: 'submitted_at',
    baseTable: 'form_submissions',
    dimensions: [
      { field: 'submitted_at', label: 'Submitted Date', dataType: 'date', supportsDateGrouping: true },
      { field: 'form_id', label: 'Form', dataType: 'string' },
      { field: 'processed_status', label: 'Processing Status', dataType: 'string' },
    ],
    metrics: [
      { field: 'id', label: 'Total Submissions', aggregation: 'count' },
      { field: 'contact_id', label: 'Unique Contacts', aggregation: 'count_distinct' },
    ],
  },

  surveys: {
    label: 'Survey Responses',
    primaryDateField: 'submitted_at',
    baseTable: 'survey_submissions',
    dimensions: [
      { field: 'submitted_at', label: 'Submitted Date', dataType: 'date', supportsDateGrouping: true },
      { field: 'survey_id', label: 'Survey', dataType: 'string' },
      { field: 'score_band', label: 'Score Band', dataType: 'string' },
      { field: 'processed_status', label: 'Processing Status', dataType: 'string' },
    ],
    metrics: [
      { field: 'id', label: 'Total Responses', aggregation: 'count' },
      { field: 'score_total', label: 'Average Score', aggregation: 'avg' },
      { field: 'score_total', label: 'Total Score', aggregation: 'sum' },
      { field: 'score_total', label: 'Min Score', aggregation: 'min' },
      { field: 'score_total', label: 'Max Score', aggregation: 'max' },
      { field: 'contact_id', label: 'Unique Respondents', aggregation: 'count_distinct' },
    ],
  },

  workflows: {
    label: 'Workflow Enrollments',
    primaryDateField: 'started_at',
    baseTable: 'workflow_enrollments',
    dimensions: [
      { field: 'started_at', label: 'Started Date', dataType: 'date', supportsDateGrouping: true },
      { field: 'updated_at', label: 'Updated Date', dataType: 'date', supportsDateGrouping: true },
      { field: 'workflow_id', label: 'Workflow', dataType: 'string' },
      { field: 'status', label: 'Status', dataType: 'string' },
    ],
    metrics: [
      { field: 'id', label: 'Total Enrollments', aggregation: 'count' },
      { field: 'status_active', label: 'Active', aggregation: 'count' },
      { field: 'status_completed', label: 'Completed', aggregation: 'count' },
      { field: 'status_stopped', label: 'Stopped', aggregation: 'count' },
      { field: 'status_errored', label: 'Errored', aggregation: 'count' },
      { field: 'contact_id', label: 'Unique Contacts', aggregation: 'count_distinct' },
    ],
  },
};

export function getDimensionsForDataSource(dataSource: ReportDataSource): ReportDimension[] {
  const config = dataSourceConfigs[dataSource];
  return config.dimensions.map((dim, index) => ({
    id: `${dataSource}_dim_${index}`,
    field: dim.field,
    label: dim.label,
    dataSource,
    dataType: dim.dataType,
    dateGrouping: dim.supportsDateGrouping ? 'day' as ReportDateGrouping : undefined,
  }));
}

export function getMetricsForDataSource(dataSource: ReportDataSource): ReportMetric[] {
  const config = dataSourceConfigs[dataSource];
  return config.metrics.map((metric, index) => ({
    id: `${dataSource}_metric_${index}`,
    field: metric.field,
    label: metric.label,
    dataSource,
    aggregation: metric.aggregation,
    format: metric.format,
  }));
}

export function getDataSourceLabel(dataSource: ReportDataSource): string {
  return dataSourceConfigs[dataSource].label;
}

export function getPrimaryDateField(dataSource: ReportDataSource): string {
  return dataSourceConfigs[dataSource].primaryDateField;
}

export function getBaseTable(dataSource: ReportDataSource): string {
  return dataSourceConfigs[dataSource].baseTable;
}

export const dateGroupingOptions: Array<{ value: ReportDateGrouping; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

export const timeRangePresets = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'all_time', label: 'All Time' },
] as const;

export const filterOperators = {
  string: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
    { value: 'in', label: 'Is one of' },
    { value: 'not_in', label: 'Is not one of' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'greater_than_or_equals', label: 'Greater than or equals' },
    { value: 'less_than_or_equals', label: 'Less than or equals' },
    { value: 'between', label: 'Between' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  date: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'greater_than', label: 'After' },
    { value: 'less_than', label: 'Before' },
    { value: 'between', label: 'Between' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  boolean: [
    { value: 'equals', label: 'Equals' },
  ],
} as const;

export const visualizationTypes = [
  { value: 'table', label: 'Table', icon: 'LayoutGrid' },
  { value: 'bar', label: 'Bar Chart', icon: 'BarChart3' },
  { value: 'line', label: 'Line Chart', icon: 'LineChart' },
  { value: 'pie', label: 'Pie Chart', icon: 'PieChart' },
] as const;

export const visibilityOptions = [
  { value: 'private', label: 'Private', description: 'Only you can view this report' },
  { value: 'department', label: 'Department', description: 'Anyone in your department can view' },
  { value: 'organization', label: 'Organization', description: 'Anyone in the organization can view' },
] as const;

export const scheduleCadenceOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

export const weekdayOptions = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

export const commonTimezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'UTC', label: 'UTC' },
] as const;
