/*
  # Restore Missing Admin Update Users RLS Policy

  1. Problem
    - Migration 20260126144944 dropped the "Admins can update users in their org" policy
      but only recreated the self-update and org-view policies
    - This prevents Admin and SuperAdmin roles from editing other users' details

  2. Fix
    - Recreate the "Admins can update users in their org" UPDATE policy
    - Allows users with `users.manage` permission to update any user in their org
    - Uses helper functions to avoid RLS recursion

  3. Security
    - Policy restricted to authenticated users only
    - Checks organization membership via get_auth_user_org_id()
    - Checks users.manage permission via get_auth_user_role_id()
*/

CREATE POLICY "Admins can update users in their org" ON users
  FOR UPDATE TO authenticated
  USING (
    organization_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'users.manage'
    )
  )
  WITH CHECK (
    organization_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'users.manage'
    )
  );
