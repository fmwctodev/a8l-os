/*
  # Fix RLS auth.uid() Performance - Orgs, Departments, Users Batch
  
  This migration optimizes RLS policies for organization-level tables.
  
  ## Tables Fixed
  - organizations
  - departments (organization_id)
  - users (organization_id) - using helper functions to avoid recursion
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- organizations
-- ============================================
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;

CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT TO authenticated
  USING (id = get_auth_user_org_id());

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE TO authenticated
  USING (id = get_auth_user_org_id())
  WITH CHECK (id = get_auth_user_org_id());

-- ============================================
-- departments (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view departments in their org" ON departments;
DROP POLICY IF EXISTS "Admins can insert departments in their org" ON departments;
DROP POLICY IF EXISTS "Admins can update departments in their org" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments in their org" ON departments;

CREATE POLICY "Users can view departments in their org"
  ON departments FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert departments in their org"
  ON departments FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Admins can update departments in their org"
  ON departments FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete departments in their org"
  ON departments FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- users (organization_id) - using helper functions
-- ============================================
DROP POLICY IF EXISTS "Users can view users in their org" ON users;
DROP POLICY IF EXISTS "Users can view own profile data" ON users;
DROP POLICY IF EXISTS "Users can update own profile data" ON users;
DROP POLICY IF EXISTS "Admins can update users in their org" ON users;

CREATE POLICY "Users can view users in their org"
  ON users FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update own profile data"
  ON users FOR UPDATE TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));
