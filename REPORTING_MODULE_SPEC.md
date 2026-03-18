# Reporting Module — Developer Specification

## Overview

The Reporting module is an AI-powered analytics system that generates structured, multi-section reports from natural language prompts. Users describe what they want to analyze, the AI builds a full report plan, queries the relevant data sources, and returns a composed report containing KPI cards, charts, data tables, an executive summary, key insights, and actionable recommendations.

The module consists of three primary views, a suite of display components, a scheduling system, and a server-side edge function that orchestrates the AI generation pipeline.

---

## Tech Stack & Dependencies

| Concern | Library |
|---|---|
| Charts | `recharts` (BarChart, LineChart, PieChart, AreaChart, ResponsiveContainer) |
| Icons | `lucide-react` |
| Routing | `react-router-dom` v7 |
| Styling | Tailwind CSS (dark theme — slate palette) |
| Database | Supabase (PostgreSQL + RLS) |
| AI Generation | Supabase Edge Function: `ai-report-generate` |

---

## Routes

All routes are feature-gated with `featureFlag="reporting"` and wrapped in a `ProtectedRoute` component.

| Path | Component | Permission Required |
|---|---|---|
| `/reporting` | `Reporting` | `reporting.view` |
| `/reporting/ai` | `AIReporting` | `reporting.ai.query` |
| `/reporting/:id` | `ReportView` | `reporting.view` |

---

## Database Schema

### Table: `ai_reports`

```sql
CREATE TABLE IF NOT EXISTS ai_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope               text NOT NULL CHECK (scope IN ('my', 'team', 'org')),
  report_category     text NOT NULL CHECK (report_category IN ('sales', 'marketing', 'ops', 'reputation', 'finance', 'projects', 'custom')),
  report_name         text NOT NULL,
  timeframe_start     timestamptz,
  timeframe_end       timestamptz,
  status              text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
  plan_json           jsonb,
  result_json         jsonb,
  rendered_html       text,
  csv_data            text,
  parent_report_id    uuid REFERENCES ai_reports(id) ON DELETE SET NULL,
  prompt              text NOT NULL DEFAULT '',
  data_sources_used   text[] DEFAULT '{}',
  filters_applied     jsonb DEFAULT '{}',
  error_message       text,
  delete_at           timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view reports"
  ON ai_reports FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own reports"
  ON ai_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid() AND
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own reports"
  ON ai_reports FOR UPDATE
  TO authenticated
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete own reports"
  ON ai_reports FOR DELETE
  TO authenticated
  USING (created_by_user_id = auth.uid());
```

### Table: `ai_report_schedules`

```sql
CREATE TABLE IF NOT EXISTS ai_report_schedules (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id                   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_report_id        uuid REFERENCES ai_reports(id) ON DELETE SET NULL,
  cadence_days              integer NOT NULL DEFAULT 30,
  next_run_at               timestamptz NOT NULL,
  last_run_at               timestamptz,
  is_active                 boolean NOT NULL DEFAULT true,
  report_name_template      text NOT NULL DEFAULT '',
  scope                     text NOT NULL DEFAULT 'my' CHECK (scope IN ('my', 'team', 'org')),
  prompt_template           text NOT NULL DEFAULT '',
  report_plan_template_json jsonb NOT NULL DEFAULT '{}',
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

ALTER TABLE ai_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedules"
  ON ai_report_schedules FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own schedules"
  ON ai_report_schedules FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own schedules"
  ON ai_report_schedules FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own schedules"
  ON ai_report_schedules FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
```

---

## TypeScript Type Definitions

```typescript
// src/types/aiReports.ts

import type { User } from './index';

export type ReportScope = 'my' | 'team' | 'org';
export type ReportCategory = 'sales' | 'marketing' | 'ops' | 'reputation' | 'finance' | 'projects' | 'custom';
export type AIReportStatus = 'running' | 'complete' | 'failed';

// --- ReportPlan (AI planning phase output) ---

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

// --- ReportCompose (final rendered report data) ---

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

// --- Database record ---

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
  // joined relations
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
  // joined relations
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
```

---

## Permissions Reference

| Permission Key | Grants Access To |
|---|---|
| `reporting.view` | View report list, open individual reports |
| `reporting.ai.query` | Generate new reports, access Full Chat interface |

Scope availability is role-gated:
- `my` — available to all authenticated users
- `team` — requires role of Manager, Admin, or Super Admin
- `org` — requires role of Admin or Super Admin

---

## Constants

