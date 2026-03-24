/*
  # Add Contracts Permissions and Feature Flag

  1. Feature Flag
    - `contracts` - enabled by default, "Contracts generated from proposals with AI-powered drafting and e-signatures"

  2. Permissions (module: contracts)
    - `contracts.view` - View contracts linked to proposals
    - `contracts.create` - Create contracts from proposals
    - `contracts.edit` - Edit contract content and sections
    - `contracts.send` - Send contracts for signature
    - `contracts.delete` - Delete contracts
    - `contracts.ai_generate` - Use AI to generate contract content

  3. Role Assignments
    - SuperAdmin/Admin: all 6 permissions
    - Manager: all except contracts.delete
    - Sales: view, create, edit, send, ai_generate
    - Support: view only
*/

INSERT INTO feature_flags (key, enabled, description)
VALUES ('contracts', true, 'Contracts generated from proposals with AI-powered drafting and e-signatures')
ON CONFLICT (key) DO NOTHING;

INSERT INTO permissions (key, description, module_name) VALUES
  ('contracts.view', 'View contracts linked to proposals', 'contracts'),
  ('contracts.create', 'Create contracts from proposals', 'contracts'),
  ('contracts.edit', 'Edit contract content and sections', 'contracts'),
  ('contracts.send', 'Send contracts for signature', 'contracts'),
  ('contracts.delete', 'Delete contracts', 'contracts'),
  ('contracts.ai_generate', 'Use AI to generate contract content', 'contracts')
ON CONFLICT (key) DO NOTHING;

-- Assign to SuperAdmin (hierarchy_level = 100)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
  AND p.key IN ('contracts.view', 'contracts.create', 'contracts.edit', 'contracts.send', 'contracts.delete', 'contracts.ai_generate')
ON CONFLICT DO NOTHING;

-- Assign to Admin (hierarchy_level = 90)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
  AND p.key IN ('contracts.view', 'contracts.create', 'contracts.edit', 'contracts.send', 'contracts.delete', 'contracts.ai_generate')
ON CONFLICT DO NOTHING;

-- Assign to Manager (all except delete)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
  AND p.key IN ('contracts.view', 'contracts.create', 'contracts.edit', 'contracts.send', 'contracts.ai_generate')
ON CONFLICT DO NOTHING;

-- Assign to Sales (view, create, edit, send, ai_generate)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sales'
  AND p.key IN ('contracts.view', 'contracts.create', 'contracts.edit', 'contracts.send', 'contracts.ai_generate')
ON CONFLICT DO NOTHING;

-- Assign to Support (view only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Support'
  AND p.key IN ('contracts.view')
ON CONFLICT DO NOTHING;
