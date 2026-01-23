/*
  # Email Services Permissions and Feature Flag

  1. Overview
    - Adds permissions for email services module
    - Creates feature flag for email_services
    - Assigns permissions to appropriate roles

  2. New Permissions
    - email.settings.view - View email settings pages
    - email.settings.manage - Manage email configurations (admin only)
    - email.send.test - Send test emails

  3. Role Assignments
    - SuperAdmin: all permissions
    - Admin: all permissions
    - Manager: view + test
    - Sales: view only
    - Ops: view only
    - ReadOnly: view only

  4. Feature Flag
    - email_services: enabled by default
*/

INSERT INTO permissions (key, description, module_name) VALUES
  ('email.settings.view', 'View email settings pages', 'email'),
  ('email.settings.manage', 'Manage email configurations', 'email'),
  ('email.send.test', 'Send test emails', 'email')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin' AND p.key IN (
  'email.settings.view',
  'email.settings.manage',
  'email.send.test'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Admin' AND p.key IN (
  'email.settings.view',
  'email.settings.manage',
  'email.send.test'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Manager' AND p.key IN (
  'email.settings.view',
  'email.send.test'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Sales' AND p.key IN (
  'email.settings.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Ops' AND p.key IN (
  'email.settings.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ReadOnly' AND p.key IN (
  'email.settings.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('email_services', true, 'Email Services module for SendGrid integration')
ON CONFLICT (key) DO UPDATE SET enabled = true;

INSERT INTO email_defaults (org_id)
SELECT id FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM email_defaults WHERE email_defaults.org_id = organizations.id
);