```typescript
// Suggested prompts shown in the prompt UI
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

// Timeframe dropdown options
export const TIMEFRAME_OPTIONS = [
  { value: 'last_7_days',    label: 'Last 7 Days' },
  { value: 'last_30_days',   label: 'Last 30 Days' },
  { value: 'this_month',     label: 'This Month' },
  { value: 'last_month',     label: 'Last Month' },
  { value: 'this_quarter',   label: 'This Quarter' },
  { value: 'last_quarter',   label: 'Last Quarter' },
  { value: 'this_year',      label: 'This Year' },
];

// Scope dropdown options with minimum role requirement
export const SCOPE_OPTIONS = [
  { value: 'my',   label: 'My Data',            minRole: null },
  { value: 'team', label: 'Team Data',           minRole: 'Manager' },
  { value: 'org',  label: 'Organization Data',   minRole: 'Admin' },
];

// Schedule cadence options
export const CADENCE_OPTIONS = [
  { value: 7,  label: 'Every 7 days' },
  { value: 14, label: 'Every 14 days' },
  { value: 30, label: 'Every 30 days' },   // default, shown as "Recommended"
  { value: 60, label: 'Every 60 days' },
  { value: 90, label: 'Every 90 days' },
];

// Report category display labels
const CATEGORY_LABELS: Record<string, string> = {
  sales:      'Sales',
  marketing:  'Marketing',
  ops:        'Operations',
  reputation: 'Reputation',
  finance:    'Finance',
  projects:   'Projects',
  custom:     'Custom',
};

// Chart palette (used in order, cycling if more series than colors)
const CHART_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
  '#ec4899', '#84cc16', '#f97316', '#6366f1', '#14b8a6',
];

// Status badge styles
const STATUS_STYLES = {
  complete: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Complete' },
  running:  { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    label: 'Running' },
  failed:   { bg: 'bg-red-500/10',     text: 'text-red-400',     label: 'Failed' },
};
```

---

## Services Layer

### `src/services/aiReports.ts`

#### `generateReport(organizationId, userId, request) → Promise<GenerateReportResponse>`

Calls the `ai-report-generate` edge function. The edge function receives:
```json
{
  "prompt": "string",
  "scope": "my|team|org",
  "timeframe": { "type": "preset", "preset": "last_30_days" },
  "parent_report_id": "uuid|null"
}
```
Returns `{ success: true, report_id: "uuid" }` on success. On failure, returns `{ success: false, error: "message" }`. The report record is created in `ai_reports` with `status: 'running'` immediately and updated to `complete` or `failed` when the edge function finishes.

#### `getAIReports(organizationId, filters?) → Promise<AIReport[]>`

Queries `ai_reports` with `organization_id = organizationId`, ordered by `created_at DESC`, limited to 100 records. Supports filters:
- `category` → `eq('report_category', value)`
- `scope` → `eq('scope', value)`
- `status` → `eq('status', value)`
- `search` → `ilike('report_name', '%value%')`

Selects joined `created_by_user` via foreign key `ai_reports_created_by_user_id_fkey`.

#### `getAIReportById(reportId) → Promise<AIReport | null>`

Fetches a single report by primary key using `maybeSingle()`.

#### `getReportVersions(reportId) → Promise<AIReport[]>`

Fetches the full version chain of a report. First loads the report to get its root: if the report has a `parent_report_id`, uses that as root; otherwise uses the report's own `id`. Then queries all reports where `id = rootId OR parent_report_id = rootId`, ordered ascending by `created_at`. Used to display the version history panel.

#### `duplicateReport(reportId, userId) → Promise<AIReport>`

Loads the original, then inserts a new row with the same fields but appends ` (Copy)` to the name. Sets `parent_report_id` to null (creating a new chain). Returns the new report.

#### `deleteReport(reportId) → Promise<void>`

Hard deletes the report record. Only the report creator is allowed to delete (enforced by RLS).

#### `getAIReportStats(organizationId) → Promise<AIReportStats>`

Runs 4 parallel Supabase queries (count-only):
1. Total reports for org
2. Running reports for org
3. Active schedules for org
4. Most recently completed report (`created_at` of the latest `status=complete` record)

Returns `{ totalReports, runningReports, scheduledReports, lastGeneratedDate }`.

#### `pollReportStatus(reportId, onUpdate?, maxAttempts=60, intervalMs=3000) → Promise<AIReport>`

Polls `getAIReportById` on a fixed interval. On each poll:
- Calls `onUpdate(report)` if provided
- If `status === 'complete'` or `status === 'failed'`, stops and returns the report
- After `maxAttempts` (default 60 × 3 s = 3 minutes), throws `'Report generation timed out'`

#### `getReportCategoryLabel(category) → string`

Maps category key to display label. Unknown categories return `'Custom'`.

#### `getScopeLabel(scope) → string`

Maps `'my'` → `'My Data'`, `'team'` → `'Team'`, `'org'` → `'Organization'`.

---

### `src/services/aiReportSchedules.ts`

#### `getSchedules(organizationId) → Promise<AIReportSchedule[]>`

Fetches all schedules for an org, ordered by `created_at DESC`. Joins `user` and `original_report`.

#### `getSchedulesByReportId(reportId) → Promise<AIReportSchedule[]>`

Fetches schedules where `original_report_id = reportId`.

#### `createSchedule(organizationId, userId, params) → Promise<AIReportSchedule>`

Inserts a new schedule. `next_run_at` is computed as:
```typescript
new Date(Date.now() + params.cadenceDays * 86400000).toISOString()
```
`is_active` defaults to `true`.

