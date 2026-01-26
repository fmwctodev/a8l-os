/*
  # Add Social Approval Permission

  1. New Permission
    - `marketing.social.approve` - Permission to approve/deny social posts

  2. Assignment
    - Assigned to Admin and Manager roles by default
*/

INSERT INTO permissions (key, description, module_name)
VALUES ('marketing.social.approve', 'Approve or deny scheduled social posts', 'marketing')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('Admin', 'Manager')
AND p.key = 'marketing.social.approve'
ON CONFLICT DO NOTHING;
