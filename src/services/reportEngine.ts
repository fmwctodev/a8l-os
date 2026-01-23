import { supabase } from '../lib/supabase';
import type {
  ReportConfig,
  ReportDataSource,
  ReportQueryResult,
  ReportDimension,
  ReportMetric,
  ReportFilter,
  ReportTimeRange,
} from '../types';
import { dataSourceConfigs, getBaseTable, getPrimaryDateField } from '../config/reportingFields';

const PREVIEW_ROW_LIMIT = 5000;

function getDateGroupingSql(field: string, grouping: string): string {
  switch (grouping) {
    case 'day':
      return `DATE_TRUNC('day', ${field})`;
    case 'week':
      return `DATE_TRUNC('week', ${field})`;
    case 'month':
      return `DATE_TRUNC('month', ${field})`;
    case 'quarter':
      return `DATE_TRUNC('quarter', ${field})`;
    case 'year':
      return `DATE_TRUNC('year', ${field})`;
    default:
      return field;
  }
}

function buildDimensionSelect(dim: ReportDimension, alias: string): string {
  const field = `${alias}.${dim.field}`;
  if (dim.dataType === 'date' && dim.dateGrouping) {
    return `${getDateGroupingSql(field, dim.dateGrouping)} AS "${dim.id}"`;
  }
  return `${field} AS "${dim.id}"`;
}

function buildMetricSelect(metric: ReportMetric, alias: string, dataSource: ReportDataSource): string {
  const config = dataSourceConfigs[dataSource];

  if (metric.field.startsWith('status_')) {
    const statusValue = metric.field.replace('status_', '');
    return `COUNT(CASE WHEN ${alias}.status = '${statusValue}' THEN 1 END) AS "${metric.id}"`;
  }

  const field = `${alias}.${metric.field}`;

  switch (metric.aggregation) {
    case 'count':
      return `COUNT(${field}) AS "${metric.id}"`;
    case 'count_distinct':
      return `COUNT(DISTINCT ${field}) AS "${metric.id}"`;
    case 'sum':
      return `COALESCE(SUM(${field}), 0) AS "${metric.id}"`;
    case 'avg':
      return `COALESCE(AVG(${field}), 0) AS "${metric.id}"`;
    case 'min':
      return `MIN(${field}) AS "${metric.id}"`;
    case 'max':
      return `MAX(${field}) AS "${metric.id}"`;
    default:
      return `COUNT(${field}) AS "${metric.id}"`;
  }
}

