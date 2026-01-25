/*
  # Add Google Chat Permissions

  1. New Permissions
    - `team_messaging.view` - View team messaging and Google Chat spaces
    - `team_messaging.send` - Send messages in Google Chat spaces
    - `team_messaging.manage` - Manage Google Chat connection settings

  2. Grant permissions to appropriate roles
*/

-- Insert Google Chat permissions
INSERT INTO permissions (id, key, description, module_name, created_at)
VALUES
  (gen_random_uuid(), 'team_messaging.view', 'View team messaging and Google Chat spaces', 'conversations', now()),
  (gen_random_uuid(), 'team_messaging.send', 'Send messages in Google Chat spaces', 'conversations', now()),
  (gen_random_uuid(), 'team_messaging.manage', 'Manage Google Chat connection settings', 'conversations', now())
ON CONFLICT (key) DO NOTHING;

-- Grant team_messaging.view to all staff roles (admin, manager, staff)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'manager', 'staff')
  AND p.key = 'team_messaging.view'
ON CONFLICT DO NOTHING;

-- Grant team_messaging.send to all staff roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'manager', 'staff')
  AND p.key = 'team_messaging.send'
ON CONFLICT DO NOTHING;

-- Grant team_messaging.manage to admin only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.key = 'team_messaging.manage'
ON CONFLICT DO NOTHING;
