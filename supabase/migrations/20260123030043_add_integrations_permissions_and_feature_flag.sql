/*
  # Permissions and Feature Flag for Integrations Module
  
  1. Overview
    - Adds feature flag to enable/disable integrations module
    - Creates permissions for integration operations
    - Assigns permissions to appropriate roles
  
  2. Permissions Added
    - integrations.view - View integration catalog and connection status
    - integrations.manage - Connect/disconnect global integrations
    - integrations.manage_user - View/manage user-level connections (for department)
    - integrations.webhooks.manage - Create/edit/delete outgoing webhooks
    - integrations.logs.view - View integration activity logs
  
  3. Feature Flag
    - integrations - Enables the integrations settings module
  
  4. Role Assignments
    - SuperAdmin: All permissions
    - Admin: All permissions
    - Manager: view, manage_user (for department oversight)
    - Sales/Ops: view only
*/

-- Insert feature flag for integrations
INSERT INTO feature_flags (key, enabled, description)
VALUES (
  'integrations',
  true,
  'Integrations Settings module - manage third-party integrations, OAuth connections, and webhooks'
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Insert permissions for integrations
INSERT INTO permissions (key, description, module_name) VALUES
  ('integrations.view', 'View integration catalog and connection status', 'integrations'),
  ('integrations.manage', 'Connect and disconnect global org-wide integrations', 'integrations'),
  ('integrations.manage_user', 'View and manage user-level integration connections', 'integrations'),
  ('integrations.webhooks.manage', 'Create, edit, and delete outgoing webhooks', 'integrations'),
  ('integrations.logs.view', 'View integration activity and audit logs', 'integrations')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  module_name = EXCLUDED.module_name;

-- Assign all integrations permissions to SuperAdmin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
AND p.key IN (
  'integrations.view',
  'integrations.manage',
  'integrations.manage_user',
  'integrations.webhooks.manage',
  'integrations.logs.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign all integrations permissions to Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
AND p.key IN (
  'integrations.view',
  'integrations.manage',
  'integrations.manage_user',
  'integrations.webhooks.manage',
  'integrations.logs.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign view and user management to Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
AND p.key IN (
  'integrations.view',
  'integrations.manage_user'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign view-only to Sales
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sales'
AND p.key IN (
  'integrations.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign view-only to Operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Operations'
AND p.key IN (
  'integrations.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
