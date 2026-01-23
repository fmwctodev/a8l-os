/*
  # Conversations Module - Permissions and Feature Flag

  ## Overview
  Adds permissions for the conversations module and enables the feature flag.

  ## 1. New Permissions
  - conversations.view - View conversations and messages
  - conversations.send - Send messages in conversations
  - conversations.assign - Assign conversations to users
  - conversations.close - Close/reopen conversations
  - conversations.manage - Full management access
  - channels.configure - Configure channel integrations

  ## 2. Role Mapping
  - SuperAdmin/Admin: All permissions including channels.configure
  - Manager: view, send, assign, close
  - Sales/Ops: view, send
  - ReadOnly: view only

  ## 3. Feature Flag
  - conversations feature flag enabled
*/

INSERT INTO permissions (key, description, module_name)
VALUES
  ('conversations.view', 'View conversations and messages', 'conversations'),
  ('conversations.send', 'Send messages in conversations', 'conversations'),
  ('conversations.assign', 'Assign conversations to team members', 'conversations'),
  ('conversations.close', 'Close and reopen conversations', 'conversations'),
  ('conversations.manage', 'Full conversation management access', 'conversations'),
  ('channels.configure', 'Configure channel integrations (Twilio, Gmail, Webchat)', 'conversations')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
AND p.key IN (
  'conversations.view', 'conversations.send', 'conversations.assign',
  'conversations.close', 'conversations.manage', 'channels.configure'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
AND p.key IN (
  'conversations.view', 'conversations.send', 'conversations.assign',
  'conversations.close', 'conversations.manage', 'channels.configure'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
AND p.key IN (
  'conversations.view', 'conversations.send', 'conversations.assign', 'conversations.close'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Sales', 'Ops')
AND p.key IN ('conversations.view', 'conversations.send')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ReadOnly'
AND p.key = 'conversations.view'
ON CONFLICT DO NOTHING;

INSERT INTO feature_flags (key, enabled, description)
VALUES ('conversations', true, 'Unified inbox and multi-channel conversations module')
ON CONFLICT (key) DO UPDATE SET enabled = true;
