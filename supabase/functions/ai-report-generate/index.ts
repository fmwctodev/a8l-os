import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseClient, extractUserContext, requireAuth } from "../_shared/auth.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  CLARA_MODEL_HEAVY,
  buildAnthropicHeaders,
  type AnthropicResponse,
} from "../_shared/claraConfig.ts";

interface RequestPayload {
  prompt: string;
  scope: "my" | "team" | "org";
  timeframe: {
    type: "preset" | "custom";
    preset?: string;
    customStart?: string;
    customEnd?: string;
  };
  parent_report_id?: string;
}

const DATA_SOURCE_SCHEMAS = [
  {
    name: "contacts",
    table: "contacts",
    description: "Customer and lead contact records",
    fields: [
      "id (uuid)", "first_name (text)", "last_name (text)", "email (text)",
      "phone (text)", "company (text)", "status (text: active/inactive/archived)",
      "source (text)", "owner_id (uuid)", "department_id (uuid)",
      "lead_score (integer: 0-100)", "city (text)", "state (text)", "country (text)",
      "created_at (timestamptz)", "updated_at (timestamptz)",
    ],
  },
  {
    name: "conversations",
    table: "conversations",
    description: "Communication threads with contacts",
    fields: [
      "id (uuid)", "contact_id (uuid)", "status (text: open/closed/pending)",
      "assigned_user_id (uuid)", "department_id (uuid)", "unread_count (integer)",
      "created_at (timestamptz)", "last_message_at (timestamptz)",
    ],
  },
  {
    name: "appointments",
    table: "appointments",
    description: "Scheduled appointments and meetings",
    fields: [
      "id (uuid)", "contact_id (uuid)", "calendar_id (uuid)",
      "status (text: scheduled/completed/canceled/no_show)",
      "source (text)", "assigned_user_id (uuid)",
      "start_at_utc (timestamptz)", "end_at_utc (timestamptz)", "created_at (timestamptz)",
    ],
  },
  {
    name: "opportunities",
    table: "opportunities",
    description: "Sales opportunities and deals",
    fields: [
      "id (uuid)", "contact_id (uuid)", "pipeline_id (uuid)", "stage_id (uuid)",
      "status (text: open/won/lost)", "value_amount (numeric)", "currency (text)",
      "source (text)", "owner_id (uuid)", "closed_at (timestamptz)", "created_at (timestamptz)",
    ],
  },
  {
    name: "invoices",
    table: "invoices",
    description: "Customer invoices",
    fields: [
      "id (uuid)", "contact_id (uuid)", "status (text: draft/sent/paid/overdue/void)",
      "total_amount (numeric)", "paid_amount (numeric)", "balance_due (numeric)",
      "currency (text)", "due_date (date)", "paid_at (timestamptz)", "created_at (timestamptz)",
    ],
  },
  {
    name: "payments",
    table: "payments",
    description: "Payment transactions",
    fields: [
      "id (uuid)", "invoice_id (uuid)", "amount (numeric)", "currency (text)",
      "status (text: pending/completed/failed/refunded)", "payment_method (text)",
      "payment_date (timestamptz)", "created_at (timestamptz)",
    ],
  },
  {
    name: "tasks",
    table: "contact_tasks",
    description: "Tasks and to-dos",
    fields: [
      "id (uuid)", "contact_id (uuid)", "title (text)",
      "status (text: pending/in_progress/completed)", "priority (text: low/medium/high/urgent)",
      "task_type (text)", "assigned_to (uuid)", "due_date (timestamptz)",
      "completed_at (timestamptz)", "created_at (timestamptz)",
    ],
  },
  {
    name: "ai_runs",
    table: "ai_agent_runs",
    description: "AI agent execution history",
    fields: [
      "id (uuid)", "agent_id (uuid)", "status (text: running/completed/failed)",
      "trigger_type (text)", "triggered_by (uuid)", "tokens_used (integer)",
      "execution_time_ms (integer)", "started_at (timestamptz)", "finished_at (timestamptz)",
    ],
  },
  {
    name: "reviews",
    table: "reviews",
    description: "Customer reviews and ratings",
    fields: [
      "id (uuid)", "provider (text)", "rating (integer: 1-5)",
      "sentiment (text: positive/negative/neutral)", "status (text: pending/approved/hidden)",
      "received_at (timestamptz)", "created_at (timestamptz)",
    ],
  },
  {
    name: "workflows",
    table: "workflow_enrollments",
    description: "Workflow automation enrollments",
    fields: [
      "id (uuid)", "workflow_id (uuid)", "contact_id (uuid)",
      "status (text: active/completed/stopped/errored)",
      "started_at (timestamptz)", "updated_at (timestamptz)",
    ],
  },
  {
    name: "forms",
    table: "form_submissions",
    description: "Form submissions from marketing forms",
    fields: [
      "id (uuid)", "form_id (uuid)", "contact_id (uuid)",
      "processed_status (text)", "submitted_at (timestamptz)",
    ],
  },
  {
    name: "projects",
    table: "projects",
    description: "Project management records",
    fields: [
      "id (uuid)", "name (text)", "status (text)", "priority (text)",
      "budget (numeric)", "actual_cost (numeric)",
      "start_date (date)", "due_date (date)", "completed_at (timestamptz)",
      "owner_id (uuid)", "created_at (timestamptz)",
    ],
  },
];

