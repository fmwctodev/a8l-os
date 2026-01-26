/*
  # Fix RLS Auth Function Performance - Custom Values Batch
  
  1. Problem
    - RLS policies using auth.uid() re-evaluate for each row
    - Wrapping in (select auth.uid()) evaluates once per query
  
  2. Tables Fixed
    - custom_value_categories (org_id)
    - custom_values (org_id)
    - custom_field_groups (organization_id)
    - contact_notes (user_id)
    - contact_tasks (created_by_user_id, assigned_to_user_id)
    - gmail_oauth_tokens (user_id)
*/

-- custom_value_categories policies
DROP POLICY IF EXISTS "Admins can create custom value categories" ON custom_value_categories;
DROP POLICY IF EXISTS "Admins can delete custom value categories" ON custom_value_categories;
DROP POLICY IF EXISTS "Admins can update custom value categories" ON custom_value_categories;
DROP POLICY IF EXISTS "Org members can view custom value categories" ON custom_value_categories;

CREATE POLICY "Admins can create custom value categories" ON custom_value_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'custom_values.manage'
    )
  );

CREATE POLICY "Admins can delete custom value categories" ON custom_value_categories
  FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'custom_values.manage'
    )
  );

CREATE POLICY "Admins can update custom value categories" ON custom_value_categories
  FOR UPDATE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'custom_values.manage'
    )
  )
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Org members can view custom value categories" ON custom_value_categories
  FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

-- custom_values policies
DROP POLICY IF EXISTS "Admins can create custom values" ON custom_values;
DROP POLICY IF EXISTS "Admins can delete custom values" ON custom_values;
DROP POLICY IF EXISTS "Admins can update custom values" ON custom_values;
DROP POLICY IF EXISTS "Org members can view custom values" ON custom_values;

CREATE POLICY "Admins can create custom values" ON custom_values
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'custom_values.manage'
    )
  );

CREATE POLICY "Admins can delete custom values" ON custom_values
  FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'custom_values.manage'
    )
  );

CREATE POLICY "Admins can update custom values" ON custom_values
  FOR UPDATE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'custom_values.manage'
    )
  )
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Org members can view custom values" ON custom_values
  FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

-- custom_field_groups policies
DROP POLICY IF EXISTS "Org members can view custom field groups" ON custom_field_groups;
DROP POLICY IF EXISTS "Users with custom_fields.manage can create groups" ON custom_field_groups;
DROP POLICY IF EXISTS "Users with custom_fields.manage can delete groups" ON custom_field_groups;
DROP POLICY IF EXISTS "Users with custom_fields.manage can update groups" ON custom_field_groups;

CREATE POLICY "Org members can view custom field groups" ON custom_field_groups
  FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with custom_fields.manage can create groups" ON custom_field_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'custom_fields.manage'
    )
  );

CREATE POLICY "Users with custom_fields.manage can delete groups" ON custom_field_groups
  FOR DELETE TO authenticated
  USING (
    organization_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'custom_fields.manage'
    )
  );

CREATE POLICY "Users with custom_fields.manage can update groups" ON custom_field_groups
  FOR UPDATE TO authenticated
  USING (
    organization_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'custom_fields.manage'
    )
  )
  WITH CHECK (organization_id = get_auth_user_org_id());

-- contact_notes policies
DROP POLICY IF EXISTS "Users can delete their own notes or admins can delete any" ON contact_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON contact_notes;
DROP POLICY IF EXISTS "Users with edit permission can create notes" ON contact_notes;

CREATE POLICY "Users can delete their own notes or admins can delete any" ON contact_notes
  FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'contacts.manage'
    )
  );

CREATE POLICY "Users can update their own notes" ON contact_notes
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users with edit permission can create notes" ON contact_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key IN ('contacts.edit', 'contacts.manage')
    )
  );

-- contact_tasks policies
DROP POLICY IF EXISTS "Users can delete tasks they created or admins can delete any" ON contact_tasks;
DROP POLICY IF EXISTS "Users can update tasks they created or are assigned to" ON contact_tasks;
DROP POLICY IF EXISTS "Users with edit permission can create tasks" ON contact_tasks;

CREATE POLICY "Users can delete tasks they created or admins can delete any" ON contact_tasks
  FOR DELETE TO authenticated
  USING (
    created_by_user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'contacts.manage'
    )
  );

CREATE POLICY "Users can update tasks they created or are assigned to" ON contact_tasks
  FOR UPDATE TO authenticated
  USING (
    created_by_user_id = (select auth.uid())
    OR assigned_to_user_id = (select auth.uid())
  )
  WITH CHECK (
    created_by_user_id = (select auth.uid())
    OR assigned_to_user_id = (select auth.uid())
  );

CREATE POLICY "Users with edit permission can create tasks" ON contact_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key IN ('contacts.edit', 'contacts.manage')
    )
  );

-- gmail_oauth_tokens policies
DROP POLICY IF EXISTS "Users can create their own Gmail tokens" ON gmail_oauth_tokens;

CREATE POLICY "Users can create their own Gmail tokens" ON gmail_oauth_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND organization_id = get_auth_user_org_id()
  );
