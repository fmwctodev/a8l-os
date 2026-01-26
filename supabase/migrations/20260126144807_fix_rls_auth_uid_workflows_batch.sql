/*
  # Fix RLS auth.uid() Performance - Workflows Batch
  
  This migration optimizes RLS policies for workflow tables.
  
  ## Tables Fixed
  - workflow_goals, workflow_logs (org_id/organization_id)
  - workflow_scheduled_triggers, workflow_webhook_triggers (org_id)
  - workflow_scheduled_trigger_runs, workflow_webhook_requests (org_id)
  - workflow_trigger_audit_log, scheduled_trigger_jobs (org_id)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- workflow_goals (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view workflow goals in their org" ON workflow_goals;
DROP POLICY IF EXISTS "Users with workflow permission can update workflow goals" ON workflow_goals;
DROP POLICY IF EXISTS "Users with workflow permission can delete workflow goals" ON workflow_goals;

CREATE POLICY "Users can view workflow goals in their org"
  ON workflow_goals FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert workflow goals"
  ON workflow_goals FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with workflow permission can update workflow goals"
  ON workflow_goals FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with workflow permission can delete workflow goals"
  ON workflow_goals FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- workflow_logs (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view their organization's workflow logs" ON workflow_logs;
DROP POLICY IF EXISTS "Users can insert workflow logs for their organization" ON workflow_logs;

CREATE POLICY "Users can view their organization's workflow logs"
  ON workflow_logs FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can insert workflow logs for their organization"
  ON workflow_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

-- ============================================
-- workflow_scheduled_triggers (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view scheduled triggers in their org" ON workflow_scheduled_triggers;
DROP POLICY IF EXISTS "Users with automation.manage can create scheduled triggers" ON workflow_scheduled_triggers;
DROP POLICY IF EXISTS "Users with automation.manage can update scheduled triggers" ON workflow_scheduled_triggers;
DROP POLICY IF EXISTS "Users with automation.manage can delete scheduled triggers" ON workflow_scheduled_triggers;

CREATE POLICY "Users can view scheduled triggers in their org"
  ON workflow_scheduled_triggers FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users with automation.manage can create scheduled triggers"
  ON workflow_scheduled_triggers FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with automation.manage can update scheduled triggers"
  ON workflow_scheduled_triggers FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with automation.manage can delete scheduled triggers"
  ON workflow_scheduled_triggers FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- workflow_webhook_triggers (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view webhook triggers in their org" ON workflow_webhook_triggers;
DROP POLICY IF EXISTS "Users with automation.manage can create webhook triggers" ON workflow_webhook_triggers;
DROP POLICY IF EXISTS "Users with automation.manage can update webhook triggers" ON workflow_webhook_triggers;
DROP POLICY IF EXISTS "Users with automation.manage can delete webhook triggers" ON workflow_webhook_triggers;

CREATE POLICY "Users can view webhook triggers in their org"
  ON workflow_webhook_triggers FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users with automation.manage can create webhook triggers"
  ON workflow_webhook_triggers FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with automation.manage can update webhook triggers"
  ON workflow_webhook_triggers FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with automation.manage can delete webhook triggers"
  ON workflow_webhook_triggers FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- workflow_scheduled_trigger_runs (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view scheduled trigger runs in their org" ON workflow_scheduled_trigger_runs;

CREATE POLICY "Users can view scheduled trigger runs in their org"
  ON workflow_scheduled_trigger_runs FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "System can insert scheduled trigger runs"
  ON workflow_scheduled_trigger_runs FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- workflow_webhook_requests (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view webhook requests in their org" ON workflow_webhook_requests;

CREATE POLICY "Users can view webhook requests in their org"
  ON workflow_webhook_requests FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "System can insert webhook requests"
  ON workflow_webhook_requests FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- workflow_trigger_audit_log (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view trigger audit logs in their org" ON workflow_trigger_audit_log;
DROP POLICY IF EXISTS "Users can create trigger audit logs in their org" ON workflow_trigger_audit_log;

CREATE POLICY "Users can view trigger audit logs in their org"
  ON workflow_trigger_audit_log FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create trigger audit logs in their org"
  ON workflow_trigger_audit_log FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- scheduled_trigger_jobs (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view scheduled jobs in their org" ON scheduled_trigger_jobs;
DROP POLICY IF EXISTS "Users can create scheduled jobs in their org" ON scheduled_trigger_jobs;
DROP POLICY IF EXISTS "Users can update scheduled jobs in their org" ON scheduled_trigger_jobs;
DROP POLICY IF EXISTS "Users can delete scheduled jobs in their org" ON scheduled_trigger_jobs;

CREATE POLICY "Users can view scheduled jobs in their org"
  ON scheduled_trigger_jobs FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create scheduled jobs in their org"
  ON scheduled_trigger_jobs FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update scheduled jobs in their org"
  ON scheduled_trigger_jobs FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete scheduled jobs in their org"
  ON scheduled_trigger_jobs FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());