function getTimeRangeDates(timeframe: RequestPayload["timeframe"]): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (timeframe.type === "custom" && timeframe.customStart && timeframe.customEnd) {
    return { start: timeframe.customStart, end: timeframe.customEnd };
  }

  let start: Date;
  let end: Date = now;

  switch (timeframe.preset) {
    case "today": start = today; break;
    case "yesterday": start = new Date(today.getTime() - 86400000); end = today; break;
    case "last_7_days": start = new Date(today.getTime() - 7 * 86400000); break;
    case "last_30_days": start = new Date(today.getTime() - 30 * 86400000); break;
    case "last_90_days": start = new Date(today.getTime() - 90 * 86400000); break;
    case "this_month": start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case "last_month":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case "last_quarter": {
      const lq = Math.floor(now.getMonth() / 3) - 1;
      const yr = lq < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const qq = lq < 0 ? 3 : lq;
      start = new Date(yr, qq * 3, 1);
      end = new Date(yr, qq * 3 + 3, 1);
      break;
    }
    case "this_year": start = new Date(now.getFullYear(), 0, 1); break;
    case "last_year":
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear(), 0, 1);
      break;
    default: start = new Date(today.getTime() - 30 * 86400000);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

function sanitizeSQL(sql: string): string {
  const forbidden = [
    /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bDROP\b/i,
    /\bCREATE\b/i, /\bALTER\b/i, /\bTRUNCATE\b/i, /\bEXEC\b/i,
    /\bEXECUTE\b/i, /--/, /;.*SELECT/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(sql)) throw new Error("Unsafe SQL detected");
  }
  if (!sql.trim().toUpperCase().startsWith("SELECT")) {
    throw new Error("Only SELECT queries allowed");
  }
  return sql;
}