#### `updateSchedule(scheduleId, params) → Promise<AIReportSchedule>`

Partial update. If `cadenceDays` changes, recalculates `next_run_at`. Sets `updated_at` to current time.

#### `deleteSchedule(scheduleId) → Promise<void>`

Hard delete.

#### `toggleSchedule(scheduleId, isActive) → Promise<void>`

Sets `is_active` and `updated_at` only.

---

### `src/services/reportingDataAccess.ts`

This service is used server-side (within the edge function) to safely query CRM data for report generation.

#### Data Sources

There are 9 supported data sources. Each has a configuration record defining:

| Data Source | Table | Owner Field | Required Permission | Available Fields |
|---|---|---|---|---|
| `contacts` | `contacts` | `owner_id` | `contacts.view` | id, first_name, last_name, email, phone, company, job_title, source, status, city, state, country, lead_score, created_at, updated_at, last_activity_at |
| `opportunities` | `opportunities` | `owner_id` | `opportunities.view` | id, name, value, status, expected_close_date, actual_close_date, probability, source, created_at, updated_at |
| `appointments` | `appointments` | `assigned_user_id` | `appointments.view` | id, status, start_at_utc, end_at_utc, source, notes, created_at, updated_at |
| `conversations` | `conversations` | `assigned_user_id` | `conversations.view` | id, subject, channel, status, priority, last_message_at, created_at, updated_at |
| `invoices` | `invoices` | — | `payments.view` | id, invoice_number, status, subtotal, tax_amount, total, due_date, paid_at, created_at, updated_at |
| `payments` | `payments` | — | `payments.view` | id, amount, status, method, paid_at, created_at |
| `forms` | `form_submissions` | — | `marketing.forms.view` | id, submitted_at, ip_address, user_agent |
| `surveys` | `survey_submissions` | — | `marketing.surveys.view` | id, submitted_at, completed, score |
| `reviews` | `reviews` | — | `reputation.view` | id, rating, title, content, platform, reviewed_at, created_at |

**Join specs:** Each data source includes optional join specifications that add extra fields via Supabase relational selects (e.g. `owner.name as owner_name`, `pipeline.name as pipeline_name`, contact name fields).

#### `getAvailableDataSources(userContext) → DataSource[]`

Returns all data sources if Super Admin; otherwise filters by which permissions the user holds.

#### `getFieldsForDataSource(dataSource) → string[]`

Returns base fields plus aliased join fields available for that data source.

#### `querySystemData(querySpec, userContext) → Promise<QueryResult>`

Primary query executor. Steps:
1. Validates data source exists
2. Checks user permission (throws if lacking)
3. Validates requested fields against whitelist
4. Builds Supabase query with `org_id` filter
5. If user is not Super Admin and data source has an `ownerField`, scopes to `owner_id = userId` (unless user has view-all permission)
6. Applies all `filters` using `applyFilters()`
7. Applies `dateRange` using `.gte()` / `.lte()`
8. Applies `orderBy` clauses
9. Applies `limit` and `offset` using `.range()`
10. Runs the query
11. If `aggregates` are specified, calls `computeAggregates()` separately
12. Returns `{ rows, totalCount, aggregates }`

**Supported filter operators:** `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `not_in`, `is_null`, `is_not_null`, `between`

#### `getMetricsByTimePeriod(...)→ Promise<Array<{period, value}>>`

Time-series aggregation helper. Groups rows by day/week/month/quarter/year and aggregates values using count/sum/avg.

Period key format:
- day → `YYYY-MM-DD`
- week → `YYYY-W##`
- month → `YYYY-MM`
- quarter → `YYYY-Q#`
- year → `YYYY`

---

## Edge Function: `ai-report-generate`

**Endpoint:** `POST /functions/v1/ai-report-generate`

**Authorization:** Bearer token (Supabase anon key + user JWT)

**Request body:**
```json
{
  "prompt": "Sales performance last 30 days",
  "scope": "org",
  "timeframe": {
    "type": "preset",
    "preset": "last_30_days"
  },
  "parent_report_id": null
}
```

**Behavior:**
1. Authenticates the requesting user from the JWT
2. Loads user's organization, role, permissions
3. Creates an `ai_reports` record with `status: 'running'`
4. Returns immediately with `{ success: true, report_id: "uuid" }` — generation is async
5. In background:
   - Calls the LLM to generate a `ReportPlan` (JSON) based on the prompt and scope
   - Resolves timeframe presets to actual date ranges
   - Queries `reportingDataAccess` functions for each data source specified in the plan
   - Calls the LLM again to compose a `ReportCompose` from the raw data
   - Updates the `ai_reports` row: sets `status: 'complete'`, writes `plan_json`, `result_json`, `rendered_html`, `csv_data`, `data_sources_used`, `timeframe_start`, `timeframe_end`, `report_name`, `report_category`
   - On any error: sets `status: 'failed'`, writes `error_message`

