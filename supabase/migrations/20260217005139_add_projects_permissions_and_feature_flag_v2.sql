/*
  # Add Projects Permissions and Feature Flag

  1. Feature Flag
    - `projects` - Enables the Project Manager module

  2. Permissions (8 total)
    - `projects.view` - View projects and project pipelines
    - `projects.create` - Create new projects
    - `projects.edit` - Edit project details, notes, costs
    - `projects.move_stage` - Move projects between pipeline stages
    - `projects.close` - Mark projects completed or cancelled
    - `projects.delete` - Delete projects
    - `projects.tasks.manage` - Create, edit, assign, complete tasks
    - `project_pipelines.manage` - Create, edit, delete project pipelines and stages

  3. Role Assignments
    - SuperAdmin: all 8 permissions
    - Admin: all 8 permissions
    - Manager: 7 (all except delete)
    - Sales: 6 (view, create, edit, move_stage, close, tasks.manage)
    - Support: view only
    - ReadOnly: view only
*/

INSERT INTO feature_flags (key, enabled, description)
VALUES ('projects', true, 'Project Manager module for post-sale execution')
ON CONFLICT (key) DO NOTHING;

INSERT INTO permissions (key, description, module_name) VALUES
  ('projects.view', 'View projects and project pipelines', 'projects'),
  ('projects.create', 'Create new projects', 'projects'),
  ('projects.edit', 'Edit project details, notes, costs', 'projects'),
  ('projects.move_stage', 'Move projects between pipeline stages', 'projects'),
  ('projects.close', 'Mark projects completed or cancelled', 'projects'),
  ('projects.delete', 'Delete projects permanently', 'projects'),
  ('projects.tasks.manage', 'Create, edit, assign, complete tasks', 'projects'),
  ('project_pipelines.manage', 'Create, edit, delete project pipelines and stages', 'projects')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  v_super_admin_id uuid;
  v_admin_id uuid;
  v_manager_id uuid;
  v_sales_id uuid;
  v_support_id uuid;
  v_readonly_id uuid;
  v_perm_id uuid;
BEGIN
  SELECT id INTO v_super_admin_id FROM roles WHERE name = 'SuperAdmin' LIMIT 1;
  SELECT id INTO v_admin_id FROM roles WHERE name = 'Admin' LIMIT 1;
  SELECT id INTO v_manager_id FROM roles WHERE name = 'Manager' LIMIT 1;
  SELECT id INTO v_sales_id FROM roles WHERE name = 'Sales' LIMIT 1;
  SELECT id INTO v_support_id FROM roles WHERE name = 'Support' LIMIT 1;
  SELECT id INTO v_readonly_id FROM roles WHERE name = 'ReadOnly' LIMIT 1;

  FOR v_perm_id IN
    SELECT id FROM permissions WHERE module_name = 'projects'
  LOOP
    IF v_super_admin_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_super_admin_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_admin_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_admin_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR v_perm_id IN
    SELECT id FROM permissions
    WHERE module_name = 'projects' AND key != 'projects.delete'
  LOOP
    IF v_manager_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_manager_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR v_perm_id IN
    SELECT id FROM permissions
    WHERE key IN ('projects.view', 'projects.create', 'projects.edit', 'projects.move_stage', 'projects.close', 'projects.tasks.manage')
  LOOP
    IF v_sales_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_sales_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR v_perm_id IN
    SELECT id FROM permissions WHERE key = 'projects.view'
  LOOP
    IF v_support_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_support_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_readonly_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_readonly_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
