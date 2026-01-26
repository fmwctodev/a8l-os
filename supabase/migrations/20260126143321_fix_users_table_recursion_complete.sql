/*
  # Complete Fix for Users Table Recursion
  
  1. Problem
    - Previous fix still had self-referencing query for role_id
  
  2. Solution
    - Create additional SECURITY DEFINER function to get user's role_id
    - Update policies to use both helper functions
*/

-- Create a SECURITY DEFINER function to get user's role_id without triggering RLS
CREATE OR REPLACE FUNCTION get_auth_user_role_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role_id FROM users WHERE id = auth.uid()
$$;

-- Drop and recreate policies using the helper functions
DROP POLICY IF EXISTS "Admins can update users in their org" ON users;
DROP POLICY IF EXISTS "Admins can insert users in their org" ON users;

CREATE POLICY "Admins can update users in their org" ON users
  FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid())
    OR (
      organization_id = get_auth_user_org_id()
      AND EXISTS (
        SELECT 1 FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = get_auth_user_role_id()
        AND p.key = 'users.manage'
      )
    )
  )
  WITH CHECK (
    id = (select auth.uid())
    OR organization_id = get_auth_user_org_id()
  );

CREATE POLICY "Admins can insert users in their org" ON users
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'users.manage'
    )
  );