**Success response:**
```json
{
  "success": true,
  "report_id": "uuid"
}
```

**Error response:**
```json
{
  "success": false,
  "error": { "message": "Reason" }
}
```

The client polls `ai_reports` for `status` changes using `pollReportStatus()`.

---

## Page Specifications

### Page 1: `Reporting` — Report List (`/reporting`)

**Layout:** Full-page scrollable, `bg-slate-900`, padding `p-6`, `space-y-6`

#### Header Row
- Left: Title `"Reporting"` (`text-3xl font-bold text-white`) + subtitle `"Analyze performance across your system"` (`text-slate-400 mt-1`)
- Right: `"Full Chat"` button — `bg-slate-800 text-cyan-400 border border-cyan-500/30 rounded-lg px-4 py-2.5 hover:bg-slate-700` with `Sparkles` icon. Navigates to `/reporting/ai`. Gated behind `reporting.ai.query` permission.

#### Generate Report Panel
Visible only to users with `reporting.ai.query` permission. Card style: `bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700 p-6`.

Panel header: `Sparkles` icon (cyan-400) + `"Generate Report"` label.

**Prompt row (flex, gap-3):**
1. Text input (flex-1) — placeholder: `"Describe the report you need... e.g., 'Sales performance breakdown by rep this quarter'"`. Triggers `handleGenerate` on `Enter` (not `Shift+Enter`). Style: `px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-cyan-500`.
2. Scope `<select>` — filtered by user's role. Options: My Data / Team Data / Organization Data. Default: `'my'`. Style: `appearance-none px-4 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white` with `ChevronDown` icon overlay.
3. Timeframe `<select>` — 7 options (Last 7 Days → This Year). Default: `'last_30_days'`. Same style.
4. Submit button — gradient `from-cyan-500 to-teal-500`, `px-5 py-3`, rounded-lg. Shows `Send` icon normally; shows `Loader2 animate-spin` while generating. Disabled when prompt empty or generating.

**Suggested prompts (flex-wrap, gap-2, mt-4):** First 5 from `SUGGESTED_PROMPTS`. Each is a pill button: `px-3 py-1.5 bg-slate-700/50 text-slate-300 text-sm rounded-full hover:bg-slate-600 hover:text-white`. Clicking sets the prompt input value.

**Generating state overlay (shown when `isGenerating`):** `bg-slate-900/50 rounded-lg border border-cyan-500/20 p-6`. Contains a spinning animation ring (outer `border-2 border-cyan-500/30 border-t-cyan-400`) with `Sparkles` icon centered inside, plus text: `"Generating your report..."` and `"AI is analyzing your data and building the report"`.

#### Stats Row
4-column grid (`grid-cols-4 gap-4`). Only rendered when `stats` is non-null. Each `StatCard` has icon, colored icon background, label, and bold value:
1. Total Reports — `FileText` icon, `bg-cyan-500/20`
2. Running — `Loader2` icon, `bg-amber-500/20`
3. Scheduled — `Clock` icon, `bg-teal-500/20`
4. Last Generated — `TrendingUp` icon, `bg-emerald-500/20` (shows formatted date or `'-'`)

`StatCard` layout: `bg-slate-800 rounded-xl border border-slate-700 p-5`. Icon in 40×40 rounded-lg container. Label: `text-sm text-slate-400`. Value: `text-2xl font-bold text-white`.

#### Reports Table
Wrapper: `bg-slate-800 rounded-xl border border-slate-700 overflow-hidden`

**Filter bar (px-4 py-4, border-b border-slate-700):**
- Search input (max-w-md, flex-1) with `Search` icon prefix. Filters by `report_name` ilike.
- `Filters` toggle button. When filters are active: `border-cyan-500 bg-cyan-500/10 text-cyan-400`. Default: `border-slate-600 text-slate-300 hover:bg-slate-700`.

**Expanded filter panel (shown when `showFilters`):** 3 `<select>` dropdowns (Category, Scope, Status). A `Clear` button appears if any filter is set: `text-cyan-400 hover:text-cyan-300 flex items-center gap-1`.

**Empty state:** `BarChart3` icon (slate-600, 48×48), `"No reports yet"`, `"Use the prompt above to generate your first AI report"`.

**Loading state:** Centered `Loader2` (cyan-400, animate-spin).

**Table columns:** Report, Category, Scope, Timeframe, Created, Status, Actions

**Report column:** 40×40 rounded-lg `bg-gradient-to-br from-cyan-500/20 to-teal-500/20` container with `Sparkles` icon (cyan-400). Report name (`font-medium text-white`) + creator name beneath (`text-xs text-slate-500`).

**Category column:** Pill badge `px-2.5 py-1 bg-slate-700 text-slate-300 rounded-full text-xs font-medium`.

**Status badge:** `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium`. Uses `STATUS_STYLES` map. Running status includes a spinning `Loader2` icon (`w-3 h-3`).

**Timeframe column:** Shows date range with `CalendarIcon` prefix. Shows `'-'` when no dates.

