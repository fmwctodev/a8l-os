import { supabase } from '../lib/supabase';

export type DataSource =
  | 'contacts'
  | 'opportunities'
  | 'appointments'
  | 'conversations'
  | 'invoices'
  | 'payments'
  | 'forms'
  | 'surveys'
  | 'reviews';

export interface UserQueryContext {
  userId: string;
  orgId: string;
  roleId: string;
  isSuperAdmin: boolean;
  departmentId?: string;
  permissions: string[];
}

export interface QuerySpec {
  dataSource: DataSource;
  fields: string[];
  filters?: QueryFilter[];
  groupBy?: string[];
  aggregates?: AggregateSpec[];
  orderBy?: OrderBySpec[];
  limit?: number;
  offset?: number;
  dateRange?: {
    field: string;
    start: string;
    end: string;
  };
}

export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'between';

export interface AggregateSpec {
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field: string;
  alias: string;
}

export interface OrderBySpec {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  totalCount: number;
  aggregates?: Record<string, number>;
}

const DATA_SOURCE_CONFIG: Record<DataSource, {
  table: string;
  ownerField?: string;
  departmentField?: string;
  viewPermission: string;
  viewAllPermission?: string;
  availableFields: string[];
  joinSpecs?: Array<{
    table: string;
    alias: string;
    on: string;
    fields: string[];
  }>;
}> = {
  contacts: {
    table: 'contacts',
    ownerField: 'owner_id',
    departmentField: 'department_id',
    viewPermission: 'contacts.view',
    availableFields: [
      'id', 'first_name', 'last_name', 'email', 'phone', 'company',
      'job_title', 'source', 'status', 'city', 'state', 'country',
      'lead_score', 'created_at', 'updated_at', 'last_activity_at',
    ],
    joinSpecs: [
      { table: 'users', alias: 'owner', on: 'contacts.owner_id = owner.id', fields: ['owner.name as owner_name'] },
      { table: 'departments', alias: 'dept', on: 'contacts.department_id = dept.id', fields: ['dept.name as department_name'] },
    ],
  },
  opportunities: {
    table: 'opportunities',
    ownerField: 'owner_id',
    departmentField: 'department_id',
    viewPermission: 'opportunities.view',
    availableFields: [
      'id', 'name', 'value', 'status', 'expected_close_date',
      'actual_close_date', 'probability', 'source', 'created_at', 'updated_at',
    ],
    joinSpecs: [
      { table: 'pipelines', alias: 'pipeline', on: 'opportunities.pipeline_id = pipeline.id', fields: ['pipeline.name as pipeline_name'] },
      { table: 'stages', alias: 'stage', on: 'opportunities.stage_id = stage.id', fields: ['stage.name as stage_name'] },
      { table: 'contacts', alias: 'contact', on: 'opportunities.contact_id = contact.id', fields: ['contact.first_name as contact_first_name', 'contact.last_name as contact_last_name'] },
    ],
  },
  appointments: {
    table: 'appointments',
    ownerField: 'assigned_user_id',
    viewPermission: 'appointments.view',
    availableFields: [
      'id', 'status', 'start_at_utc', 'end_at_utc', 'source',
      'notes', 'created_at', 'updated_at',
    ],
    joinSpecs: [
      { table: 'appointment_types', alias: 'type', on: 'appointments.appointment_type_id = type.id', fields: ['type.name as appointment_type_name'] },
      { table: 'calendars', alias: 'calendar', on: 'appointments.calendar_id = calendar.id', fields: ['calendar.name as calendar_name'] },
      { table: 'contacts', alias: 'contact', on: 'appointments.contact_id = contact.id', fields: ['contact.first_name as contact_first_name', 'contact.last_name as contact_last_name'] },
    ],
  },
  conversations: {
    table: 'conversations',
    ownerField: 'assigned_user_id',
    viewPermission: 'conversations.view',
    availableFields: [
      'id', 'subject', 'channel', 'status', 'priority',
      'last_message_at', 'created_at', 'updated_at',
    ],
    joinSpecs: [
      { table: 'contacts', alias: 'contact', on: 'conversations.contact_id = contact.id', fields: ['contact.first_name as contact_first_name', 'contact.last_name as contact_last_name'] },
    ],
  },
  invoices: {
    table: 'invoices',
    viewPermission: 'payments.view',
    availableFields: [
      'id', 'invoice_number', 'status', 'subtotal', 'tax_amount',
      'total', 'due_date', 'paid_at', 'created_at', 'updated_at',
    ],
    joinSpecs: [
      { table: 'contacts', alias: 'contact', on: 'invoices.contact_id = contact.id', fields: ['contact.first_name as contact_first_name', 'contact.last_name as contact_last_name'] },
    ],
  },
  payments: {
    table: 'payments',
    viewPermission: 'payments.view',
    availableFields: [
      'id', 'amount', 'status', 'method', 'paid_at', 'created_at',
    ],
    joinSpecs: [
      { table: 'invoices', alias: 'invoice', on: 'payments.invoice_id = invoice.id', fields: ['invoice.invoice_number'] },
    ],
  },
  forms: {
    table: 'form_submissions',
    viewPermission: 'marketing.forms.view',
    availableFields: [
      'id', 'submitted_at', 'ip_address', 'user_agent',
    ],
    joinSpecs: [
      { table: 'forms', alias: 'form', on: 'form_submissions.form_id = form.id', fields: ['form.name as form_name'] },
      { table: 'contacts', alias: 'contact', on: 'form_submissions.contact_id = contact.id', fields: ['contact.first_name as contact_first_name', 'contact.last_name as contact_last_name'] },
    ],
  },
  surveys: {
    table: 'survey_submissions',
    viewPermission: 'marketing.surveys.view',
    availableFields: [
      'id', 'submitted_at', 'completed', 'score',
    ],
    joinSpecs: [
      { table: 'surveys', alias: 'survey', on: 'survey_submissions.survey_id = survey.id', fields: ['survey.name as survey_name'] },
      { table: 'contacts', alias: 'contact', on: 'survey_submissions.contact_id = contact.id', fields: ['contact.first_name as contact_first_name', 'contact.last_name as contact_last_name'] },
    ],
  },
  reviews: {
    table: 'reviews',
    viewPermission: 'reputation.view',
    availableFields: [
      'id', 'rating', 'title', 'content', 'platform',
      'reviewed_at', 'created_at',
    ],
    joinSpecs: [
      { table: 'contacts', alias: 'contact', on: 'reviews.contact_id = contact.id', fields: ['contact.first_name as contact_first_name', 'contact.last_name as contact_last_name'] },
    ],
  },
};

