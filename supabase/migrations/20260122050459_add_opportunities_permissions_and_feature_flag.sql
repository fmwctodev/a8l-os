/*
  # Add Opportunities Permissions and Feature Flag

  This migration adds:
  1. Feature flag for the Opportunities module
  2. Permissions for opportunities management
  3. Role-permission assignments

  ## Permissions Added
  - opportunities.view - View opportunities and pipelines
  - opportunities.create - Create new opportunities
  - opportunities.edit - Edit opportunity details
  - opportunities.move_stage - Move opportunities between stages (drag/drop)
  - opportunities.close - Close opportunities (mark won/lost)
  - opportunities.delete - Delete opportunities
  - pipelines.manage - Create/edit/delete pipelines, stages, and custom fields

  ## Role Assignments
  - SuperAdmin: All permissions
  - Admin: All permissions
  - Manager: All except delete
  - Sales/Ops: View, create, edit, move_stage, close
  - Support: View only
*/

-- Insert feature flag for opportunities module
INSERT INTO feature_flags (key, enabled, description)
VALUES ('opportunities', true, 'Opportunities and Pipelines module for sales tracking')
ON CONFLICT (key) DO UPDATE SET enabled = true;

-- Insert permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('opportunities.view', 'View opportunities and pipeline boards', 'opportunities'),
  ('opportunities.create', 'Create new opportunities', 'opportunities'),
  ('opportunities.edit', 'Edit opportunity details and custom fields', 'opportunities'),
  ('opportunities.move_stage', 'Move opportunities between pipeline stages', 'opportunities'),
  ('opportunities.close', 'Close opportunities as won or lost', 'opportunities'),
  ('opportunities.delete', 'Delete opportunities', 'opportunities'),
  ('pipelines.manage', 'Create and manage pipelines, stages, and custom fields', 'opportunities')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to roles
DO $$
DECLARE
  super_admin_id uuid;
  admin_id uuid;
  manager_id uuid;
  sales_id uuid;
  support_id uuid;
  perm_view uuid;
  perm_create uuid;
  perm_edit uuid;
  perm_move uuid;
  perm_close uuid;
  perm_delete uuid;
  perm_pipelines uuid;
BEGIN
  -- Get role IDs
  SELECT id INTO super_admin_id FROM roles WHERE name = 'SuperAdmin';
  SELECT id INTO admin_id FROM roles WHERE name = 'Admin';
  SELECT id INTO manager_id FROM roles WHERE name = 'Manager';
  SELECT id INTO sales_id FROM roles WHERE name = 'Sales';
  SELECT id INTO support_id FROM roles WHERE name = 'Support';

  -- Get permission IDs
  SELECT id INTO perm_view FROM permissions WHERE key = 'opportunities.view';
  SELECT id INTO perm_create FROM permissions WHERE key = 'opportunities.create';
  SELECT id INTO perm_edit FROM permissions WHERE key = 'opportunities.edit';
  SELECT id INTO perm_move FROM permissions WHERE key = 'opportunities.move_stage';
  SELECT id INTO perm_close FROM permissions WHERE key = 'opportunities.close';
  SELECT id INTO perm_delete FROM permissions WHERE key = 'opportunities.delete';
  SELECT id INTO perm_pipelines FROM permissions WHERE key = 'pipelines.manage';

  -- SuperAdmin: all permissions
  IF super_admin_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (super_admin_id, perm_view),
      (super_admin_id, perm_create),
      (super_admin_id, perm_edit),
      (super_admin_id, perm_move),
      (super_admin_id, perm_close),
      (super_admin_id, perm_delete),
      (super_admin_id, perm_pipelines)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Admin: all permissions
  IF admin_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (admin_id, perm_view),
      (admin_id, perm_create),
      (admin_id, perm_edit),
      (admin_id, perm_move),
      (admin_id, perm_close),
      (admin_id, perm_delete),
      (admin_id, perm_pipelines)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Manager: all except delete
  IF manager_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (manager_id, perm_view),
      (manager_id, perm_create),
      (manager_id, perm_edit),
      (manager_id, perm_move),
      (manager_id, perm_close),
      (manager_id, perm_pipelines)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Sales: view, create, edit, move, close
  IF sales_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (sales_id, perm_view),
      (sales_id, perm_create),
      (sales_id, perm_edit),
      (sales_id, perm_move),
      (sales_id, perm_close)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Support: view only
  IF support_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (support_id, perm_view)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
