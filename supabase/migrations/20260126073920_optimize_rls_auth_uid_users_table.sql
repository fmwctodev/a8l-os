/*
  # Optimize RLS Policies - Users Table

  This migration optimizes RLS policies on the users table to use the 
  `(select auth.uid())` pattern instead of raw `auth.uid()` calls.
  
  This optimization prevents re-evaluation of auth.uid() for each row,
  significantly improving query performance.

  1. Policies Updated
    - Users can view own profile data
    - Users can view users in their org
    - Users can update own profile data
    - Users can update their own profile
    - Admins can insert users in their org
    - Admins can update users in their org
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile data" ON users;
DROP POLICY IF EXISTS "Users can view users in their org" ON users;
DROP POLICY IF EXISTS "Users can update own profile data" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can insert users in their org" ON users;
DROP POLICY IF EXISTS "Admins can update users in their org" ON users;

-- Recreate with optimized auth.uid() calls
CREATE POLICY "Users can view own profile data"
  ON users FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Users can view users in their org"
  ON users FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM users WHERE id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own profile data"
  ON users FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Admins can insert users in their org"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM users WHERE id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'users.manage'
    )
  );

CREATE POLICY "Admins can update users in their org"
  ON users FOR UPDATE
  TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM users WHERE id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'users.manage'
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM users WHERE id = (select auth.uid())
    )
  );