function getTimeRangeBounds(timeRange: ReportTimeRange): { start: string | null; end: string | null } {
  if (timeRange.type === 'custom') {
    return {
      start: timeRange.customStart || null,
      end: timeRange.customEnd || null,
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date | null = null;
  let end: Date | null = null;

  switch (timeRange.preset) {
    case 'today':
      start = today;
      end = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'yesterday':
      start = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      end = today;
      break;
    case 'last_7_days':
      start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'last_30_days':
      start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      end = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'last_90_days':
      start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      end = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'this_quarter': {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterStart, 1);
      end = new Date(now.getFullYear(), quarterStart + 3, 1);
      break;
    }
    case 'last_quarter': {
      const lastQuarterStart = Math.floor(now.getMonth() / 3) * 3 - 3;
      start = new Date(now.getFullYear(), lastQuarterStart, 1);
      end = new Date(now.getFullYear(), lastQuarterStart + 3, 1);
      break;
    }
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case 'last_year':
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all_time':
    default:
      return { start: null, end: null };
  }

  return {
    start: start?.toISOString() || null,
    end: end?.toISOString() || null,
  };
}

function buildFilterCondition(filter: ReportFilter, alias: string, paramIndex: number): { sql: string; params: unknown[] } {
  const field = `${alias}.${filter.field}`;
  const params: unknown[] = [];

  switch (filter.operator) {
    case 'equals':
      params.push(filter.value);
      return { sql: `${field} = $${paramIndex}`, params };
    case 'not_equals':
      params.push(filter.value);
      return { sql: `${field} != $${paramIndex}`, params };
    case 'contains':
      params.push(`%${filter.value}%`);
      return { sql: `${field} ILIKE $${paramIndex}`, params };
    case 'not_contains':
      params.push(`%${filter.value}%`);
      return { sql: `${field} NOT ILIKE $${paramIndex}`, params };
    case 'starts_with':
      params.push(`${filter.value}%`);
      return { sql: `${field} ILIKE $${paramIndex}`, params };
    case 'ends_with':
      params.push(`%${filter.value}`);
      return { sql: `${field} ILIKE $${paramIndex}`, params };
    case 'is_empty':
      return { sql: `(${field} IS NULL OR ${field} = '')`, params: [] };
    case 'is_not_empty':
      return { sql: `(${field} IS NOT NULL AND ${field} != '')`, params: [] };
    case 'greater_than':
      params.push(filter.value);
      return { sql: `${field} > $${paramIndex}`, params };
    case 'less_than':
      params.push(filter.value);
      return { sql: `${field} < $${paramIndex}`, params };
    case 'greater_than_or_equals':
      params.push(filter.value);
      return { sql: `${field} >= $${paramIndex}`, params };
    case 'less_than_or_equals':
      params.push(filter.value);
      return { sql: `${field} <= $${paramIndex}`, params };
    case 'in':
      if (Array.isArray(filter.value)) {
        params.push(filter.value);
        return { sql: `${field} = ANY($${paramIndex})`, params };
      }
      return { sql: 'TRUE', params: [] };
    case 'not_in':
      if (Array.isArray(filter.value)) {
        params.push(filter.value);
        return { sql: `${field} != ALL($${paramIndex})`, params };
      }
      return { sql: 'TRUE', params: [] };
    case 'between':
      if (Array.isArray(filter.value) && filter.value.length === 2) {
        params.push(filter.value[0], filter.value[1]);
        return { sql: `${field} BETWEEN $${paramIndex} AND $${paramIndex + 1}`, params };
      }
      return { sql: 'TRUE', params: [] };
    default:
      return { sql: 'TRUE', params: [] };
  }
}

function validateFieldAgainstWhitelist(field: string, dataSource: ReportDataSource): boolean {
  const config = dataSourceConfigs[dataSource];
  const validFields = [
    ...config.dimensions.map(d => d.field),
    ...config.metrics.map(m => m.field),
  ];
  return validFields.includes(field) || field.startsWith('status_');
}

export async function executeReportQuery(
  organizationId: string,
  dataSource: ReportDataSource,
  config: ReportConfig,
  isPreview: boolean = true
): Promise<ReportQueryResult> {
  const startTime = Date.now();
  const baseTable = getBaseTable(dataSource);
  const primaryDateField = getPrimaryDateField(dataSource);
  const alias = 't';

  for (const dim of config.dimensions) {
    if (!validateFieldAgainstWhitelist(dim.field, dataSource)) {
      throw new Error(`Invalid dimension field: ${dim.field}`);
    }
  }
  for (const metric of config.metrics) {
    if (!validateFieldAgainstWhitelist(metric.field, dataSource)) {
      throw new Error(`Invalid metric field: ${metric.field}`);
    }
  }
  for (const filter of config.filters) {
    if (!validateFieldAgainstWhitelist(filter.field, dataSource)) {
      throw new Error(`Invalid filter field: ${filter.field}`);
    }
  }

  const selectClauses: string[] = [];
  const groupByClauses: string[] = [];

  config.dimensions.forEach((dim, index) => {
    selectClauses.push(buildDimensionSelect(dim, alias));
    if (dim.dataType === 'date' && dim.dateGrouping) {
      groupByClauses.push(getDateGroupingSql(`${alias}.${dim.field}`, dim.dateGrouping));
    } else {
      groupByClauses.push(`${alias}.${dim.field}`);
    }
  });

  config.metrics.forEach(metric => {
    selectClauses.push(buildMetricSelect(metric, alias, dataSource));
  });

  const whereClauses: string[] = [`${alias}.organization_id = $1`];
  const params: unknown[] = [organizationId];
  let paramIndex = 2;

  const timeBounds = getTimeRangeBounds(config.timeRange);
  if (timeBounds.start) {
    whereClauses.push(`${alias}.${primaryDateField} >= $${paramIndex}`);
    params.push(timeBounds.start);
    paramIndex++;
  }
  if (timeBounds.end) {
    whereClauses.push(`${alias}.${primaryDateField} < $${paramIndex}`);
    params.push(timeBounds.end);
    paramIndex++;
  }

  for (const filter of config.filters) {
    const { sql, params: filterParams } = buildFilterCondition(filter, alias, paramIndex);
    whereClauses.push(sql);
    params.push(...filterParams);
    paramIndex += filterParams.length;
  }

  let orderByClause = '';
  if (config.sorting.length > 0) {
    const sortClauses = config.sorting.map(sort => {
      const direction = sort.direction === 'desc' ? 'DESC' : 'ASC';
      return `"${sort.field}" ${direction}`;
    });
    orderByClause = `ORDER BY ${sortClauses.join(', ')}`;
  } else if (config.dimensions.length > 0) {
    orderByClause = `ORDER BY "${config.dimensions[0].id}" ASC`;
  }

  const limit = isPreview
    ? Math.min(config.limit || PREVIEW_ROW_LIMIT, PREVIEW_ROW_LIMIT)
    : config.limit || 100000;

  const query = `
    SELECT ${selectClauses.join(', ')}
    FROM ${baseTable} ${alias}
    WHERE ${whereClauses.join(' AND ')}
    ${groupByClauses.length > 0 ? `GROUP BY ${groupByClauses.join(', ')}` : ''}
    ${orderByClause}
    LIMIT ${limit}
  `.trim();

  const { data, error } = await supabase.rpc('execute_report_query', {
    query_text: query,
    query_params: params,
  });

  if (error) {
    console.error('Report query error:', error);
    throw new Error(`Failed to execute report query: ${error.message}`);
  }

  const columns = [
    ...config.dimensions.map(dim => ({
      key: dim.id,
      label: dim.label,
      type: 'dimension' as const,
      dataType: dim.dataType,
    })),
    ...config.metrics.map(metric => ({
      key: metric.id,
      label: metric.label,
      type: 'metric' as const,
      dataType: 'number',
      format: metric.format,
    })),
  ];

  const executionTime = Date.now() - startTime;

  return {
    columns,
    rows: data || [],
    totalRows: data?.length || 0,
    executionTime,
  };
}

export async function getReportPreview(
  organizationId: string,
  dataSource: ReportDataSource,
  config: ReportConfig
): Promise<ReportQueryResult> {
  return executeReportQuery(organizationId, dataSource, config, true);
}

export async function getReportFullData(
  organizationId: string,
  dataSource: ReportDataSource,
  config: ReportConfig
): Promise<ReportQueryResult> {
  return executeReportQuery(organizationId, dataSource, config, false);
}
