/*
  # Phone System Permissions and Feature Flag

  1. New Permissions
    - `phone.settings.view` - View phone system settings
    - `phone.settings.manage` - Manage Twilio connection
    - `phone.numbers.manage` - Manage phone numbers
    - `phone.routing.manage` - Manage voice routing
    - `phone.test.run` - Send test SMS/calls
    - `phone.compliance.manage` - Manage compliance settings

  2. Role Assignments
    - SuperAdmin/Admin: all permissions
    - Manager: view + routing
    - Sales/Ops: view only
    - ReadOnly: view only

  3. Feature Flag
    - `phone_services` - Enabled by default

  4. Seed Data
    - Initialize phone_settings for existing organizations
    - Initialize webhook_health records
*/

-- Insert phone permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('phone.settings.view', 'Can view phone system settings and configuration', 'phone'),
  ('phone.settings.manage', 'Can manage Twilio connection and settings', 'phone'),
  ('phone.numbers.manage', 'Can manage phone numbers and assignments', 'phone'),
  ('phone.routing.manage', 'Can manage voice routing groups and destinations', 'phone'),
  ('phone.test.run', 'Can send test SMS and make test calls', 'phone'),
  ('phone.compliance.manage', 'Can manage DNC list and compliance settings', 'phone')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to SuperAdmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
AND p.key IN (
  'phone.settings.view',
  'phone.settings.manage',
  'phone.numbers.manage',
  'phone.routing.manage',
  'phone.test.run',
  'phone.compliance.manage'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
AND p.key IN (
  'phone.settings.view',
  'phone.settings.manage',
  'phone.numbers.manage',
  'phone.routing.manage',
  'phone.test.run',
  'phone.compliance.manage'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign view and routing permissions to Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
AND p.key IN (
  'phone.settings.view',
  'phone.routing.manage'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign view only to Sales role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sales'
AND p.key = 'phone.settings.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign view only to Ops role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Ops'
AND p.key = 'phone.settings.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign view only to ReadOnly role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ReadOnly'
AND p.key = 'phone.settings.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create phone_services feature flag (enabled by default)
INSERT INTO feature_flags (key, description, enabled)
VALUES (
  'phone_services',
  'Enable Twilio SMS and Voice telephony integration',
  true
)
ON CONFLICT (key) DO NOTHING;

-- Initialize phone_settings for existing organizations
INSERT INTO phone_settings (org_id)
SELECT id FROM organizations
ON CONFLICT (org_id) DO NOTHING;

-- Initialize webhook_health records for existing organizations
INSERT INTO webhook_health (org_id, webhook_type)
SELECT o.id, wt.type
FROM organizations o
CROSS JOIN (VALUES ('sms'), ('voice'), ('status')) AS wt(type)
ON CONFLICT (org_id, webhook_type) DO NOTHING;