function buildPlanSystemPrompt(scope: string, timeRangeDates: { start: string; end: string }): string {
  const schemas = DATA_SOURCE_SCHEMAS.map(
    (ds) => `${ds.name} (table: ${ds.table}): ${ds.description}\n  Fields: ${ds.fields.join(", ")}`
  ).join("\n\n");

  return `You are an expert data analytics AI for a CRM/business management platform.
Your job is to create a report plan and then compose a full report from data.

STEP 1: You will first output a report_plan JSON object.

Available data sources:
${schemas}

IMPORTANT RULES:
1. Generate ONLY aggregate/summary SQL queries - never raw row dumps
2. Always include organization_id = '{{ORG_ID}}' in WHERE
3. ${scope === "my" ? "Add owner_id = '{{USER_ID}}' or assigned_user_id = '{{USER_ID}}' or assigned_to = '{{USER_ID}}' for user-scoped data" : scope === "team" ? "Add department_id = '{{DEPARTMENT_ID}}' for team-scoped data" : "Show organization-wide data"}
4. Apply time filter: created_at >= '${timeRangeDates.start}' AND created_at < '${timeRangeDates.end}' (use the primary date field for each table)
5. Use COUNT, SUM, AVG, MIN, MAX aggregations
6. GROUP BY for dimensional breakdowns
7. Limit to top 25 groups max
8. NEVER return raw rows - only aggregated summaries, totals, grouped breakdowns, top N
9. Generate multiple queries if data from multiple tables is needed
10. Choose appropriate chart types: line for time series, bar for comparisons, pie for proportions

You MUST output valid JSON in this exact format:
{
  "type": "report_plan",
  "report_name": "descriptive report title",
  "report_category": "sales|marketing|ops|reputation|finance|projects|custom",
  "scope": "${scope}",
  "timeframe": { "preset": "...", "start": "${timeRangeDates.start}", "end": "${timeRangeDates.end}" },
  "data_sources": [
    { "module": "table_name", "entities": ["entity"], "fields": ["field1","field2"] }
  ],
  "sql_queries": [
    {
      "id": "unique_query_id",
      "purpose": "what this query computes",
      "sql": "SELECT ... FROM ... WHERE organization_id = '{{ORG_ID}}' ... GROUP BY ... ORDER BY ... LIMIT 25"
    }
  ],
  "charts": [
    { "chart_id": "unique_id", "title": "Chart Title", "type": "line|bar|pie|area", "query_id": "references sql_queries.id", "series": [{"label":"Series Name","metric":"column_name"}], "x": "x_axis_column" }
  ],
  "tables": [
    { "table_id": "unique_id", "title": "Table Title", "query_id": "references sql_queries.id", "columns": ["col1","col2"] }
  ],
  "kpi_queries": [
    { "id": "kpi_id", "label": "KPI Label", "sql": "SELECT COUNT(*) as value FROM ...", "format": "number|currency|percentage" }
  ]
}

You MUST respond with valid JSON only. Do not include any text outside the JSON object.`;
}

function buildComposeSystemPrompt(): string {
  return `You are an expert business analyst composing a professional report from computed data.

Given the aggregated data results, compose a comprehensive report. You MUST output valid JSON:

{
  "type": "report_compose",
  "title": "Report Title",
  "executive_summary": "2-4 paragraph narrative summarizing findings, trends, and performance. Write in professional business language.",
  "kpis": [
    { "label": "Metric Name", "value": 12345, "delta_pct": 0.15, "trend": "up|down|flat", "format": "number|currency|percentage" }
  ],
  "charts": [
    {
      "chart_id": "unique_id",
      "title": "Chart Title",
      "type": "line|bar|pie|area",
      "config": {},
      "data": [{"x_label": "value1", "series_name": 123}, ...]
    }
  ],
  "tables": [
    {
      "table_id": "unique_id",
      "title": "Table Title",
      "columns": [{"key": "col_key", "label": "Column Label", "format": "number|currency|percentage|text"}],
      "rows": [{"col_key": "value"}, ...]
    }
  ],
  "insights": ["Insight 1", "Insight 2", "Insight 3"],
  "recommendations": ["Action item 1", "Action item 2"],
  "dashboard_cards": [
    { "card_id": "unique", "title": "Card Title", "value": 123, "trend": "up|down|flat", "delta_pct": 0.1, "category": "sales" }
  ]
}

RULES:
1. KPIs should be 4-6 key metrics with delta percentages where meaningful
2. Charts MUST have properly formatted data arrays matching the type
3. Tables should be summary tables (not raw data dumps)
4. Insights should be specific, data-driven observations
5. Recommendations should be actionable business advice
6. Dashboard cards should be 2-4 key metrics suitable for a dashboard widget
7. All numeric values should be actual numbers, not strings
8. Format currency values as plain numbers (formatting happens on frontend)

You MUST respond with valid JSON only. Do not include any text outside the JSON object.`;
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed: number }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: buildAnthropicHeaders(apiKey),
    body: JSON.stringify({
      model: CLARA_MODEL_HEAVY,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
      ],
      temperature: 0.15,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json() as AnthropicResponse;
  const content = data.content.find((b: { type: string }) => b.type === "text")?.text || "";
  const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  return {
    content,
    tokensUsed,
  };
}

