/*
  # Add Calendar Settings Granular Permissions

  1. Schema Changes
    - Add `active` column to `calendars` table (boolean, default true)
    
  2. New Permissions
    - `calendars.manage_all` - Manage all calendars in the organization
    - `calendars.manage_department` - Manage calendars in own department
    - `calendars.manage_own` - Manage own calendars only
    - `appointment_types.manage_all` - Manage all appointment types
    - `appointment_types.manage_department` - Manage appointment types in department
    - `appointment_types.manage_own` - Manage own appointment types
    - `availability.manage_own` - Manage own availability
    - `availability.manage_department` - Manage department availability
    - `google_connections.view` - View Google connections
    - `google_connections.manage_own` - Manage own Google connection

  3. Role Permission Mappings
    - SuperAdmin/Admin: All calendar management permissions
    - Manager: Department + own permissions
    - Sales/Ops: Own permissions only
    - ReadOnly: View only (existing calendars.view)
*/

-- Add active column to calendars table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendars' AND column_name = 'active'
  ) THEN
    ALTER TABLE calendars ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Insert new granular calendar permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('calendars.manage_all', 'Manage all calendars in the organization', 'calendars'),
  ('calendars.manage_department', 'Manage calendars in own department', 'calendars'),
  ('calendars.manage_own', 'Manage own calendars only', 'calendars'),
  ('appointment_types.manage_all', 'Manage all appointment types', 'calendars'),
  ('appointment_types.manage_department', 'Manage appointment types in department', 'calendars'),
  ('appointment_types.manage_own', 'Manage own appointment types', 'calendars'),
  ('availability.manage_own', 'Manage own availability settings', 'calendars'),
  ('availability.manage_department', 'Manage department availability settings', 'calendars'),
  ('google_connections.view', 'View Google Calendar connections', 'calendars'),
  ('google_connections.manage_own', 'Manage own Google Calendar connection', 'calendars')
ON CONFLICT (key) DO NOTHING;

-- Assign all permissions to SuperAdmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SuperAdmin'
AND p.key IN (
  'calendars.manage_all', 'calendars.manage_department', 'calendars.manage_own',
  'appointment_types.manage_all', 'appointment_types.manage_department', 'appointment_types.manage_own',
  'availability.manage_own', 'availability.manage_department',
  'google_connections.view', 'google_connections.manage_own'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign all permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Admin'
AND p.key IN (
  'calendars.manage_all', 'calendars.manage_department', 'calendars.manage_own',
  'appointment_types.manage_all', 'appointment_types.manage_department', 'appointment_types.manage_own',
  'availability.manage_own', 'availability.manage_department',
  'google_connections.view', 'google_connections.manage_own'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign department + own permissions to Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Manager'
AND p.key IN (
  'calendars.manage_department', 'calendars.manage_own',
  'appointment_types.manage_department', 'appointment_types.manage_own',
  'availability.manage_own', 'availability.manage_department',
  'google_connections.view', 'google_connections.manage_own'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign own permissions to Sales role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Sales'
AND p.key IN (
  'calendars.manage_own',
  'appointment_types.manage_own',
  'availability.manage_own',
  'google_connections.view', 'google_connections.manage_own'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign own permissions to Ops role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Ops'
AND p.key IN (
  'calendars.manage_own',
  'appointment_types.manage_own',
  'availability.manage_own',
  'google_connections.view', 'google_connections.manage_own'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ReadOnly role only has calendars.view (already assigned)

-- Create index on calendars.active for filtering
CREATE INDEX IF NOT EXISTS idx_calendars_active ON calendars(active) WHERE active = true;