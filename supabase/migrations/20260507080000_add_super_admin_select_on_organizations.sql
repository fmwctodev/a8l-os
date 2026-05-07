/*
  # Add SuperAdmin bypass to organizations SELECT/UPDATE

  ## Why

  The org switcher (`OrgSwitcher.tsx`) queries
  `from('organizations').select('id, name, slug, ...')` to populate
  the dropdown. RLS only let users see their HOME org, so SuperAdmin
  saw a one-item list — could never switch to BuilderLync.

  Original `organizations` SELECT policy:
    USING (id = get_auth_user_org_id())

  No SuperAdmin bypass existed despite the original migration's
  comments claiming there was one.

  ## Fix

  Add a `SuperAdmin can view all organizations` SELECT policy
  (`USING (is_super_admin())`) that OR-combines with the existing
  per-user policy. SuperAdmin sees all orgs; regular users still see
  only their home org.

  Also add `SuperAdmin can update all organizations` UPDATE policy
  for future settings UI work.
*/

DROP POLICY IF EXISTS "SuperAdmin can view all organizations" ON organizations;
CREATE POLICY "SuperAdmin can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS "SuperAdmin can update all organizations" ON organizations;
CREATE POLICY "SuperAdmin can update all organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
