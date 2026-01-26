/*
  # Optimize RLS Policies - Organizations and Departments

  Optimizes RLS policies to use `(select auth.uid())` pattern.

  1. Tables Updated
    - organizations
    - departments
    
  Note: roles and feature_flags are global tables without organization_id
*/

-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;

CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'organization.manage'
    )
  )
  WITH CHECK (
    id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

-- ============================================
-- DEPARTMENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view departments in their org" ON departments;
DROP POLICY IF EXISTS "Users can view departments in their organization" ON departments;
DROP POLICY IF EXISTS "Admins can manage departments" ON departments;
DROP POLICY IF EXISTS "Admins can manage departments in their org" ON departments;
DROP POLICY IF EXISTS "Admins can update departments in their org" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments in their org" ON departments;

CREATE POLICY "Users can view departments in their org"
  ON departments FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can insert departments in their org"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'users.manage'
    )
  );

CREATE POLICY "Admins can update departments in their org"
  ON departments FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'users.manage'
    )
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can delete departments in their org"
  ON departments FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'users.manage'
    )
  );