**Actions column (stopPropagation):**
- CSV download button (`Download` icon, `p-1.5`) — only shown when `status === 'complete'` and `csv_data` exists.
- `MoreVertical` dropdown button. Dropdown options:
  - View Report (Eye icon) → navigates to `/reporting/:id`
  - Duplicate (Copy icon)
  - Export PDF (Download icon) — only shown when `rendered_html` exists
  - Divider
  - Delete (Trash2 icon, red) — only shown if `created_by_user_id === currentUserId`

**Row behavior:** Entire row is clickable (`cursor-pointer hover:bg-slate-700/50`), navigates to `/reporting/:id`.

**Export CSV logic:** Creates a Blob from `report.csv_data`, creates a temporary `<a>` element, triggers download with filename `{reportName}.csv`, revokes the object URL.

**Export PDF logic:** Opens `rendered_html` in a new window, waits for `onload`, calls `window.print()`.

---

### Page 2: `ReportView` — Individual Report (`/reporting/:id`)

**Layout:** `h-full flex flex-col bg-slate-900`. Sticky header + scrollable body.

#### Sticky Header (`px-6 py-4 border-b border-slate-700/60 bg-slate-900/95 backdrop-blur sticky top-0 z-10`)

Left side:
- Back button (`ArrowLeft`, `p-2`) → navigates to `/reporting`
- Report title (`text-xl font-bold text-white`) — uses `result.title` if available, falls back to `report_name`
- Status badge (same styles as list page, but with explicit border: `border-emerald-500/20` etc.)
- Metadata row (`text-sm text-slate-400`, `flex items-center gap-4`):
  - Scope with icon (`User` for `my`, `Users` for `team`, `Building2` for `org`)
  - Category with `Sparkles` icon
  - Timeframe range with `Calendar` icon (only if both dates exist)
  - Created date/time with `Clock` icon (formatted with time: `"Jan 1, 2025, 12:00 PM"`)

Right side (flex, gap-2):
- Schedule count indicator (if any active schedules exist): `bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300` with `CalendarClock` (cyan-400) icon. Text: `N schedule(s)`.
- `Schedule` button (`Clock` icon) → opens `ScheduleReportModal`
- Version picker button (`History` icon) — only shown when `versions.length > 1`. Label: `v{currentIndex + 1} of {total}`. Clicking toggles the version panel.
- `MoreHorizontal` actions dropdown:
  - Export CSV
  - Export PDF (Printer icon)
  - Duplicate
  - Divider
  - Delete (red)

**Version panel (expanded below header):** Horizontal scrollable row of version buttons. Active version: `bg-cyan-500/10 border-cyan-500/30 text-cyan-300`. Others: `bg-slate-800 border-slate-700 text-slate-400 hover:text-white`. Each shows `v{n}` + short date. Clicking navigates to that version's URL.

#### Body (flex-1 overflow-y-auto)

**Running state:** Centered flex container with `Loader2` (cyan-400, 40×40, animate-spin), `"Generating Report"` heading, `"AI is analyzing your data..."` subtext.

**Failed state:** Centered flex container with red icon container, `"Report Generation Failed"` heading, error message, and `"Try Again"` button → navigates to `/reporting/ai`.

**Complete state (max-w-6xl mx-auto p-6 space-y-8):**

1. **Prompt card** (if `report.prompt` exists): `bg-slate-800/40 rounded-xl border border-slate-700/40 p-4`. `Sparkles` icon + `"PROMPT"` label. Prompt text: `text-sm text-slate-300`.

2. **KPI Grid** — `<ReportKPIGrid kpis={result.kpis} />`

3. **Narrative** — `<ReportNarrative executiveSummary={...} insights={...} recommendations={...} />`

4. **Charts** — `<AIReportChartGrid charts={result.charts} />`

5. **Tables** — `<AIReportTableList tables={result.tables} />`

6. **Data sources footer** (if `data_sources_used.length > 0`): `text-xs text-slate-500 flex items-center gap-2 pt-4 border-t border-slate-800`. "Data sources:" label, then each source as `px-2 py-0.5 bg-slate-800 rounded text-slate-400` pill.

#### Follow-up Panel (sticky bottom, only shown when report is complete)

`border-t border-slate-700/60 bg-slate-800/30 p-4`. Inner max-w-4xl.

Header: `Sparkles` icon + `"Ask a follow-up"` text.

Input row (flex, gap-3):
1. `<textarea>` (flex-1, rows=1, resize-none) — placeholder: `"Drill deeper, change scope, or request changes to this report..."`. Enter (without Shift) submits.
2. Scope `<select>` (same style as main page, smaller: `px-3 pr-8 text-sm`)
3. Timeframe `<select>` (same style)
4. Submit button — gradient cyan-to-teal, `p-3 rounded-xl`. `Loader2` when generating, `Send` otherwise.

When a follow-up is submitted:
- Calls `generateReport` with `parent_report_id: report.id`
- Polls with `pollReportStatus`
- On success, navigates to the new report: `/reporting/{newId}`
- On failure, shows toast

