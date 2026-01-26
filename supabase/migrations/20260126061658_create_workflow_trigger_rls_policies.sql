/*
  # RLS Policies for Workflow Scheduled and Webhook Triggers

  This migration creates Row Level Security policies for the scheduled
  and webhook trigger tables, ensuring organization-scoped access.

  1. Scheduled Triggers Policies
    - SELECT: Users can view scheduled triggers in their organization
    - INSERT: Users with automation:write can create scheduled triggers
    - UPDATE: Users with automation:write can update scheduled triggers
    - DELETE: Users with automation:write can delete scheduled triggers

  2. Scheduled Trigger Runs Policies
    - SELECT: Users can view trigger runs in their organization
    - INSERT: Service role only (for processor function)

  3. Webhook Triggers Policies
    - SELECT: Users can view webhook triggers in their organization
    - INSERT: Users with automation:write can create webhook triggers
    - UPDATE: Users with automation:write can update webhook triggers
    - DELETE: Users with automation:write can delete webhook triggers

  4. Webhook Requests Policies
    - SELECT: Users can view webhook requests in their organization
    - INSERT: Service role only (for webhook receiver function)
*/

-- Helper function to check automation permission (if not exists)
CREATE OR REPLACE FUNCTION has_automation_permission(user_id uuid, org_id uuid, permission_name text)
RETURNS boolean AS $$
DECLARE
  has_perm boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = user_id 
      AND u.org_id = org_id
      AND p.name = permission_name
  ) INTO has_perm;
  RETURN has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- WORKFLOW SCHEDULED TRIGGERS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view scheduled triggers in their org" ON workflow_scheduled_triggers;
CREATE POLICY "Users can view scheduled triggers in their org"
  ON workflow_scheduled_triggers
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users with automation:write can create scheduled triggers" ON workflow_scheduled_triggers;
CREATE POLICY "Users with automation:write can create scheduled triggers"
  ON workflow_scheduled_triggers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_permission(auth.uid(), org_id, 'automation:write')
  );

DROP POLICY IF EXISTS "Users with automation:write can update scheduled triggers" ON workflow_scheduled_triggers;
CREATE POLICY "Users with automation:write can update scheduled triggers"
  ON workflow_scheduled_triggers
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_permission(auth.uid(), org_id, 'automation:write')
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_permission(auth.uid(), org_id, 'automation:write')
  );

DROP POLICY IF EXISTS "Users with automation:write can delete scheduled triggers" ON workflow_scheduled_triggers;
CREATE POLICY "Users with automation:write can delete scheduled triggers"
  ON workflow_scheduled_triggers
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_permission(auth.uid(), org_id, 'automation:write')
  );

-- =====================================================
-- WORKFLOW SCHEDULED TRIGGER RUNS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view scheduled trigger runs in their org" ON workflow_scheduled_trigger_runs;
CREATE POLICY "Users can view scheduled trigger runs in their org"
  ON workflow_scheduled_trigger_runs
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role can insert scheduled trigger runs" ON workflow_scheduled_trigger_runs;
CREATE POLICY "Service role can insert scheduled trigger runs"
  ON workflow_scheduled_trigger_runs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update scheduled trigger runs" ON workflow_scheduled_trigger_runs;
CREATE POLICY "Service role can update scheduled trigger runs"
  ON workflow_scheduled_trigger_runs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- WORKFLOW WEBHOOK TRIGGERS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view webhook triggers in their org" ON workflow_webhook_triggers;
CREATE POLICY "Users can view webhook triggers in their org"
  ON workflow_webhook_triggers
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users with automation:write can create webhook triggers" ON workflow_webhook_triggers;
CREATE POLICY "Users with automation:write can create webhook triggers"
  ON workflow_webhook_triggers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_permission(auth.uid(), org_id, 'automation:write')
  );

DROP POLICY IF EXISTS "Users with automation:write can update webhook triggers" ON workflow_webhook_triggers;
CREATE POLICY "Users with automation:write can update webhook triggers"
  ON workflow_webhook_triggers
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_permission(auth.uid(), org_id, 'automation:write')
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_permission(auth.uid(), org_id, 'automation:write')
  );

DROP POLICY IF EXISTS "Users with automation:write can delete webhook triggers" ON workflow_webhook_triggers;
CREATE POLICY "Users with automation:write can delete webhook triggers"
  ON workflow_webhook_triggers
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_permission(auth.uid(), org_id, 'automation:write')
  );

-- Service role needs full access for webhook processing
DROP POLICY IF EXISTS "Service role can manage webhook triggers" ON workflow_webhook_triggers;
CREATE POLICY "Service role can manage webhook triggers"
  ON workflow_webhook_triggers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- WORKFLOW WEBHOOK REQUESTS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view webhook requests in their org" ON workflow_webhook_requests;
CREATE POLICY "Users can view webhook requests in their org"
  ON workflow_webhook_requests
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role can insert webhook requests" ON workflow_webhook_requests;
CREATE POLICY "Service role can insert webhook requests"
  ON workflow_webhook_requests
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update webhook requests" ON workflow_webhook_requests;
CREATE POLICY "Service role can update webhook requests"
  ON workflow_webhook_requests
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
