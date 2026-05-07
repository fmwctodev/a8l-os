/*
  # Scope feature_flags SELECT to active org (no SuperAdmin bypass on read)

  ## Why

  After the multi-tenant migration, the SELECT policy on feature_flags
  let SuperAdmin see ALL rows. The current frontend collapses rows in
  JavaScript via `flags.find(f => f.key === key)`, which returns
  whichever row Postgres returned first when multiple rows exist for the
  same key (one global + one per-org override).

  Result: a SuperAdmin viewing the autom8ionlab tenant could see
  BuilderLync's `projects = false` override and conclude Projects was
  disabled — even though autom8ionlab globally has Projects enabled.

  ## Fix

  Drop the SuperAdmin SELECT bypass. SELECT now returns only rows for
  the user's *active* org (via `get_user_org_id()`, which honors
  `super_admin_active_org_id`). SuperAdmin still has full write access
  through dedicated INSERT/UPDATE/DELETE policies; to view another org's
  flags, switch active org via the OrgSwitcher.

  ## Effect

  - autom8ionlab user (incl. SuperAdmin in autom8ionlab context):
    sees only globals → Projects, Proposals, Contracts visible again.
  - BuilderLync user (or SuperAdmin switched to BuilderLync):
    sees globals + BuilderLync per-org overrides → Projects/Proposals/
    Contracts correctly hidden.
*/

DROP POLICY IF EXISTS "Authenticated users can view feature flags" ON feature_flags;
DROP POLICY IF EXISTS "SuperAdmin manages feature flags" ON feature_flags;

CREATE POLICY "Users view feature flags for their active org"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = get_user_org_id()
  );

CREATE POLICY "SuperAdmin inserts feature flags"
  ON feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "SuperAdmin updates feature flags"
  ON feature_flags FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "SuperAdmin deletes feature flags"
  ON feature_flags FOR DELETE
  TO authenticated
  USING (is_super_admin());