---

### Page 3: `AIReporting` — Full Chat Interface (`/reporting/ai`)

**Layout:** `min-h-screen bg-slate-900 flex` (side-by-side: sidebar + main)

#### Left Sidebar (w-72, `bg-slate-800 border-r border-slate-700 flex flex-col`)

**Top section (p-4 border-b space-y-3):**
- Back link (`ArrowLeft` + `"Back to Reports"`) → navigates to `/reporting`
- `"New Report"` button (full-width, `bg-cyan-600 hover:bg-cyan-500`, `Sparkles` icon) → clears messages, clears `parentReportId`, clears prompt input

**Section header:** `"Recent Reports"` (`text-sm font-semibold text-slate-400 uppercase tracking-wider`)

**Report history list (flex-1 overflow-y-auto):**
- Loads up to 20 most recent `complete` reports via `getAIReports`
- Empty: `"No reports yet"` (slate-500, sm)
- Loading: centered `Loader2`
- Each entry: full-width button, `p-3 rounded-lg hover:bg-slate-700/50`. Report name (`text-sm text-slate-300 line-clamp-2 group-hover:text-white`). Below: `Clock` icon + relative date (`"Today"`, `"Yesterday"`, or `"Jan 1"` format). Clicking navigates to `/reporting/{id}`.

#### Main Chat Area (flex-1 flex flex-col)

**Messages area (flex-1 overflow-y-auto p-6):**

**Empty state (max-w-2xl mx-auto pt-12):**
- Logo: 64×64 `rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500` with `Sparkles` icon (white, 32×32)
- `"AI Report Generator"` heading (`text-3xl font-bold text-white mb-3`)
- Subtitle: `"Describe what you want to analyze and AI will build a full report"` (`text-slate-400 text-lg`)
- Suggested prompts grid (2 columns): Each prompt is a card `p-4 text-left bg-slate-800 border border-slate-700 rounded-xl hover:border-cyan-500/50 hover:bg-slate-700/50`. Text: `text-slate-300 group-hover:text-white text-sm`. `ChevronRight` icon below (`text-slate-500 group-hover:text-cyan-400`). Clicking sets the prompt input.

**Message thread (max-w-3xl mx-auto space-y-6):**

Each message is flex with `justify-end` (user) or `justify-start` (AI/system). Message bubble `max-w-[85%]`:

- **User message:** `bg-slate-700 rounded-2xl rounded-br-md p-4`. Message text + timestamp below.
- **AI message:** `bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-md p-4`. Header row: `Sparkles` (cyan-400) + `"AI Report"` label (cyan-400) + timestamp.
  - If `isLoading`: shows `Loader2` (cyan-400, animate-spin) + `"Building your report..."` text
  - If complete: shows `executive_summary` text. If `reportId` is set, shows action footer: `"View Full Report"` button (`bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-lg text-sm`) + KPI/chart count string.
- **System message (error):** `bg-red-500/10 border border-red-500/20 rounded-2xl rounded-bl-md p-4`. Shows error text in white.

Auto-scroll: `useRef` on a sentinel `<div>` at end of messages, calls `.scrollIntoView({ behavior: 'smooth' })` when messages update.

#### Composer Bar (`border-t border-slate-700 bg-slate-800/50 backdrop-blur p-4`)

If a `parentReportId` is set: shows context note `"Following up on previous report"` + `"Start fresh"` link (cyan-400).

Input row (flex, gap-3):
1. `<textarea>` (flex-1, rows=1, resize-none) — placeholder changes based on whether there's a parent: `"Ask a follow-up question or request changes..."` vs `"Describe the report you want to generate..."`. Enter (without Shift) submits.
2. Scope `<select>`
3. Timeframe `<select>`
4. Submit button (gradient, `p-3 rounded-xl`)

Footer: `"Press Enter to send, Shift+Enter for new line"` (`text-xs text-slate-500 mt-2 text-center`)

**Submit flow:**
1. Creates a `user` ChatMessage and a `ai` ChatMessage with `isLoading: true`. Appends both to messages array.
2. Calls `generateReport` with `parent_report_id` if set.
3. On success: polls with `pollReportStatus`. Updates the loading AI message to show `executive_summary` and the `reportId`. Sets `parentReportId` to the new report ID (for follow-up chaining). Refreshes recent reports sidebar.
4. On any failure: updates the loading AI message to a `system` type with the error text.

---

## Component Specifications

### `ReportKPICard` & `ReportKPIGrid`

**`ReportKPICard`** receives a `ReportComposeKPI` and renders a single metric card.

Card container: `bg-slate-800/80 rounded-xl border border-slate-700/60 p-5 hover:bg-slate-800 transition-all`

Layout:
- Top row: label (`text-sm font-medium text-slate-400`) on left, delta badge on right (only if `delta_pct != null`).
- Delta badge: `flex items-center gap-1 px-2 py-0.5 rounded-full border`. Color by trend: up = emerald, down = red, flat = slate. Icon: `TrendingUp`, `TrendingDown`, or `Minus`. Value: `{sign}{Math.abs(delta_pct * 100).toFixed(1)}%`.
- Bottom: main value (`text-2xl font-bold text-white tracking-tight`).

