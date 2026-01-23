/*
  # Add Calendars Permissions and Feature Flag

  1. New Permissions
    - calendars.view - View calendars and appointment types
    - calendars.manage - Create, edit, delete calendars
    - appointments.view - View appointments
    - appointments.create - Create new appointments
    - appointments.edit - Edit existing appointments
    - appointments.cancel - Cancel appointments

  2. Role Permission Mappings
    - SuperAdmin/Admin: All calendar permissions
    - Manager: All calendar permissions (department-scoped)
    - Sales/Ops: View calendars, view/create appointments
    - ReadOnly: View calendars and appointments only

  3. Feature Flag
    - calendars: Enable/disable entire calendars module
*/

-- Insert calendar permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('calendars.view', 'View calendars and appointment types', 'calendars'),
  ('calendars.manage', 'Create, edit, and delete calendars and appointment types', 'calendars'),
  ('appointments.view', 'View appointments and bookings', 'calendars'),
  ('appointments.create', 'Create new appointments manually', 'calendars'),
  ('appointments.edit', 'Edit existing appointments', 'calendars'),
  ('appointments.cancel', 'Cancel scheduled appointments', 'calendars')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to SuperAdmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SuperAdmin'
AND p.key IN ('calendars.view', 'calendars.manage', 'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Admin'
AND p.key IN ('calendars.view', 'calendars.manage', 'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Manager'
AND p.key IN ('calendars.view', 'calendars.manage', 'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Sales role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Sales'
AND p.key IN ('calendars.view', 'appointments.view', 'appointments.create')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Ops role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Ops'
AND p.key IN ('calendars.view', 'appointments.view', 'appointments.create')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to ReadOnly role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ReadOnly'
AND p.key IN ('calendars.view', 'appointments.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Add calendars feature flag (enabled by default)
INSERT INTO feature_flags (key, description, enabled)
VALUES ('calendars', 'Enable calendars, appointment types, and public booking functionality', true)
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;