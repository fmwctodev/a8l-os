/*
  # users RLS: self-view + SuperAdmin cross-org SELECT

  ## Why

  The `users` SELECT policy is:
    USING (organization_id = get_auth_user_org_id())

  After the org-resolution helper unification (20260507090000),
  `get_auth_user_org_id()` returns the user's ACTIVE org (honoring
  `super_admin_active_org_id`). This broke a SuperAdmin who pivoted
  their active org away from home: they could no longer see their
  OWN user row, because their row lives in their HOME org.

  Symptom: `getCurrentUser()` returns null, AuthContext sits on the
  loading spinner forever, the app appears frozen post-sign-in.

  ## Fix

  Add two SELECT policies that OR-combine with the existing one:
    1. "Users can view their own row" — anyone can read their own
       user row regardless of active org.
    2. "SuperAdmin can view all users" — SuperAdmin reads any user
       row (needed for the future cross-org user management UI).

  Regular non-SuperAdmin users are unaffected: their active org is
  always equal to their home org, so the existing policy already
  matches their own row.

  ## Also

  Resets `sean@autom8ionlab.com`'s `super_admin_active_org_id` to
  NULL — they got stuck pivoted to BuilderLync before this fix
  landed. NULL → defaults to home org on next sign-in.
*/

DROP POLICY IF EXISTS "Users can view their own row" ON users;
CREATE POLICY "Users can view their own row"
  ON users FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "SuperAdmin can view all users" ON users;
CREATE POLICY "SuperAdmin can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (is_super_admin());

UPDATE users SET super_admin_active_org_id = NULL
WHERE email = 'sean@autom8ionlab.com';
