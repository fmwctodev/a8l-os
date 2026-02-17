/*
  # Add dashboard.view permission

  ## Summary
  Adds a missing `dashboard.view` permission that the analytics-dashboard edge function
  requires but was never seeded into the permissions table.

  ## Changes
  - Inserts `dashboard.view` permission (module: dashboard) into the `permissions` table
  - Grants it to all roles: SuperAdmin, Admin, Manager, Sales, Ops, ReadOnly
*/

INSERT INTO permissions (id, key, description, module_name)
VALUES (gen_random_uuid(), 'dashboard.view', 'View dashboard and analytics', 'dashboard')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.key = 'dashboard.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
