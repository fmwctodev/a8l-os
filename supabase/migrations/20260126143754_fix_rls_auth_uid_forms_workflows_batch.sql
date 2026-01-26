/*
  # Fix RLS Auth Function Performance - Forms and Workflows Batch
  
  1. Problem
    - RLS policies using auth.uid() re-evaluate for each row
    - Wrapping in (select auth.uid()) evaluates once per query
  
  2. Tables Fixed
    - forms (organization_id)
    - surveys (organization_id)
    - workflow_goals (org_id)
    - workflow_action_retries (org_id)
    - workflow_loops (org_id)
    - workflow_condition_waits (org_id)
    - opportunity_stage_history (org_id)
*/

-- forms policies
DROP POLICY IF EXISTS "Users with manage permission can create forms" ON forms;

CREATE POLICY "Users with manage permission can create forms" ON forms
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'marketing.forms.manage'
    )
  );

-- surveys policies
DROP POLICY IF EXISTS "Users with manage permission can create surveys" ON surveys;

CREATE POLICY "Users with manage permission can create surveys" ON surveys
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'marketing.surveys.manage'
    )
  );

-- workflow_goals policies
DROP POLICY IF EXISTS "Users with workflow permission can insert workflow goals" ON workflow_goals;

CREATE POLICY "Users with workflow permission can insert workflow goals" ON workflow_goals
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'automation.manage'
    )
  );

-- workflow_action_retries policies
DROP POLICY IF EXISTS "Users with workflow permission can insert workflow action retri" ON workflow_action_retries;

CREATE POLICY "Users with workflow permission can insert workflow action retri" ON workflow_action_retries
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'automation.manage'
    )
  );

-- workflow_loops policies
DROP POLICY IF EXISTS "Users with workflow permission can insert workflow loops" ON workflow_loops;

CREATE POLICY "Users with workflow permission can insert workflow loops" ON workflow_loops
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'automation.manage'
    )
  );

-- workflow_condition_waits policies
DROP POLICY IF EXISTS "Users with workflow permission can insert workflow condition wa" ON workflow_condition_waits;

CREATE POLICY "Users with workflow permission can insert workflow condition wa" ON workflow_condition_waits
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'automation.manage'
    )
  );

-- opportunity_stage_history policies
DROP POLICY IF EXISTS "Users can insert stage history in their org" ON opportunity_stage_history;
DROP POLICY IF EXISTS "Users can view their org stage history" ON opportunity_stage_history;

CREATE POLICY "Users can insert stage history in their org" ON opportunity_stage_history
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can view their org stage history" ON opportunity_stage_history
  FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());
