/*
  # Fix RLS auth.uid() Performance - Reports Batch
  
  This migration optimizes RLS policies for reporting tables.
  
  ## Tables Fixed
  - reports, report_runs, report_schedules, report_exports, report_email_queue (organization_id)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
  - Note: report_runs.triggered_by is text type, needs cast
*/

-- ============================================
-- reports (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view reports in their org" ON reports;
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can delete their own reports" ON reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON reports;

CREATE POLICY "Users can view reports in their org"
  ON reports FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create reports"
  ON reports FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can update their own reports"
  ON reports FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can delete their own reports"
  ON reports FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

-- ============================================
-- report_runs (organization_id, triggered_by is TEXT)
-- ============================================
DROP POLICY IF EXISTS "Users can view report runs in their org" ON report_runs;
DROP POLICY IF EXISTS "Users can create report runs for accessible reports" ON report_runs;
DROP POLICY IF EXISTS "Users can update report runs they created" ON report_runs;

CREATE POLICY "Users can view report runs in their org"
  ON report_runs FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create report runs for accessible reports"
  ON report_runs FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND triggered_by = (select auth.uid())::text);

CREATE POLICY "Users can update report runs they created"
  ON report_runs FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND triggered_by = (select auth.uid())::text)
  WITH CHECK (organization_id = get_auth_user_org_id() AND triggered_by = (select auth.uid())::text);

-- ============================================
-- report_schedules (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view report schedules in their org" ON report_schedules;
DROP POLICY IF EXISTS "Users can create schedules for their reports" ON report_schedules;
DROP POLICY IF EXISTS "Users can update their own schedules" ON report_schedules;
DROP POLICY IF EXISTS "Users can delete their own schedules" ON report_schedules;

CREATE POLICY "Users can view report schedules in their org"
  ON report_schedules FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create schedules for their reports"
  ON report_schedules FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can update their own schedules"
  ON report_schedules FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can delete their own schedules"
  ON report_schedules FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

-- ============================================
-- report_exports (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view report exports in their org" ON report_exports;
DROP POLICY IF EXISTS "Users can create exports for accessible report runs" ON report_exports;

CREATE POLICY "Users can view report exports in their org"
  ON report_exports FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create exports for accessible report runs"
  ON report_exports FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

-- ============================================
-- report_email_queue (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view email queue for their schedules" ON report_email_queue;
DROP POLICY IF EXISTS "System can insert email queue entries" ON report_email_queue;
DROP POLICY IF EXISTS "System can update email queue entries" ON report_email_queue;

CREATE POLICY "Users can view email queue for their schedules"
  ON report_email_queue FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "System can insert email queue entries"
  ON report_email_queue FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "System can update email queue entries"
  ON report_email_queue FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());
