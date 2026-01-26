/*
  # Fix Workflow Trigger RLS Permission Names

  Updates the RLS helper function and policies to use correct permission names
  (automation.manage instead of automation:write).
*/

-- Update helper function to check automation permission by key
CREATE OR REPLACE FUNCTION has_automation_write_permission(check_user_id uuid, check_org_id uuid)
RETURNS boolean AS $$
DECLARE
  has_perm boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = check_user_id 
      AND u.org_id = check_org_id
      AND p.key = 'automation.manage'
  ) INTO has_perm;
  RETURN has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- FIX WORKFLOW SCHEDULED TRIGGERS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users with automation:write can create scheduled triggers" ON workflow_scheduled_triggers;
CREATE POLICY "Users with automation.manage can create scheduled triggers"
  ON workflow_scheduled_triggers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_write_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Users with automation:write can update scheduled triggers" ON workflow_scheduled_triggers;
CREATE POLICY "Users with automation.manage can update scheduled triggers"
  ON workflow_scheduled_triggers
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_write_permission(auth.uid(), org_id)
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_write_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Users with automation:write can delete scheduled triggers" ON workflow_scheduled_triggers;
CREATE POLICY "Users with automation.manage can delete scheduled triggers"
  ON workflow_scheduled_triggers
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_write_permission(auth.uid(), org_id)
  );

-- =====================================================
-- FIX WORKFLOW WEBHOOK TRIGGERS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users with automation:write can create webhook triggers" ON workflow_webhook_triggers;
CREATE POLICY "Users with automation.manage can create webhook triggers"
  ON workflow_webhook_triggers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_write_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Users with automation:write can update webhook triggers" ON workflow_webhook_triggers;
CREATE POLICY "Users with automation.manage can update webhook triggers"
  ON workflow_webhook_triggers
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_write_permission(auth.uid(), org_id)
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_write_permission(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Users with automation:write can delete webhook triggers" ON workflow_webhook_triggers;
CREATE POLICY "Users with automation.manage can delete webhook triggers"
  ON workflow_webhook_triggers
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND has_automation_write_permission(auth.uid(), org_id)
  );
