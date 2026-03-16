/*
  # Fix Change Requests Permissions - Role Name Case Mismatch

  ## Problem
  The original change control migration (20260316030004) queried roles using
  lowercase names ('superadmin', 'admin', 'manager', 'user') but the actual
  seeded roles use PascalCase ('SuperAdmin', 'Admin', 'Manager', etc.).

  Because the role lookups returned NULL, all permission inserts silently
  failed - meaning no role except SuperAdmin (which bypasses permission checks
  entirely in code) ever received the projects.change_requests.* permissions.

  This caused the Change Requests tab to be invisible for Admin users like
  Sean Richard and Gabe Wilkinson.

  ## Fix
  Re-assign change request permissions to all roles using the correct
  PascalCase role names that actually exist in the database.

  ## Role Assignments
  - SuperAdmin: view + manage + approve (already works via code bypass, adding for completeness)
  - Admin: view + manage + approve
  - Manager: view + manage + approve
  - Sales: view + manage
  - Ops: view + manage
  - ReadOnly: view only
*/

DO $$
DECLARE
  v_view_id     uuid;
  v_manage_id   uuid;
  v_approve_id  uuid;
  v_superadmin  uuid;
  v_admin       uuid;
  v_manager     uuid;
  v_sales       uuid;
  v_ops         uuid;
  v_readonly    uuid;
BEGIN
  SELECT id INTO v_view_id    FROM permissions WHERE key = 'projects.change_requests.view';
  SELECT id INTO v_manage_id  FROM permissions WHERE key = 'projects.change_requests.manage';
  SELECT id INTO v_approve_id FROM permissions WHERE key = 'projects.change_requests.approve';

  SELECT id INTO v_superadmin FROM roles WHERE name = 'SuperAdmin' LIMIT 1;
  SELECT id INTO v_admin      FROM roles WHERE name = 'Admin'      LIMIT 1;
  SELECT id INTO v_manager    FROM roles WHERE name = 'Manager'    LIMIT 1;
  SELECT id INTO v_sales      FROM roles WHERE name = 'Sales'      LIMIT 1;
  SELECT id INTO v_ops        FROM roles WHERE name = 'Ops'        LIMIT 1;
  SELECT id INTO v_readonly   FROM roles WHERE name = 'ReadOnly'   LIMIT 1;

  IF v_view_id IS NULL OR v_manage_id IS NULL OR v_approve_id IS NULL THEN
    RAISE EXCEPTION 'Change request permissions not found in permissions table';
  END IF;

  -- SuperAdmin: all permissions
  IF v_superadmin IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_superadmin, v_view_id)    ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_superadmin, v_manage_id)  ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_superadmin, v_approve_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Admin: all permissions
  IF v_admin IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_admin, v_view_id)    ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_admin, v_manage_id)  ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_admin, v_approve_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Manager: all permissions
  IF v_manager IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_manager, v_view_id)    ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_manager, v_manage_id)  ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_manager, v_approve_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Sales: view + manage
  IF v_sales IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_sales, v_view_id)   ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_sales, v_manage_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Ops: view + manage
  IF v_ops IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_ops, v_view_id)   ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_ops, v_manage_id) ON CONFLICT DO NOTHING;
  END IF;

  -- ReadOnly: view only
  IF v_readonly IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_readonly, v_view_id) ON CONFLICT DO NOTHING;
  END IF;

END $$;
