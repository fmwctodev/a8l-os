/*
  # Add Reporting Permissions and Feature Flag

  1. Permissions
    - `reporting.view` - View reports and run queries
    - `reporting.manage` - Create, edit, delete reports
    - `reporting.schedule` - Create and manage scheduled reports
    - `reporting.export` - Export reports to CSV

  2. Feature Flag
    - `reporting` - Enable/disable the reporting module

  3. Role Assignments
    - Sales/Ops: view, export (own department reports)
    - Manager: view, manage, export, schedule (own department)
    - Admin/SuperAdmin: all permissions (organization-wide)
*/

-- Insert reporting permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('reporting.view', 'View reports and run queries', 'reporting'),
  ('reporting.manage', 'Create, edit, and delete reports', 'reporting'),
  ('reporting.schedule', 'Create and manage scheduled report deliveries', 'reporting'),
  ('reporting.export', 'Export report data to CSV', 'reporting')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to roles
-- Sales role: view and export
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sales'
AND p.key IN ('reporting.view', 'reporting.export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Operations role: view and export
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Operations'
AND p.key IN ('reporting.view', 'reporting.export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager role: view, manage, export, schedule
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
AND p.key IN ('reporting.view', 'reporting.manage', 'reporting.export', 'reporting.schedule')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin role: all reporting permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
AND p.key LIKE 'reporting.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- SuperAdmin role: all reporting permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
AND p.key LIKE 'reporting.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Enable reporting feature flag
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('reporting', true, 'Custom report builder with charts and scheduled exports')
ON CONFLICT (key) DO UPDATE SET enabled = true;