**Value formatting:**
- `string` type → displayed as-is
- `format === 'currency'` → `Intl.NumberFormat` USD, 0 fraction digits
- `format === 'percentage'` → `(value * 100).toFixed(1)%`
- `>= 1,000,000` → `{n}M`
- `>= 1,000` → `{n}K`
- Other numbers → `Intl.NumberFormat` en-US

**Trend auto-detection** (if `trend` not set): derived from `delta_pct` sign.

**`ReportKPIGrid`** renders a responsive grid of `ReportKPICard` components:
- 2 KPIs → `grid-cols-2`
- 3 KPIs → `grid-cols-3`
- 4+ KPIs → `grid-cols-2 lg:grid-cols-4`

---

### `AIReportChart` & `AIReportChartGrid`

**`AIReportChart`** renders a single Recharts visualization.

Container: `bg-slate-800/60 rounded-xl border border-slate-700/50 p-6`

Title: `text-sm font-semibold text-white mb-4`

No-data fallback: centered text `"No data available for this chart"` in a 48px-tall container.

No-numeric-series fallback: `"No numeric data for chart rendering"`.

**Key data detection logic:**
- `xKey`: first non-numeric key in the first row. Falls back to `'name'`.
- `seriesKeys`: all keys where at least one row has a numeric value, excluding `xKey`.

**Recharts config:**
- `ResponsiveContainer width="100%" height={320}`
- All chart types: `margin={{ top: 5, right: 20, left: 10, bottom: 40 }}`
- `XAxis`: `angle={-35} textAnchor="end"`, `tickFormatter={formatTickValue}`
- `YAxis`: `tickFormatter={formatTickValue}`
- `CartesianGrid strokeDasharray="3 3" stroke="#334155"`
- `Tooltip` custom style: `backgroundColor: '#1e293b'`, `border: '1px solid #334155'`, `borderRadius: '8px'`, `fontSize: '12px'`, `color: '#e2e8f0'`, label: `color: '#94a3b8'`
- `Legend` (only shown when `seriesKeys.length > 1`): `wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }}`

**Per chart type:**
- **bar**: `radius={[4, 4, 0, 0]}` on each Bar, fill from COLORS array
- **line**: `type="monotone" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}`
- **area**: `fillOpacity={0.15} strokeWidth={2}`
- **pie**: `outerRadius={110}`, labels: `"name percent%"`, label line stroke `#475569`, max 10 slices

**`formatTickValue`:** Numbers ≥1M → `{n}M`, ≥1K → `{n}K`, else localeString. Strings > 16 chars → truncated with `...`.

**`AIReportChartGrid`:** Renders charts in a responsive grid.
- 1 chart → `grid-cols-1`
- 2+ charts → `grid-cols-1 lg:grid-cols-2`

---

### `AIReportTable` & `AIReportTableList`

**`AIReportTable`** renders a single data table from a `ReportComposeTable`.

Container: `bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden`

Header: `px-6 py-4 border-b border-slate-700/50`, title `text-sm font-semibold text-white`

Table:
- `thead` row: `border-b border-slate-700/40`. Each `<th>`: `px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider`
- `tbody`: `divide-y divide-slate-700/30`. Each row: `hover:bg-slate-700/20 transition-colors`. Each cell: `px-4 py-3 text-sm text-slate-300 whitespace-nowrap`
- Max 25 rows displayed. If `rows.length > 25`: footer `"Showing 25 of N rows"` (`px-6 py-3 border-t border-slate-700/40 text-xs text-slate-500`)

**`formatCellValue`:**
- `null/undefined` → `'-'`
- Number with `format === 'currency'` → `Intl.NumberFormat` USD
- Number with `format === 'percentage'` → `(v * 100).toFixed(1)%`
- Other numbers → `Intl.NumberFormat` en-US max 2 fraction digits
- Other → `String(value)`

**`AIReportTableList`:** Renders tables in `space-y-6`.

---

### `ReportNarrative`

Three optional sections, each conditionally rendered:

**Executive Summary:** `bg-slate-800/60 rounded-xl border border-slate-700/50 p-6`. `FileText` icon (cyan-400) + `"Executive Summary"` heading. Body: `text-sm text-slate-300 leading-relaxed whitespace-pre-wrap`.

**Key Insights:** Same card style. `Lightbulb` icon (amber-400) + `"Key Insights"` heading. Ordered list: each item has a numbered circle badge (`w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold`) + insight text.

**Recommendations:** Same card style. `Target` icon (emerald-400) + `"Recommendations"` heading. List: each item has a small dot (`w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2`) + recommendation text.

---

### `ScheduleReportModal`

Full-screen modal with `bg-black/60 backdrop-blur-sm` overlay. Dialog: `bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md`.