function generateRenderedHTML(compose: Record<string, unknown>, reportName: string, timeStart: string, timeEnd: string): string {
  const kpis = (compose.kpis as Array<Record<string, unknown>>) || [];
  const tables = (compose.tables as Array<Record<string, unknown>>) || [];
  const insights = (compose.insights as string[]) || [];
  const recommendations = (compose.recommendations as string[]) || [];
  const summary = (compose.executive_summary as string) || "";

  const formatVal = (v: unknown, fmt?: string) => {
    if (typeof v === "number") {
      if (fmt === "currency") return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      if (fmt === "percentage") return `${(v * 100).toFixed(1)}%`;
      return v.toLocaleString("en-US");
    }
    return String(v ?? "");
  };

  const kpiHTML = kpis.map((k) => `
    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;text-align:center;">
      <div style="color:#94a3b8;font-size:12px;margin-bottom:4px;">${k.label}</div>
      <div style="color:#f1f5f9;font-size:24px;font-weight:700;">${formatVal(k.value, k.format as string)}</div>
      ${k.delta_pct != null ? `<div style="color:${(k.delta_pct as number) >= 0 ? "#10b981" : "#ef4444"};font-size:12px;">${(k.delta_pct as number) >= 0 ? "+" : ""}${((k.delta_pct as number) * 100).toFixed(1)}%</div>` : ""}
    </div>`).join("");

  const tablesHTML = tables.map((t) => {
    const cols = (t.columns as Array<Record<string, string>>) || [];
    const rows = (t.rows as Array<Record<string, unknown>>) || [];
    const headerRow = cols.map((c) => `<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-size:12px;">${c.label}</th>`).join("");
    const bodyRows = rows.slice(0, 25).map((r) =>
      `<tr>${cols.map((c) => `<td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:13px;">${formatVal(r[c.key], c.format)}</td>`).join("")}</tr>`
    ).join("");
    return `<div style="margin-bottom:24px;">
      <h3 style="color:#f1f5f9;font-size:16px;margin-bottom:8px;">${t.title}</h3>
      <table style="width:100%;border-collapse:collapse;background:#0f172a;border-radius:8px;overflow:hidden;">
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${reportName}</title>
<style>body{background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:32px;}
@media print{body{background:#fff;color:#1e293b;}}</style></head><body>
<h1 style="color:#f1f5f9;font-size:24px;margin-bottom:4px;">${reportName}</h1>
<p style="color:#64748b;font-size:13px;margin-bottom:24px;">${new Date(timeStart).toLocaleDateString()} - ${new Date(timeEnd).toLocaleDateString()}</p>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:32px;">${kpiHTML}</div>
<div style="margin-bottom:32px;"><h2 style="color:#f1f5f9;font-size:18px;margin-bottom:12px;">Executive Summary</h2>
<div style="color:#cbd5e1;font-size:14px;line-height:1.6;white-space:pre-wrap;">${summary}</div></div>
${tablesHTML}
${insights.length > 0 ? `<div style="margin-bottom:24px;"><h2 style="color:#f1f5f9;font-size:18px;margin-bottom:12px;">Key Insights</h2>
<ul style="color:#cbd5e1;font-size:14px;line-height:1.8;">${insights.map((i) => `<li>${i}</li>`).join("")}</ul></div>` : ""}
${recommendations.length > 0 ? `<div style="margin-bottom:24px;"><h2 style="color:#f1f5f9;font-size:18px;margin-bottom:12px;">Recommendations</h2>
<ul style="color:#cbd5e1;font-size:14px;line-height:1.8;">${recommendations.map((r) => `<li>${r}</li>`).join("")}</ul></div>` : ""}
<p style="color:#475569;font-size:11px;margin-top:32px;">Generated on ${new Date().toLocaleString()}</p>
</body></html>`;
}

function generateCSVData(compose: Record<string, unknown>): string {
  const tables = (compose.tables as Array<Record<string, unknown>>) || [];
  if (tables.length === 0) return "";

  const sections: string[] = [];
  for (const t of tables) {
    const cols = (t.columns as Array<Record<string, string>>) || [];
    const rows = (t.rows as Array<Record<string, unknown>>) || [];
    const header = cols.map((c) => `"${(c.label || c.key).replace(/"/g, '""')}"`).join(",");
    const body = rows.map((r) =>
      cols.map((c) => {
        const val = r[c.key];
        if (val == null) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    ).join("\n");
    sections.push(`${t.title}\n${header}\n${body}`);
  }

  const kpis = (compose.kpis as Array<Record<string, unknown>>) || [];
  if (kpis.length > 0) {
    const kpiHeader = '"Metric","Value","Change %"';
    const kpiRows = kpis.map((k) =>
      `"${k.label}",${k.value},${k.delta_pct != null ? ((k.delta_pct as number) * 100).toFixed(1) + "%" : ""}`
    ).join("\n");
    sections.unshift(`Key Metrics\n${kpiHeader}\n${kpiRows}`);
  }

  return sections.join("\n\n");
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = getSupabaseClient();
    const userContext = await extractUserContext(req, supabase);
    const user = requireAuth(userContext);

    const payload: RequestPayload = await req.json();
    const { prompt, scope, timeframe, parent_report_id } = payload;

    if (!prompt || !scope) {
      return errorResponse("MISSING_FIELDS", "Missing required fields: prompt, scope");
    }

    if (scope === "org" && !["Super Admin", "Admin"].includes(user.roleName)) {
      return errorResponse("FORBIDDEN", "Organization-wide reports require Admin role", 403);
    }
    if (scope === "team" && !["Super Admin", "Admin", "Manager"].includes(user.roleName)) {
      return errorResponse("FORBIDDEN", "Team reports require Manager role", 403);
    }

    const timeRangeDates = getTimeRangeDates(timeframe);

    const { data: reportRow, error: insertErr } = await supabase
      .from("ai_reports")
      .insert({
        organization_id: user.orgId,
        created_by_user_id: user.id,
        scope,
        report_name: prompt.slice(0, 100),
        prompt,
        status: "running",
        timeframe_start: timeRangeDates.start,
        timeframe_end: timeRangeDates.end,
        parent_report_id: parent_report_id || null,
      })
      .select()
      .single();

    if (insertErr || !reportRow) {
      return errorResponse("DB_ERROR", "Failed to create report record");
    }

    const { data: llmProvider } = await supabase
      .from("llm_providers")
      .select("*, models:llm_models(*)")
      .eq("org_id", user.orgId)
      .eq("enabled", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!llmProvider) {
      await supabase.from("ai_reports").update({ status: "failed", error_message: "No LLM provider configured" }).eq("id", reportRow.id);
      return errorResponse("NO_PROVIDER", "No AI provider configured. Go to Settings > Integrations to set up an AI provider.");
    }

    const defaultModel = llmProvider.models?.find((m: { is_default: boolean }) => m.is_default) || llmProvider.models?.[0];
    if (!defaultModel) {
      await supabase.from("ai_reports").update({ status: "failed", error_message: "No LLM model configured" }).eq("id", reportRow.id);
      return errorResponse("NO_MODEL", "No AI model configured");
    }

    let parentContext = "";
    if (parent_report_id) {
      const { data: parentReport } = await supabase
        .from("ai_reports")
        .select("report_name, prompt, result_json")
        .eq("id", parent_report_id)
        .maybeSingle();
      if (parentReport?.result_json) {
        const prev = parentReport.result_json as Record<string, unknown>;
        parentContext = `\n\nPREVIOUS REPORT CONTEXT (this is a follow-up):\nTitle: ${parentReport.report_name}\nOriginal prompt: ${parentReport.prompt}\nExecutive Summary: ${(prev.executive_summary as string || "").slice(0, 1000)}\nInsights: ${JSON.stringify((prev.insights as string[]) || [])}\n\nThe user wants to refine or expand on this report. Consider the prior findings when generating the new plan.`;
      }
    }

    const planSystemPrompt = buildPlanSystemPrompt(scope, timeRangeDates);
    const planUserPrompt = `Generate a report plan for this request: "${prompt}"${parentContext}`;

    const { content: planContent, tokensUsed: planTokens } = await callAnthropic(
      llmProvider.api_key_encrypted,
      planSystemPrompt,
      planUserPrompt
    );

    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(planContent);
    } catch {
      await supabase.from("ai_reports").update({ status: "failed", error_message: "Failed to parse AI plan response" }).eq("id", reportRow.id);
      return errorResponse("PARSE_ERROR", "AI returned invalid plan format");
    }

    const sqlQueries = (plan.sql_queries as Array<Record<string, string>>) || [];
    const kpiQueries = (plan.kpi_queries as Array<Record<string, string>>) || [];

    const queryResults: Record<string, unknown[]> = {};

    for (const q of [...sqlQueries, ...kpiQueries]) {
      try {
        let sql = sanitizeSQL(q.sql);
        sql = sql
          .replace(/\{\{ORG_ID\}\}/g, user.orgId)
          .replace(/\{\{USER_ID\}\}/g, user.id)
          .replace(/\{\{DEPARTMENT_ID\}\}/g, user.departmentId || "")
          .replace(/\{\{TIME_RANGE_START\}\}/g, timeRangeDates.start)
          .replace(/\{\{TIME_RANGE_END\}\}/g, timeRangeDates.end);

        const { data: results, error: qErr } = await supabase.rpc("exec_report_query", { query_text: sql });
        if (qErr) {
          console.error(`Query ${q.id} failed:`, qErr.message);
          queryResults[q.id] = [];
        } else {
          queryResults[q.id] = results || [];
        }
      } catch (e) {
        console.error(`Query ${q.id} error:`, e);
        queryResults[q.id] = [];
      }
    }

    const dataSources = (plan.data_sources as Array<Record<string, unknown>> || []).map((d) => d.module as string);
    const category = (plan.report_category as string) || "custom";
    const reportName = (plan.report_name as string) || prompt.slice(0, 100);

    await supabase.from("ai_reports").update({
      plan_json: plan,
      report_name: reportName,
      report_category: category,
      data_sources_used: dataSources,
    }).eq("id", reportRow.id);

    const composeSystemPrompt = buildComposeSystemPrompt();
    const composeUserPrompt = `Compose a full report from this data.

Report Plan: ${JSON.stringify({ name: reportName, category, scope, timeframe: { start: timeRangeDates.start, end: timeRangeDates.end } })}

Chart definitions from plan: ${JSON.stringify(plan.charts || [])}
Table definitions from plan: ${JSON.stringify(plan.tables || [])}
KPI definitions from plan: ${JSON.stringify(plan.kpi_queries || [])}

Query results:
${Object.entries(queryResults).map(([id, rows]) => `\n--- ${id} (${(rows as unknown[]).length} rows) ---\n${JSON.stringify((rows as unknown[]).slice(0, 50), null, 2)}`).join("\n")}

Compose the full report with all sections. Make sure chart data arrays match the chart type and contain actual data points from the results.`;

    const { content: composeContent, tokensUsed: composeTokens } = await callAnthropic(
      llmProvider.api_key_encrypted,
      composeSystemPrompt,
      composeUserPrompt
    );

    let compose: Record<string, unknown>;
    try {
      compose = JSON.parse(composeContent);
    } catch {
      await supabase.from("ai_reports").update({ status: "failed", error_message: "Failed to parse AI compose response" }).eq("id", reportRow.id);
      return errorResponse("PARSE_ERROR", "AI returned invalid report format");
    }

    const renderedHTML = generateRenderedHTML(compose, reportName, timeRangeDates.start, timeRangeDates.end);
    const csvData = generateCSVData(compose);

    const versionSuffix = parent_report_id ? (() => {
      const existing = queryResults as Record<string, unknown>;
      return existing ? " v2" : "";
    })() : "";

    const { error: updateErr } = await supabase.from("ai_reports").update({
      report_name: (compose.title as string) || reportName + versionSuffix,
      status: "complete",
      result_json: compose,
      rendered_html: renderedHTML,
      csv_data: csvData,
      data_sources_used: dataSources,
      updated_at: new Date().toISOString(),
    }).eq("id", reportRow.id);

    if (updateErr) {
      console.error("Failed to update report:", updateErr);
    }

    const { data: finalReport } = await supabase
      .from("ai_reports")
      .select("*, created_by_user:users!ai_reports_created_by_user_id_fkey(id, name, email, avatar_url)")
      .eq("id", reportRow.id)
      .single();

    return jsonResponse({
      success: true,
      report_id: reportRow.id,
      report: finalReport,
      tokens_used: planTokens + composeTokens,
    });

  } catch (error) {
    console.error("AI report generate error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
});
