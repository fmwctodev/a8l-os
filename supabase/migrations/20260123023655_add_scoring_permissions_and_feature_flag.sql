/*
  # Lead Scoring Module - Permissions and Feature Flag

  1. Feature Flag
    - `scoring_management` - Enable/disable scoring module

  2. Permissions
    - `scoring.view` - View scoring models, rules, and scores
    - `scoring.manage` - Create, edit, delete scoring models and rules
    - `scoring.adjust` - Manually adjust entity scores

  3. Role Assignments
    - SuperAdmin: All scoring permissions
    - Admin: All scoring permissions
    - Manager: View and adjust
    - Sales/Ops: View only
*/

-- Insert feature flag
INSERT INTO feature_flags (key, enabled, description)
VALUES ('scoring_management', true, 'Enable lead scoring and engagement tracking')
ON CONFLICT (key) DO NOTHING;

-- Insert permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('scoring.view', 'View scoring models, rules, and entity scores', 'scoring'),
  ('scoring.manage', 'Create, edit, and delete scoring models and rules', 'scoring'),
  ('scoring.adjust', 'Manually adjust contact and opportunity scores', 'scoring')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to SuperAdmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
  AND p.key IN ('scoring.view', 'scoring.manage', 'scoring.adjust')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
  AND p.key IN ('scoring.view', 'scoring.manage', 'scoring.adjust')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
  AND p.key IN ('scoring.view', 'scoring.adjust')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign view permission to Sales role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sales'
  AND p.key = 'scoring.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign view permission to Ops role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Ops'
  AND p.key = 'scoring.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
