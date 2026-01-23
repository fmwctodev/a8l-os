/*
  # Add Staff Management Permission Keys

  1. New Permissions
    - `staff.view` - View staff members list
    - `staff.manage` - Edit staff member details
    - `staff.invite` - Invite new staff members
    - `staff.disable` - Disable/enable staff members
    - `staff.reset_password` - Trigger password reset for staff
    - `departments.manage` - Manage departments (create, edit, disable)
    - `audit.view` - View audit logs (SuperAdmin only)

  2. Role Assignments
    - SuperAdmin: All permissions
    - Admin: All except audit.view
    - Manager: staff.view, limited staff.manage (own department only)
    - Sales/Ops: staff.view only
    - ReadOnly: staff.view only

  3. Notes
    - Extends existing users.* permissions with more granular control
    - audit.view is exclusively for SuperAdmin
*/

INSERT INTO public.permissions (key, description, module_name)
VALUES 
  ('staff.view', 'View staff members list', 'Staff'),
  ('staff.manage', 'Edit staff member details', 'Staff'),
  ('staff.invite', 'Invite new staff members', 'Staff'),
  ('staff.disable', 'Disable or enable staff members', 'Staff'),
  ('staff.reset_password', 'Trigger password reset for staff members', 'Staff'),
  ('departments.manage', 'Manage departments (create, edit, disable)', 'Staff'),
  ('audit.view', 'View audit logs and user activity', 'Admin')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'SuperAdmin'
  AND p.key IN ('staff.view', 'staff.manage', 'staff.invite', 'staff.disable', 'staff.reset_password', 'departments.manage', 'audit.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Admin'
  AND p.key IN ('staff.view', 'staff.manage', 'staff.invite', 'staff.disable', 'staff.reset_password', 'departments.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Manager'
  AND p.key IN ('staff.view', 'staff.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Sales', 'Ops', 'ReadOnly')
  AND p.key IN ('staff.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;
