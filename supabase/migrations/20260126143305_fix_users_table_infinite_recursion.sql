/*
  # Fix Users Table Infinite Recursion
  
  1. Problem
    - Users table RLS policies query the users table itself to check organization membership
    - This causes infinite recursion when trying to SELECT from users
  
  2. Solution
    - Create a SECURITY DEFINER function to get user's org_id without triggering RLS
    - Update policies to use this function instead of subquerying users table
  
  3. Security
    - Function only returns org_id for the authenticated user
    - Does not expose any other user data
*/

-- Create a SECURITY DEFINER function to get user's organization_id without triggering RLS
CREATE OR REPLACE FUNCTION get_auth_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view users in their org" ON users;
DROP POLICY IF EXISTS "Admins can update users in their org" ON users;
DROP POLICY IF EXISTS "Admins can insert users in their org" ON users;

-- Recreate policies using the helper function instead of self-referencing subquery
CREATE POLICY "Users can view users in their org" ON users
  FOR SELECT TO authenticated
  USING (
    id = (select auth.uid())
    OR organization_id = get_auth_user_org_id()
  );

CREATE POLICY "Admins can update users in their org" ON users
  FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid())
    OR (
      organization_id = get_auth_user_org_id()
      AND EXISTS (
        SELECT 1 FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = (SELECT role_id FROM users WHERE id = (select auth.uid()))
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
      WHERE rp.role_id = (SELECT role_id FROM users WHERE id = (select auth.uid()))
      AND p.key = 'users.manage'
    )
  );
