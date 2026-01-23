/*
  # Add Contacts Permissions and Enable Feature Flag

  ## Overview
  Adds additional permissions for contacts module and enables the feature flag.

  ## 1. New Permissions
  - `contacts.merge` - Merge duplicate contacts (Admin/SuperAdmin only)
  - `contacts.export` - Export contacts to CSV
  - `contacts.import` - Import contacts from CSV
  - `contacts.bulk_delete` - Bulk delete contacts (Admin/SuperAdmin only)

  ## 2. Role-Permission Assignments
  - SuperAdmin: All new permissions
  - Admin: All new permissions
  - Manager: export, import
  - Sales: export
  - Ops: export

  ## 3. Feature Flag
  - Enables the contacts feature flag
*/

INSERT INTO permissions (key, description, module_name) VALUES
  ('contacts.merge', 'Merge duplicate contacts', 'contacts'),
  ('contacts.export', 'Export contacts to CSV', 'contacts'),
  ('contacts.import', 'Import contacts from CSV', 'contacts'),
  ('contacts.bulk_delete', 'Bulk delete multiple contacts', 'contacts')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
AND p.key IN ('contacts.merge', 'contacts.export', 'contacts.import', 'contacts.bulk_delete')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Admin'
AND p.key IN ('contacts.merge', 'contacts.export', 'contacts.import', 'contacts.bulk_delete')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Manager'
AND p.key IN ('contacts.export', 'contacts.import')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('Sales', 'Ops')
AND p.key = 'contacts.export'
ON CONFLICT DO NOTHING;

UPDATE feature_flags SET enabled = true WHERE key = 'contacts';
