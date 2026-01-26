/*
  # Fix RLS Auth Function Performance - Opportunities Batch
  
  1. Problem
    - RLS policies using auth.uid() re-evaluate for each row
    - Wrapping in (select auth.uid()) evaluates once per query
  
  2. Tables Fixed
    - pipelines (org_id)
    - pipeline_stages (org_id)
    - pipeline_custom_fields (org_id)
    - opportunities (org_id, assigned_user_id)
    - opportunity_custom_field_values (org_id)
    - opportunity_notes (org_id, created_by)
    - opportunity_timeline_events (org_id)
*/

-- pipelines policies
DROP POLICY IF EXISTS "Admins can create pipelines" ON pipelines;
DROP POLICY IF EXISTS "Admins can delete pipelines" ON pipelines;
DROP POLICY IF EXISTS "Admins can update pipelines" ON pipelines;

CREATE POLICY "Admins can create pipelines" ON pipelines
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'opportunities.manage'
    )
  );

CREATE POLICY "Admins can delete pipelines" ON pipelines
  FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'opportunities.manage'
    )
  );

CREATE POLICY "Admins can update pipelines" ON pipelines
  FOR UPDATE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'opportunities.manage'
    )
  )
  WITH CHECK (org_id = get_auth_user_org_id());

-- pipeline_stages policies
DROP POLICY IF EXISTS "Admins can create stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Admins can delete stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Admins can update stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can view stages for accessible pipelines" ON pipeline_stages;

CREATE POLICY "Admins can create stages" ON pipeline_stages
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'opportunities.manage'
    )
  );

CREATE POLICY "Admins can delete stages" ON pipeline_stages
  FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'opportunities.manage'
    )
  );

CREATE POLICY "Admins can update stages" ON pipeline_stages
  FOR UPDATE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'opportunities.manage'
    )
  )
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can view stages for accessible pipelines" ON pipeline_stages
  FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

-- pipeline_custom_fields policies
DROP POLICY IF EXISTS "Admins can create custom fields" ON pipeline_custom_fields;
DROP POLICY IF EXISTS "Admins can delete custom fields" ON pipeline_custom_fields;
DROP POLICY IF EXISTS "Admins can update custom fields" ON pipeline_custom_fields;
DROP POLICY IF EXISTS "Users can view custom fields for accessible pipelines" ON pipeline_custom_fields;

CREATE POLICY "Admins can create custom fields" ON pipeline_custom_fields
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'opportunities.manage'
    )
  );

CREATE POLICY "Admins can delete custom fields" ON pipeline_custom_fields
  FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'opportunities.manage'
    )
  );

CREATE POLICY "Admins can update custom fields" ON pipeline_custom_fields
  FOR UPDATE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'opportunities.manage'
    )
  )
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can view custom fields for accessible pipelines" ON pipeline_custom_fields
  FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

-- opportunities policies
DROP POLICY IF EXISTS "Admins can delete opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can create opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can update opportunities in their scope" ON opportunities;
DROP POLICY IF EXISTS "Users can view opportunities in their scope" ON opportunities;

CREATE POLICY "Admins can delete opportunities" ON opportunities
  FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'opportunities.manage'
    )
  );

CREATE POLICY "Users can create opportunities" ON opportunities
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update opportunities in their scope" ON opportunities
  FOR UPDATE TO authenticated
  USING (
    assigned_user_id = (select auth.uid())
    OR org_id = get_auth_user_org_id()
  )
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can view opportunities in their scope" ON opportunities
  FOR SELECT TO authenticated
  USING (
    assigned_user_id = (select auth.uid())
    OR org_id = get_auth_user_org_id()
  );

-- opportunity_custom_field_values policies
DROP POLICY IF EXISTS "Users can create custom field values" ON opportunity_custom_field_values;
DROP POLICY IF EXISTS "Users can delete custom field values" ON opportunity_custom_field_values;
DROP POLICY IF EXISTS "Users can update custom field values" ON opportunity_custom_field_values;
DROP POLICY IF EXISTS "Users can view custom field values for accessible opportunities" ON opportunity_custom_field_values;

CREATE POLICY "Users can create custom field values" ON opportunity_custom_field_values
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete custom field values" ON opportunity_custom_field_values
  FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update custom field values" ON opportunity_custom_field_values
  FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can view custom field values for accessible opportunities" ON opportunity_custom_field_values
  FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

-- opportunity_notes policies
DROP POLICY IF EXISTS "Users can create notes on accessible opportunities" ON opportunity_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON opportunity_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON opportunity_notes;
DROP POLICY IF EXISTS "Users can view notes for accessible opportunities" ON opportunity_notes;

CREATE POLICY "Users can create notes on accessible opportunities" ON opportunity_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND created_by = (select auth.uid())
  );

CREATE POLICY "Users can delete their own notes" ON opportunity_notes
  FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()));

CREATE POLICY "Users can update their own notes" ON opportunity_notes
  FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Users can view notes for accessible opportunities" ON opportunity_notes
  FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

-- opportunity_timeline_events policies
DROP POLICY IF EXISTS "System can create timeline events" ON opportunity_timeline_events;
DROP POLICY IF EXISTS "Users can view timeline for accessible opportunities" ON opportunity_timeline_events;

CREATE POLICY "System can create timeline events" ON opportunity_timeline_events
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can view timeline for accessible opportunities" ON opportunity_timeline_events
  FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());