export function getAvailableDataSources(userContext: UserQueryContext): DataSource[] {
  if (userContext.isSuperAdmin) {
    return Object.keys(DATA_SOURCE_CONFIG) as DataSource[];
  }

  return (Object.entries(DATA_SOURCE_CONFIG) as [DataSource, typeof DATA_SOURCE_CONFIG[DataSource]][])
    .filter(([_, config]) => userContext.permissions.includes(config.viewPermission))
    .map(([source]) => source);
}

export function getFieldsForDataSource(dataSource: DataSource): string[] {
  const config = DATA_SOURCE_CONFIG[dataSource];
  if (!config) return [];

  const fields = [...config.availableFields];

  config.joinSpecs?.forEach(join => {
    fields.push(...join.fields.map(f => f.split(' as ')[1] || f));
  });

  return fields;
}

export async function querySystemData(
  querySpec: QuerySpec,
  userContext: UserQueryContext
): Promise<QueryResult> {
  const config = DATA_SOURCE_CONFIG[querySpec.dataSource];
  if (!config) {
    throw new Error(`Invalid data source: ${querySpec.dataSource}`);
  }

  if (!userContext.isSuperAdmin && !userContext.permissions.includes(config.viewPermission)) {
    throw new Error(`Permission denied: ${config.viewPermission} required`);
  }

  const validFields = validateFields(querySpec.fields, querySpec.dataSource);
  if (validFields.length === 0) {
    throw new Error('No valid fields specified');
  }

  let query = supabase.from(config.table).select(buildSelectClause(validFields, config), { count: 'exact' });

  query = query.eq('org_id', userContext.orgId);

  if (!userContext.isSuperAdmin && config.ownerField) {
    const hasViewAllPermission = config.viewAllPermission
      ? userContext.permissions.includes(config.viewAllPermission)
      : false;

    if (!hasViewAllPermission) {
      query = query.eq(config.ownerField, userContext.userId);
    }
  }

  if (querySpec.filters) {
    query = applyFilters(query, querySpec.filters, querySpec.dataSource);
  }

  if (querySpec.dateRange) {
    query = query
      .gte(querySpec.dateRange.field, querySpec.dateRange.start)
      .lte(querySpec.dateRange.field, querySpec.dateRange.end);
  }

  if (querySpec.orderBy) {
    querySpec.orderBy.forEach(order => {
      query = query.order(order.field, { ascending: order.direction === 'asc' });
    });
  }

  if (querySpec.limit) {
    const offset = querySpec.offset || 0;
    query = query.range(offset, offset + querySpec.limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  let aggregates: Record<string, number> | undefined;
  if (querySpec.aggregates && querySpec.aggregates.length > 0) {
    aggregates = await computeAggregates(
      querySpec.dataSource,
      querySpec.aggregates,
      querySpec.filters,
      querySpec.dateRange,
      userContext
    );
  }

  return {
    rows: data || [],
    totalCount: count || 0,
    aggregates,
  };
}

function validateFields(fields: string[], dataSource: DataSource): string[] {
  const availableFields = getFieldsForDataSource(dataSource);
  return fields.filter(f => availableFields.includes(f));
}

function buildSelectClause(
  fields: string[],
  config: typeof DATA_SOURCE_CONFIG[DataSource]
): string {
  const baseFields = fields.filter(f => config.availableFields.includes(f));
  const joinFields: string[] = [];

  config.joinSpecs?.forEach(join => {
    join.fields.forEach(jf => {
      const alias = jf.split(' as ')[1];
      if (alias && fields.includes(alias)) {
        joinFields.push(`${join.alias}:${join.table}(${jf.split(' as ')[0].split('.')[1]})`);
      }
    });
  });

  return [...baseFields, ...joinFields].join(', ') || '*';
}

function applyFilters(
  query: ReturnType<typeof supabase.from>,
  filters: QueryFilter[],
  _dataSource: DataSource
): ReturnType<typeof supabase.from> {
  filters.forEach(filter => {
    switch (filter.operator) {
      case 'eq':
        query = query.eq(filter.field, filter.value);
        break;
      case 'neq':
        query = query.neq(filter.field, filter.value);
        break;
      case 'gt':
        query = query.gt(filter.field, filter.value);
        break;
      case 'gte':
        query = query.gte(filter.field, filter.value);
        break;
      case 'lt':
        query = query.lt(filter.field, filter.value);
        break;
      case 'lte':
        query = query.lte(filter.field, filter.value);
        break;
      case 'like':
        query = query.like(filter.field, filter.value as string);
        break;
      case 'ilike':
        query = query.ilike(filter.field, filter.value as string);
        break;
      case 'in':
        query = query.in(filter.field, filter.value as unknown[]);
        break;
      case 'is_null':
        query = query.is(filter.field, null);
        break;
      case 'is_not_null':
        query = query.not(filter.field, 'is', null);
        break;
    }
  });

  return query;
}

async function computeAggregates(
  dataSource: DataSource,
  aggregates: AggregateSpec[],
  filters?: QueryFilter[],
  dateRange?: QuerySpec['dateRange'],
  userContext?: UserQueryContext
): Promise<Record<string, number>> {
  const config = DATA_SOURCE_CONFIG[dataSource];
  const result: Record<string, number> = {};

  for (const agg of aggregates) {
    let query = supabase.from(config.table).select(agg.field, { count: 'exact' });

    if (userContext) {
      query = query.eq('org_id', userContext.orgId);
    }

    if (filters) {
      query = applyFilters(query, filters, dataSource);
    }

    if (dateRange) {
      query = query
        .gte(dateRange.field, dateRange.start)
        .lte(dateRange.field, dateRange.end);
    }

    const { data, count, error } = await query;

    if (error) {
      result[agg.alias] = 0;
      continue;
    }

    switch (agg.function) {
      case 'count':
        result[agg.alias] = count || 0;
        break;
      case 'sum':
        result[agg.alias] = (data || []).reduce((sum, row) => sum + (Number(row[agg.field]) || 0), 0);
        break;
      case 'avg':
        const values = (data || []).map(row => Number(row[agg.field]) || 0);
        result[agg.alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case 'min':
        const minValues = (data || []).map(row => Number(row[agg.field])).filter(v => !isNaN(v));
        result[agg.alias] = minValues.length > 0 ? Math.min(...minValues) : 0;
        break;
      case 'max':
        const maxValues = (data || []).map(row => Number(row[agg.field])).filter(v => !isNaN(v));
        result[agg.alias] = maxValues.length > 0 ? Math.max(...maxValues) : 0;
        break;
    }
  }

  return result;
}

export async function getMetricsByTimePeriod(
  dataSource: DataSource,
  metricField: string,
  aggregation: 'count' | 'sum' | 'avg',
  groupByPeriod: 'day' | 'week' | 'month' | 'quarter' | 'year',
  dateField: string,
  dateRange: { start: string; end: string },
  userContext: UserQueryContext,
  filters?: QueryFilter[]
): Promise<Array<{ period: string; value: number }>> {
  const config = DATA_SOURCE_CONFIG[dataSource];

  if (!userContext.isSuperAdmin && !userContext.permissions.includes(config.viewPermission)) {
    throw new Error(`Permission denied: ${config.viewPermission} required`);
  }

  let query = supabase
    .from(config.table)
    .select(`${dateField}, ${metricField}`)
    .eq('org_id', userContext.orgId)
    .gte(dateField, dateRange.start)
    .lte(dateField, dateRange.end)
    .order(dateField, { ascending: true });

  if (filters) {
    query = applyFilters(query, filters, dataSource);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  const grouped = new Map<string, number[]>();

  (data || []).forEach(row => {
    const date = new Date(row[dateField] as string);
    const periodKey = getPeriodKey(date, groupByPeriod);

    if (!grouped.has(periodKey)) {
      grouped.set(periodKey, []);
    }
    grouped.get(periodKey)!.push(Number(row[metricField]) || 0);
  });

  return Array.from(grouped.entries()).map(([period, values]) => {
    let value: number;
    switch (aggregation) {
      case 'count':
        value = values.length;
        break;
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
    }
    return { period, value };
  });
}

function getPeriodKey(date: Date, period: 'day' | 'week' | 'month' | 'quarter' | 'year'): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  switch (period) {
    case 'day':
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + 1) / 7)).padStart(2, '0')}`;
    case 'month':
      return `${year}-${String(month).padStart(2, '0')}`;
    case 'quarter':
      return `${year}-Q${Math.ceil(month / 3)}`;
    case 'year':
      return String(year);
  }
}
