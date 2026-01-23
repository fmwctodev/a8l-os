import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReportExport {
  id: string;
  organization_id: string;
  report_run_id: string;
  status: string;
}

interface ReportRun {
  id: string;
  report_id: string;
  report: {
    data_source: string;
    config: Record<string, unknown>;
  };
}

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function generateCSV(columns: Array<{ key: string; label: string }>, rows: Array<Record<string, unknown>>): string {
  const header = columns.map(col => escapeCSVValue(col.label)).join(',');
  const dataRows = rows.map(row =>
    columns.map(col => escapeCSVValue(row[col.key])).join(',')
  );
  return [header, ...dataRows].join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: exports, error: fetchError } = await supabase
      .from('report_exports')
      .select(`
        id,
        organization_id,
        report_run_id,
        status
      `)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      throw new Error(`Failed to fetch exports: ${fetchError.message}`);
    }

    if (!exports || exports.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No queued exports' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const exportJob = exports[0] as ReportExport;

    await supabase
      .from('report_exports')
      .update({ status: 'running' })
      .eq('id', exportJob.id);

    const { data: runData, error: runError } = await supabase
      .from('report_runs')
      .select(`
        id,
        report_id,
        report:reports(data_source, config)
      `)
      .eq('id', exportJob.report_run_id)
      .single();

    if (runError || !runData) {
      throw new Error(`Failed to fetch report run: ${runError?.message}`);
    }

    const reportRun = runData as unknown as ReportRun;
    const report = reportRun.report;

    const { data: queryResult, error: queryError } = await supabase.rpc('execute_report_query', {
      query_text: buildExportQuery(report.data_source, report.config, exportJob.organization_id),
      query_params: [],
    });

    if (queryError) {
      throw new Error(`Query execution failed: ${queryError.message}`);
    }

    const config = report.config as {
      dimensions: Array<{ id: string; label: string }>;
      metrics: Array<{ id: string; label: string }>;
    };

    const columns = [
      ...config.dimensions.map(d => ({ key: d.id, label: d.label })),
      ...config.metrics.map(m => ({ key: m.id, label: m.label })),
    ];

    const csvContent = generateCSV(columns, queryResult || []);
    const csvBuffer = new TextEncoder().encode(csvContent);

    const filePath = `${exportJob.organization_id}/${exportJob.id}.csv`;

    const { error: uploadError } = await supabase.storage
      .from('report-exports')
      .upload(filePath, csvBuffer, {
        contentType: 'text/csv',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload CSV: ${uploadError.message}`);
    }

    await supabase
      .from('report_exports')
      .update({
        status: 'complete',
        file_path: filePath,
        file_size: csvBuffer.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', exportJob.id);

    await supabase
      .from('report_runs')
      .update({
        status: 'success',
        row_count: queryResult?.length || 0,
        finished_at: new Date().toISOString(),
      })
      .eq('id', exportJob.report_run_id);

    return new Response(
      JSON.stringify({
        success: true,
        exportId: exportJob.id,
        rowCount: queryResult?.length || 0,
        fileSize: csvBuffer.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Export worker error:', error);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildExportQuery(
  dataSource: string,
  config: Record<string, unknown>,
  organizationId: string
): string {
  const tableMap: Record<string, string> = {
    contacts: 'contacts',
    conversations: 'conversations',
    appointments: 'appointments',
    forms: 'form_submissions',
    surveys: 'survey_submissions',
    workflows: 'workflow_enrollments',
  };

  const baseTable = tableMap[dataSource] || dataSource;
  const alias = 't';

  const typedConfig = config as {
    dimensions: Array<{ id: string; field: string; dataType: string; dateGrouping?: string }>;
    metrics: Array<{ id: string; field: string; aggregation: string }>;
    filters: Array<{ field: string; operator: string; value: unknown }>;
    timeRange: { type: string; preset?: string; customStart?: string; customEnd?: string };
    sorting: Array<{ field: string; direction: string }>;
    limit?: number;
  };

  const selectClauses: string[] = [];
  const groupByClauses: string[] = [];

  typedConfig.dimensions.forEach(dim => {
    if (dim.dataType === 'date' && dim.dateGrouping) {
      selectClauses.push(`DATE_TRUNC('${dim.dateGrouping}', ${alias}.${dim.field}) AS "${dim.id}"`);
      groupByClauses.push(`DATE_TRUNC('${dim.dateGrouping}', ${alias}.${dim.field})`);
    } else {
      selectClauses.push(`${alias}.${dim.field} AS "${dim.id}"`);
      groupByClauses.push(`${alias}.${dim.field}`);
    }
  });

  typedConfig.metrics.forEach(metric => {
    if (metric.field.startsWith('status_')) {
      const statusValue = metric.field.replace('status_', '');
      selectClauses.push(`COUNT(CASE WHEN ${alias}.status = '${statusValue}' THEN 1 END) AS "${metric.id}"`);
    } else {
      switch (metric.aggregation) {
        case 'count':
          selectClauses.push(`COUNT(${alias}.${metric.field}) AS "${metric.id}"`);
          break;
        case 'count_distinct':
          selectClauses.push(`COUNT(DISTINCT ${alias}.${metric.field}) AS "${metric.id}"`);
          break;
        case 'sum':
          selectClauses.push(`COALESCE(SUM(${alias}.${metric.field}), 0) AS "${metric.id}"`);
          break;
        case 'avg':
          selectClauses.push(`COALESCE(AVG(${alias}.${metric.field}), 0) AS "${metric.id}"`);
          break;
        case 'min':
          selectClauses.push(`MIN(${alias}.${metric.field}) AS "${metric.id}"`);
          break;
        case 'max':
          selectClauses.push(`MAX(${alias}.${metric.field}) AS "${metric.id}"`);
          break;
        default:
          selectClauses.push(`COUNT(${alias}.${metric.field}) AS "${metric.id}"`);
      }
    }
  });

  const whereClauses = [`${alias}.organization_id = '${organizationId}'`];

  let orderByClause = '';
  if (typedConfig.sorting?.length > 0) {
    const sortClauses = typedConfig.sorting.map(s => `"${s.field}" ${s.direction.toUpperCase()}`);
    orderByClause = `ORDER BY ${sortClauses.join(', ')}`;
  }

  const limit = typedConfig.limit || 100000;

  return `
    SELECT ${selectClauses.join(', ')}
    FROM ${baseTable} ${alias}
    WHERE ${whereClauses.join(' AND ')}
    ${groupByClauses.length > 0 ? `GROUP BY ${groupByClauses.join(', ')}` : ''}
    ${orderByClause}
    LIMIT ${limit}
  `.trim();
}
