/*
  # Create Reporting Module RLS Policies

  This migration adds Row Level Security policies for all reporting tables.

  1. Security Model
    - Reports visibility: private (creator only), department (same dept), organization (all org users)
    - Report runs/exports/schedules inherit access from parent report
    - Email queue accessible by schedule owners and admins

  2. Policies Created
    - reports: SELECT, INSERT, UPDATE, DELETE with visibility-based access
    - report_runs: SELECT, INSERT based on report access
    - report_exports: SELECT, INSERT based on report run access
    - report_schedules: SELECT, INSERT, UPDATE, DELETE based on report access
    - report_email_queue: SELECT, INSERT based on schedule access
*/

-- Helper function to check report access
CREATE OR REPLACE FUNCTION user_can_access_report(report_row reports)
RETURNS boolean AS $$
DECLARE
  user_org_id uuid;
  user_dept_id uuid;
BEGIN
  SELECT organization_id, department_id INTO user_org_id, user_dept_id
  FROM users WHERE id = auth.uid();
  
  IF user_org_id != report_row.organization_id THEN
    RETURN false;
  END IF;
  
  IF report_row.visibility = 'organization' THEN
    RETURN true;
  ELSIF report_row.visibility = 'department' THEN
    RETURN report_row.department_id = user_dept_id OR report_row.created_by = auth.uid();
  ELSE
    RETURN report_row.created_by = auth.uid();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reports policies
CREATE POLICY "Users can view reports based on visibility"
  ON reports FOR SELECT
  TO authenticated
  USING (user_can_access_report(reports.*));

CREATE POLICY "Users can create reports in their organization"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own reports"
  ON reports FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Report runs policies
CREATE POLICY "Users can view report runs for accessible reports"
  ON report_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = report_runs.report_id
      AND user_can_access_report(r.*)
    )
  );

CREATE POLICY "Users can create report runs for accessible reports"
  ON report_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = report_runs.report_id
      AND user_can_access_report(r.*)
    )
  );

CREATE POLICY "Users can update report runs they created"
  ON report_runs FOR UPDATE
  TO authenticated
  USING (triggered_by_user_id = auth.uid() OR triggered_by = 'schedule')
  WITH CHECK (triggered_by_user_id = auth.uid() OR triggered_by = 'schedule');

-- Report exports policies
CREATE POLICY "Users can view exports for accessible report runs"
  ON report_exports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM report_runs rr
      JOIN reports r ON r.id = rr.report_id
      WHERE rr.id = report_exports.report_run_id
      AND user_can_access_report(r.*)
    )
  );

CREATE POLICY "Users can create exports for accessible report runs"
  ON report_exports FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM report_runs rr
      JOIN reports r ON r.id = rr.report_id
      WHERE rr.id = report_exports.report_run_id
      AND user_can_access_report(r.*)
    )
  );

CREATE POLICY "Users can update exports they have access to"
  ON report_exports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM report_runs rr
      JOIN reports r ON r.id = rr.report_id
      WHERE rr.id = report_exports.report_run_id
      AND user_can_access_report(r.*)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM report_runs rr
      JOIN reports r ON r.id = rr.report_id
      WHERE rr.id = report_exports.report_run_id
      AND user_can_access_report(r.*)
    )
  );

-- Report schedules policies
CREATE POLICY "Users can view schedules for accessible reports"
  ON report_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = report_schedules.report_id
      AND user_can_access_report(r.*)
    )
  );

CREATE POLICY "Users can create schedules for their reports"
  ON report_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = report_schedules.report_id
      AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own schedules"
  ON report_schedules FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own schedules"
  ON report_schedules FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Report email queue policies
CREATE POLICY "Users can view email queue for their schedules"
  ON report_email_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM report_schedules rs
      WHERE rs.id = report_email_queue.schedule_id
      AND rs.created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert email queue entries"
  ON report_email_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "System can update email queue entries"
  ON report_email_queue FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM report_schedules rs
      WHERE rs.id = report_email_queue.schedule_id
      AND rs.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM report_schedules rs
      WHERE rs.id = report_email_queue.schedule_id
      AND rs.created_by = auth.uid()
    )
  );