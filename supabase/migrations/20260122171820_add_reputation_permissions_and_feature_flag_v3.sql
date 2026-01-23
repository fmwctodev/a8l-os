/*
  # Add Reputation Management Permissions and Feature Flag

  1. New Permissions
    - reputation.view - View reviews and dashboard
    - reputation.request - Send review requests
    - reputation.manage - Manage reviews, link contacts, manual entry
    - reputation.providers.manage - Connect/disconnect providers

  2. Role Assignments
    - SuperAdmin/Admin: All permissions
    - Manager: view, request, manage
    - Sales: view, request
    - Operations: view, request
    - ReadOnly: view only

  3. Feature Flag
    - Enable reputation feature flag
*/

-- Insert reputation permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('reputation.view', 'View reviews and reputation dashboard', 'Reputation'),
  ('reputation.request', 'Send review requests to contacts', 'Reputation'),
  ('reputation.manage', 'Manage reviews, link contacts, create manual entries', 'Reputation'),
  ('reputation.providers.manage', 'Connect and configure review platforms', 'Reputation')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to roles
DO $$
DECLARE
  v_super_admin_role_id uuid;
  v_admin_role_id uuid;
  v_manager_role_id uuid;
  v_sales_role_id uuid;
  v_operations_role_id uuid;
  v_readonly_role_id uuid;
  v_view_perm_id uuid;
  v_request_perm_id uuid;
  v_manage_perm_id uuid;
  v_providers_perm_id uuid;
BEGIN
  -- Get role IDs
  SELECT id INTO v_super_admin_role_id FROM roles WHERE name = 'Super Admin';
  SELECT id INTO v_admin_role_id FROM roles WHERE name = 'Admin';
  SELECT id INTO v_manager_role_id FROM roles WHERE name = 'Manager';
  SELECT id INTO v_sales_role_id FROM roles WHERE name = 'Sales';
  SELECT id INTO v_operations_role_id FROM roles WHERE name = 'Operations';
  SELECT id INTO v_readonly_role_id FROM roles WHERE name = 'Read Only';

  -- Get permission IDs
  SELECT id INTO v_view_perm_id FROM permissions WHERE key = 'reputation.view';
  SELECT id INTO v_request_perm_id FROM permissions WHERE key = 'reputation.request';
  SELECT id INTO v_manage_perm_id FROM permissions WHERE key = 'reputation.manage';
  SELECT id INTO v_providers_perm_id FROM permissions WHERE key = 'reputation.providers.manage';

  -- Super Admin: All permissions
  IF v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (v_super_admin_role_id, v_view_perm_id),
      (v_super_admin_role_id, v_request_perm_id),
      (v_super_admin_role_id, v_manage_perm_id),
      (v_super_admin_role_id, v_providers_perm_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Admin: All permissions
  IF v_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (v_admin_role_id, v_view_perm_id),
      (v_admin_role_id, v_request_perm_id),
      (v_admin_role_id, v_manage_perm_id),
      (v_admin_role_id, v_providers_perm_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Manager: view, request, manage
  IF v_manager_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (v_manager_role_id, v_view_perm_id),
      (v_manager_role_id, v_request_perm_id),
      (v_manager_role_id, v_manage_perm_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Sales: view, request
  IF v_sales_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (v_sales_role_id, v_view_perm_id),
      (v_sales_role_id, v_request_perm_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Operations: view, request
  IF v_operations_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (v_operations_role_id, v_view_perm_id),
      (v_operations_role_id, v_request_perm_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Read Only: view only
  IF v_readonly_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (v_readonly_role_id, v_view_perm_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Enable reputation feature flag
INSERT INTO feature_flags (key, description, enabled)
VALUES ('reputation', 'Monitor and manage online reviews and customer feedback', true)
ON CONFLICT (key) DO UPDATE SET enabled = true;
