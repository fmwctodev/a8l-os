/*
  # Create AI Reports and Schedules Module

  1. New Tables
    - `ai_reports` - AI-generated report storage with full payloads
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `created_by_user_id` (uuid, FK to users)
      - `scope` (text: my/team/org)
      - `report_category` (text: sales/marketing/ops/reputation/finance/projects/custom)
      - `report_name` (text)
      - `timeframe_start`, `timeframe_end` (timestamptz)
      - `status` (text: running/complete/failed)
      - `plan_json` (jsonb - validated report_plan)
      - `result_json` (jsonb - full report_compose payload)
      - `rendered_html` (text - for PDF generation)
      - `csv_data` (text - generated CSV content)
      - `parent_report_id` (uuid, nullable self-ref for follow-up versions)
      - `prompt` (text - original user request)
      - `data_sources_used` (text[])
      - `filters_applied` (jsonb)
      - `error_message` (text)
      - `delete_at` (timestamptz - created_at + 2 years auto-retention)

    - `ai_report_schedules` - Scheduled recurring AI reports
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK)
      - `user_id` (uuid, FK)
      - `report_plan_template_json` (jsonb)
      - `cadence_days` (integer, default 30)
      - `next_run_at`, `last_run_at` (timestamptz)
      - `is_active` (boolean)
      - `report_name_template`, `prompt_template` (text)
      - `scope` (text)

  2. Security
    - RLS enabled on both tables
    - ai_reports: scope-based visibility (my=creator, team=dept, org=all), admins see all
    - ai_report_schedules: creator and admins only

  3. Indexes
    - Optimized for listing, filtering, and retention cleanup

  4. Retention
    - cleanup_expired_ai_reports() for 2-year auto-deletion
*/

CREATE TABLE IF NOT EXISTS ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'my' CHECK (scope IN ('my', 'team', 'org')),
  report_category text NOT NULL DEFAULT 'custom' CHECK (report_category IN ('sales', 'marketing', 'ops', 'reputation', 'finance', 'projects', 'custom')),
  report_name text NOT NULL,
  timeframe_start timestamptz,
  timeframe_end timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
  plan_json jsonb,
  result_json jsonb,
  rendered_html text,
  csv_data text,
  parent_report_id uuid REFERENCES ai_reports(id) ON DELETE SET NULL,
  prompt text NOT NULL DEFAULT '',
  data_sources_used text[] DEFAULT '{}',
  filters_applied jsonb DEFAULT '{}',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delete_at timestamptz NOT NULL DEFAULT (now() + interval '2 years')
);

ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_reports_org_created ON ai_reports(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_reports_status ON ai_reports(status);
CREATE INDEX IF NOT EXISTS idx_ai_reports_category ON ai_reports(report_category);
CREATE INDEX IF NOT EXISTS idx_ai_reports_delete_at ON ai_reports(delete_at);
CREATE INDEX IF NOT EXISTS idx_ai_reports_parent ON ai_reports(parent_report_id);

CREATE TABLE IF NOT EXISTS ai_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_plan_template_json jsonb NOT NULL DEFAULT '{}',
  original_report_id uuid REFERENCES ai_reports(id) ON DELETE SET NULL,
  cadence_days integer NOT NULL DEFAULT 30,
  next_run_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  last_run_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  report_name_template text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT 'my' CHECK (scope IN ('my', 'team', 'org')),
  prompt_template text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_report_schedules_org_next ON ai_report_schedules(organization_id, next_run_at) WHERE is_active = true;

-- RLS Policies for ai_reports

CREATE POLICY "Users can view reports based on scope"
  ON ai_reports FOR SELECT
  TO authenticated
  USING (
    organization_id = get_auth_user_org_id()
    AND (
      scope = 'org'
      OR (scope = 'my' AND created_by_user_id = auth.uid())
      OR (scope = 'team' AND (
        created_by_user_id = auth.uid()
        OR get_user_role_name() IN ('Super Admin', 'Admin')
        OR get_user_department_id() = (SELECT department_id FROM users WHERE id = ai_reports.created_by_user_id)
      ))
      OR get_user_role_name() IN ('Super Admin', 'Admin')
    )
  );

CREATE POLICY "Users can create reports in own org"
  ON ai_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_auth_user_org_id()
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Creator and admins can update reports"
  ON ai_reports FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_auth_user_org_id()
    AND (
      created_by_user_id = auth.uid()
      OR get_user_role_name() IN ('Super Admin', 'Admin')
    )
  )
  WITH CHECK (
    organization_id = get_auth_user_org_id()
    AND (
      created_by_user_id = auth.uid()
      OR get_user_role_name() IN ('Super Admin', 'Admin')
    )
  );

CREATE POLICY "Creator and admins can delete reports"
  ON ai_reports FOR DELETE
  TO authenticated
  USING (
    organization_id = get_auth_user_org_id()
    AND (
      created_by_user_id = auth.uid()
      OR get_user_role_name() IN ('Super Admin', 'Admin')
    )
  );

-- RLS Policies for ai_report_schedules

CREATE POLICY "Creator and admins can view schedules"
  ON ai_report_schedules FOR SELECT
  TO authenticated
  USING (
    organization_id = get_auth_user_org_id()
    AND (
      user_id = auth.uid()
      OR get_user_role_name() IN ('Super Admin', 'Admin')
    )
  );

CREATE POLICY "Users can create schedules in own org"
  ON ai_report_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_auth_user_org_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Creator and admins can update schedules"
  ON ai_report_schedules FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_auth_user_org_id()
    AND (
      user_id = auth.uid()
      OR get_user_role_name() IN ('Super Admin', 'Admin')
    )
  )
  WITH CHECK (
    organization_id = get_auth_user_org_id()
    AND (
      user_id = auth.uid()
      OR get_user_role_name() IN ('Super Admin', 'Admin')
    )
  );

CREATE POLICY "Creator and admins can delete schedules"
  ON ai_report_schedules FOR DELETE
  TO authenticated
  USING (
    organization_id = get_auth_user_org_id()
    AND (
      user_id = auth.uid()
      OR get_user_role_name() IN ('Super Admin', 'Admin')
    )
  );

-- Retention cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_ai_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM ai_reports WHERE delete_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