**Header:** `Calendar` icon in `bg-cyan-500/10 border border-cyan-500/20 rounded-xl w-10 h-10`. Title `"Schedule Report"` + subtitle `"Auto-generate on a recurring basis"`. `X` close button.

**Body (p-6 space-y-5):**
1. Report name display (label + truncated name)
2. Frequency selector: Each `CADENCE_OPTIONS` entry rendered as a full-width button (radio behavior). Selected: `bg-cyan-500/10 border-cyan-500/30 text-cyan-300`. Unselected: `bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600`. The 30-day option also has `ring-1 ring-cyan-500/10` and displays a `"Recommended"` badge (`text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20`).
3. `"Custom interval"` button. When selected, shows inline: `"Every"` + number input (w-20) + `"days"` label. Input: min=1, max=365.
4. Next run preview: `Clock` icon + `"Next report: {date}"`. Date computed as `now + selectedDays * 86400000`, displayed as `"Jan 1, 2026"` format.
5. Disclaimer: `"Reports are stored automatically. You will receive an in-app notification when each report is ready."` (text-xs text-slate-500)

**Footer:** Cancel (text) + `Schedule` (bg-cyan-600 hover:bg-cyan-500). Disabled when saving or when custom days invalid.

---

### `AIReportInsights` (Dashboard Widget)

**Used on:** Main dashboard page as a widget in the analytics grid.

Loads the 10 most recently completed reports, extracts `dashboard_cards` from each `result_json`, combines them, and shows up to 6 cards.

Widget container: `bg-slate-800 rounded-xl border border-slate-700`

**Header:** `px-5 py-4 border-b border-slate-700`. Left: `Sparkles` (cyan-400) + `"AI Report Insights"`. Right: `"View Reports"` link → navigates to `/reporting`. `ChevronRight` icon.

**Card grid:** `p-4 grid grid-cols-2 lg:grid-cols-3 gap-3`

Each card: `bg-slate-700/40 border border-slate-700/60 rounded-lg p-3 text-left hover:bg-slate-700/60 transition-colors group`
- Top row: `text-xs text-slate-400 truncate` title + trend icon (aligned right, only if `delta_pct != null`).
- Value: `text-lg font-bold text-white`
- Delta: `text-xs` with trend color (`text-emerald-400` up, `text-red-400` down, `text-slate-400` flat). Format: `+N.N%` or `-N.N%`.

Clicking a card navigates to `/reporting/{card.reportId}`.

Loading state: centered `Loader2` (slate-500, animate-spin) in a 32px-tall area.

Returns `null` (renders nothing) if no cards and not loading.

---

## Data Flow Summary

```
User enters prompt → handleGenerate()
  → generateReport() → POST /ai-report-generate
  → Returns { success, report_id }
  → showToast("Report generating")
  → pollReportStatus(report_id)
      polls getAIReportById every 3s
      max 60 attempts (3 min timeout)
    → on status=complete → navigate to /reporting/:id
    → on status=failed   → showToast error
    → on timeout         → throw error

/reporting/:id loads:
  → getAIReportById(id)
  → getReportVersions(id)      (all reports in parent-child chain)
  → getSchedulesByReportId(id) (active schedules for this report)
  → Renders: KPIs → Narrative → Charts → Tables → Data sources footer

Follow-up from report view:
  → generateReport(..., parent_report_id: currentReportId)
  → pollReportStatus()
  → navigate to new report

Follow-up from Full Chat:
  → Same generation flow
  → parentReportId tracks chain for session
  → "Start fresh" clears parentReportId
```

---

## Visual Design Tokens

| Token | Value |
|---|---|
| Page background | `bg-slate-900` |
| Card background | `bg-slate-800` or `bg-slate-800/60` |
| Card border | `border-slate-700` or `border-slate-700/50` |
| Primary accent | `cyan-400` / `cyan-500` |
| Gradient | `from-cyan-500 to-teal-500` |
| Success / up trend | `emerald-400` |
| Warning / down trend | `red-400` |
| Info / running | `amber-400` |
| Neutral text | `slate-300` |
| Muted text | `slate-400` / `slate-500` |
| Input background | `bg-slate-700` |
| Input border | `border-slate-600` |
| Focus ring | `focus:ring-2 focus:ring-cyan-500` |
| Hover row | `hover:bg-slate-700/50` |

---

## Permissions Seeding

Ensure these permission keys exist in the `permissions` table and are assigned to roles:

```sql
INSERT INTO permissions (key, module, description) VALUES
  ('reporting.view',     'reporting', 'View reports and report details'),
  ('reporting.ai.query', 'reporting', 'Generate new AI-powered reports')
ON CONFLICT (key) DO NOTHING;
```

Suggested role assignments:
- `reporting.view` → all roles (Staff, Manager, Admin, Super Admin)
- `reporting.ai.query` → Manager, Admin, Super Admin

Also ensure the `reporting` feature flag is enabled:
```sql
UPDATE feature_flags SET enabled = true WHERE key = 'reporting';
```
