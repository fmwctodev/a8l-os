/*
  # AI Agents Permissions and Feature Flag

  This migration adds permissions for the AI Agents module and enables the feature flag.

  1. New Permissions
    - ai_agents.view - View AI agents and their runs
    - ai_agents.run - Execute AI agents
    - ai_agents.manage - Create, edit, delete AI agents
    - ai_agents.memory.reset - Reset agent memory for contacts

  2. Permission Assignments
    - Sales/Operations: view, run
    - Manager: view, run, manage
    - Admin: view, run, manage, memory.reset
    - SuperAdmin: All permissions

  3. Feature Flag
    - ai_agents feature flag enabled
*/

-- Insert AI Agents permissions
INSERT INTO permissions (key, description, module_name)
VALUES
  ('ai_agents.view', 'View AI agents and their execution history', 'ai_agents'),
  ('ai_agents.run', 'Execute AI agents on contacts', 'ai_agents'),
  ('ai_agents.manage', 'Create, edit, and delete AI agents', 'ai_agents'),
  ('ai_agents.memory.reset', 'Reset AI agent memory for contacts', 'ai_agents')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to roles
-- Sales role: view and run
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sales'
  AND p.key IN ('ai_agents.view', 'ai_agents.run')
ON CONFLICT DO NOTHING;

-- Operations role: view and run
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Operations'
  AND p.key IN ('ai_agents.view', 'ai_agents.run')
ON CONFLICT DO NOTHING;

-- Manager role: view, run, manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
  AND p.key IN ('ai_agents.view', 'ai_agents.run', 'ai_agents.manage')
ON CONFLICT DO NOTHING;

-- Admin role: all ai_agents permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
  AND p.key LIKE 'ai_agents.%'
ON CONFLICT DO NOTHING;

-- SuperAdmin role: all ai_agents permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
  AND p.key LIKE 'ai_agents.%'
ON CONFLICT DO NOTHING;

-- Enable AI Agents feature flag
INSERT INTO feature_flags (key, enabled, description)
VALUES ('ai_agents', true, 'AI Agents module for automated CRM interactions')
ON CONFLICT (key) DO UPDATE SET enabled = true;