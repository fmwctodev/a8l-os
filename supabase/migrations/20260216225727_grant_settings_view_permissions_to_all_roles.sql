/*
  # Grant Settings Module View Permissions to All Roles

  1. Changes
    - Grants `custom_fields.view` to Ops and Sales roles
    - Grants `scoring.view` to ReadOnly role
    - Grants `custom_values.view` to Ops, Sales, and ReadOnly roles
    - Grants `integrations.view` to ReadOnly role

  2. Purpose
    - Ensures all user roles can access the following Settings modules:
      My Profile, Conversations, Calendars, Email Services,
      Custom Fields, Lead Scoring, Custom Values, and Integrations
    - Other roles (SuperAdmin, Admin, Manager) already have these permissions

  3. Important Notes
    - Uses ON CONFLICT DO NOTHING to safely skip already-existing grants
    - Only adds `.view` level permissions (not `.manage`)
*/

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE
  (r.name = 'Ops' AND p.key IN ('custom_fields.view', 'custom_values.view'))
  OR (r.name = 'Sales' AND p.key IN ('custom_fields.view', 'custom_values.view'))
  OR (r.name = 'ReadOnly' AND p.key IN ('scoring.view', 'custom_values.view', 'integrations.view'))
ON CONFLICT DO NOTHING;
