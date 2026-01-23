/*
  # Conversations Advanced Features - Permissions

  ## Overview
  Adds permissions for snippets and conversation rules features.

  ## 1. New Permissions

  ### Snippets
  - snippets.view - View available snippets
  - snippets.create - Create personal snippets
  - snippets.manage - Manage team snippets
  - snippets.system.manage - Manage system-wide snippets (admin only)

  ### Conversation Rules
  - conversation_rules.view - View automation rules
  - conversation_rules.manage - Create, edit, and delete rules

  ## 2. Role Mapping
  - SuperAdmin/Admin: All permissions
  - Manager: snippets.view, snippets.create, snippets.manage, conversation_rules.view, conversation_rules.manage
  - Sales/Ops: snippets.view, snippets.create
  - ReadOnly: snippets.view

  ## 3. Feature Flags
  - snippets feature flag enabled
  - conversation_rules feature flag enabled
*/

-- Insert new permissions
INSERT INTO permissions (key, description, module_name)
VALUES
  ('snippets.view', 'View available message snippets', 'conversations'),
  ('snippets.create', 'Create personal message snippets', 'conversations'),
  ('snippets.manage', 'Manage team snippets and all personal snippets', 'conversations'),
  ('snippets.system.manage', 'Manage system-wide snippets', 'conversations'),
  ('conversation_rules.view', 'View conversation automation rules', 'conversations'),
  ('conversation_rules.manage', 'Create and manage conversation automation rules', 'conversations')
ON CONFLICT (key) DO NOTHING;

-- SuperAdmin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
AND p.key IN (
  'snippets.view', 'snippets.create', 'snippets.manage', 'snippets.system.manage',
  'conversation_rules.view', 'conversation_rules.manage'
)
ON CONFLICT DO NOTHING;

-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
AND p.key IN (
  'snippets.view', 'snippets.create', 'snippets.manage', 'snippets.system.manage',
  'conversation_rules.view', 'conversation_rules.manage'
)
ON CONFLICT DO NOTHING;

-- Manager gets most permissions except system snippets
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
AND p.key IN (
  'snippets.view', 'snippets.create', 'snippets.manage',
  'conversation_rules.view', 'conversation_rules.manage'
)
ON CONFLICT DO NOTHING;

-- Sales and Ops can view and create personal snippets
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Sales', 'Ops')
AND p.key IN ('snippets.view', 'snippets.create')
ON CONFLICT DO NOTHING;

-- ReadOnly can only view snippets
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ReadOnly'
AND p.key = 'snippets.view'
ON CONFLICT DO NOTHING;

-- Enable feature flags
INSERT INTO feature_flags (key, enabled, description)
VALUES 
  ('snippets', true, 'Message snippets for quick responses'),
  ('conversation_rules', true, 'Automated rules for conversation handling')
ON CONFLICT (key) DO UPDATE SET enabled = true;
