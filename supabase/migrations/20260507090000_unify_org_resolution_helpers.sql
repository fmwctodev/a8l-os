/*
  # Unify all three "current org" SQL helpers

  ## Why

  Three SQL functions exist for resolving the current user's org:

  - `get_user_org_id()`         (added in 20260507010000) — honors
    super_admin_active_org_id when role = SuperAdmin
  - `get_auth_user_org_id()`    — legacy, returns the user's home
    organization_id only
  - `get_user_organization_id()` — legacy, same as above

  All existing RLS policies on data tables (contacts, opportunities,
  invoices, conversations, projects, contracts, payments, products,
  recurring_profiles, calendar_events, etc.) pivot through the LEGACY
  helpers. So when SuperAdmin switched active org via the OrgSwitcher,
  RLS still returned their HOME org's data — Autom8ion Lab data leaked
  into the BuilderLync view.

  ## Fix

  Rewrite the two legacy helpers to honor super_admin_active_org_id —
  identical body to `get_user_org_id()`. Every existing policy
  automatically benefits without needing to be rewritten.

  ## Effect

  - Regular users: unchanged (super_admin_active_org_id is NULL for
    them, so COALESCE falls back to organization_id).
  - SuperAdmin in autom8ionlab context: unchanged, sees autom8ionlab
    data only.
  - SuperAdmin switched to BuilderLync via OrgSwitcher: now sees ONLY
    BuilderLync data. Switching back reverses.

  ## Out of scope

  audit_logs and llm_model_catalog still have direct
  `is_super_admin()` bypasses — those are intentionally cross-org
  (platform-wide audit visibility, shared model catalog).
*/

CREATE OR REPLACE FUNCTION public.get_auth_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE
      WHEN (SELECT r.name FROM roles r WHERE r.id = u.role_id) = 'SuperAdmin'
      THEN u.super_admin_active_org_id
    END,
    u.organization_id
  )
  FROM users u
  WHERE u.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      CASE
        WHEN (SELECT r.name FROM roles r WHERE r.id = u.role_id) = 'SuperAdmin'
        THEN u.super_admin_active_org_id
      END,
      u.organization_id
    )
    FROM users u
    WHERE u.id = auth.uid()
  );
END;
$$;
