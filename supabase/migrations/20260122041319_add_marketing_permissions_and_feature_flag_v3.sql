/*
  # Add Marketing Module Permissions and Feature Flag

  1. Permissions
    - marketing.forms.view - View forms and submissions
    - marketing.forms.manage - Create, edit, delete forms
    - marketing.forms.publish - Publish/unpublish forms
    - marketing.surveys.view - View surveys and submissions
    - marketing.surveys.manage - Create, edit, delete surveys
    - marketing.surveys.publish - Publish/unpublish surveys
    - marketing.social.view - View social accounts and posts
    - marketing.social.manage - Create, edit, delete posts
    - marketing.social.approve - Approve posts for publishing
    - marketing.social.publish - Schedule and publish posts
    - marketing.social.connect - Connect/disconnect social accounts

  2. Role Assignments
    - SuperAdmin: All permissions
    - Admin: All permissions
    - Manager: All except connect
    - Sales: View only
    - Operations: View only

  3. Feature Flag
    - marketing: Enable marketing module
*/

-- Insert marketing permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('marketing.forms.view', 'View forms and their submissions', 'marketing'),
  ('marketing.forms.manage', 'Create, edit, and delete forms', 'marketing'),
  ('marketing.forms.publish', 'Publish and unpublish forms', 'marketing'),
  ('marketing.surveys.view', 'View surveys and their submissions', 'marketing'),
  ('marketing.surveys.manage', 'Create, edit, and delete surveys', 'marketing'),
  ('marketing.surveys.publish', 'Publish and unpublish surveys', 'marketing'),
  ('marketing.social.view', 'View social accounts and posts', 'marketing'),
  ('marketing.social.manage', 'Create, edit, and delete social posts', 'marketing'),
  ('marketing.social.approve', 'Approve posts for publishing', 'marketing'),
  ('marketing.social.publish', 'Schedule and publish social posts', 'marketing'),
  ('marketing.social.connect', 'Connect and disconnect social media accounts', 'marketing')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to SuperAdmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
AND p.key LIKE 'marketing.%'
ON CONFLICT DO NOTHING;

-- Assign permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
AND p.key LIKE 'marketing.%'
ON CONFLICT DO NOTHING;

-- Assign permissions to Manager role (all except connect)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
AND p.key LIKE 'marketing.%'
AND p.key != 'marketing.social.connect'
ON CONFLICT DO NOTHING;

-- Assign view permissions to Sales role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sales'
AND p.key IN ('marketing.forms.view', 'marketing.surveys.view', 'marketing.social.view')
ON CONFLICT DO NOTHING;

-- Assign view permissions to Operations role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Operations'
AND p.key IN ('marketing.forms.view', 'marketing.surveys.view', 'marketing.social.view')
ON CONFLICT DO NOTHING;

-- Enable marketing feature flag
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('marketing', true, 'Marketing module with forms, surveys, and social planner')
ON CONFLICT (key) DO UPDATE SET enabled = true;
