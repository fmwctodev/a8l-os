/*
  # Grant Change Control Access to All Roles

  ## Summary
  Expands change request permissions so all user roles can access the project
  change control system, not just SuperAdmin/Admin.

  ## Changes

  ### Permission Grants
  - **User role**: adds `projects.change_requests.manage` (already had `view`)
  - **Manager role**: adds `projects.change_requests.approve` (already had `view` + `manage`)
  - **Sales role**: adds `projects.change_requests.view` + `projects.change_requests.manage`
  - **Support role**: adds `projects.change_requests.view` + `projects.change_requests.manage`
  - **ReadOnly role**: adds `projects.change_requests.view`

  ### Client Portal Permissions
  - **Manager role**: adds `projects.client_portal.manage` (already had `view`)
  - **Sales role**: adds `projects.client_portal.view` + `projects.client_portal.manage`
  - **Support role**: adds `projects.client_portal.view`
  - **User role**: adds `projects.client_portal.view`

  ## Notes
  - All inserts use ON CONFLICT DO NOTHING so this migration is safe to re-run
  - No destructive operations - only adding missing role_permissions rows
  - The UI already respects these permission flags, so no code changes are needed
*/

DO $$
DECLARE
  v_user_role_id       uuid;
  v_manager_role_id    uuid;
  v_sales_role_id      uuid;
  v_support_role_id    uuid;
  v_readonly_role_id   uuid;

  v_cr_view_id     uuid;
  v_cr_manage_id   uuid;
  v_cr_approve_id  uuid;
  v_cp_view_id     uuid;
  v_cp_manage_id   uuid;
BEGIN
  SELECT id INTO v_user_role_id     FROM roles WHERE name = 'User'     LIMIT 1;
  SELECT id INTO v_manager_role_id  FROM roles WHERE name = 'Manager'  LIMIT 1;
  SELECT id INTO v_sales_role_id    FROM roles WHERE name = 'Sales'    LIMIT 1;
  SELECT id INTO v_support_role_id  FROM roles WHERE name = 'Support'  LIMIT 1;
  SELECT id INTO v_readonly_role_id FROM roles WHERE name = 'ReadOnly' LIMIT 1;

  SELECT id INTO v_cr_view_id    FROM permissions WHERE key = 'projects.change_requests.view'    LIMIT 1;
  SELECT id INTO v_cr_manage_id  FROM permissions WHERE key = 'projects.change_requests.manage'  LIMIT 1;
  SELECT id INTO v_cr_approve_id FROM permissions WHERE key = 'projects.change_requests.approve' LIMIT 1;
  SELECT id INTO v_cp_view_id    FROM permissions WHERE key = 'projects.client_portal.view'      LIMIT 1;
  SELECT id INTO v_cp_manage_id  FROM permissions WHERE key = 'projects.client_portal.manage'    LIMIT 1;

  -- User: add manage (already has view)
  IF v_user_role_id IS NOT NULL AND v_cr_manage_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_user_role_id, v_cr_manage_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Manager: add approve (already has view + manage)
  IF v_manager_role_id IS NOT NULL AND v_cr_approve_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_manager_role_id, v_cr_approve_id) ON CONFLICT DO NOTHING;
  END IF;
  -- Manager: add client portal manage (already has view)
  IF v_manager_role_id IS NOT NULL AND v_cp_manage_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_manager_role_id, v_cp_manage_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Sales: add view + manage for change requests
  IF v_sales_role_id IS NOT NULL AND v_cr_view_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_sales_role_id, v_cr_view_id)   ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_sales_role_id, v_cr_manage_id) ON CONFLICT DO NOTHING;
  END IF;
  -- Sales: add client portal view + manage
  IF v_sales_role_id IS NOT NULL AND v_cp_view_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_sales_role_id, v_cp_view_id)   ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_sales_role_id, v_cp_manage_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Support: add view + manage for change requests
  IF v_support_role_id IS NOT NULL AND v_cr_view_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_support_role_id, v_cr_view_id)   ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_support_role_id, v_cr_manage_id) ON CONFLICT DO NOTHING;
  END IF;
  -- Support: add client portal view
  IF v_support_role_id IS NOT NULL AND v_cp_view_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_support_role_id, v_cp_view_id) ON CONFLICT DO NOTHING;
  END IF;

  -- ReadOnly: add view only for change requests
  IF v_readonly_role_id IS NOT NULL AND v_cr_view_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_readonly_role_id, v_cr_view_id) ON CONFLICT DO NOTHING;
  END IF;
  -- ReadOnly: add client portal view
  IF v_readonly_role_id IS NOT NULL AND v_cp_view_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_readonly_role_id, v_cp_view_id) ON CONFLICT DO NOTHING;
  END IF;

END $$;
