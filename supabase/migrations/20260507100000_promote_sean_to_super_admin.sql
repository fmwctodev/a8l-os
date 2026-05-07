/*
  # Promote sean@autom8ionlab.com to SuperAdmin

  ## Why

  Owner needs both `admin@autom8ionlab.com` and `sean@autom8ionlab.com`
  to switch between the Autom8ion Lab and BuilderLync tenants via the
  OrgSwitcher dropdown.

  The OrgSwitcher visibility and the `super_admin_active_org_id` pivot
  in `get_user_org_id()` both gate on `role.name = 'SuperAdmin'`. Sean
  was an Admin (full org-scoped access in autom8ionlab but no
  cross-org switching). Promoting to SuperAdmin grants the switching
  capability.

  Idempotent: only runs if the user exists and isn't already SuperAdmin.
*/

DO $$
DECLARE
  super_admin_role_id uuid;
BEGIN
  SELECT id INTO super_admin_role_id FROM roles WHERE name = 'SuperAdmin' LIMIT 1;
  IF super_admin_role_id IS NULL THEN
    RAISE NOTICE 'SuperAdmin role not found; skipping promotion';
    RETURN;
  END IF;

  UPDATE users
  SET role_id = super_admin_role_id,
      updated_at = now()
  WHERE email = 'sean@autom8ionlab.com'
    AND role_id <> super_admin_role_id;
END $$;
