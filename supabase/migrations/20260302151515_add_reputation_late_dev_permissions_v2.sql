/*
  # Add Reputation Late.dev RBAC Permissions

  New permissions for the revamped reputation module:
  - reputation.sync - Trigger manual review sync
  - reputation.ai_draft - Generate AI reply drafts
  - reputation.delete_reply - Delete review replies (Google Business only)
  - reputation.settings.read - View reputation settings
  - reputation.settings.write - Edit reputation settings
  - reputation.settings.integration - Manage Late.dev integration

  Assigned to roles:
  - SuperAdmin/Admin: all permissions
  - Manager: sync, ai_draft, settings:read
*/

INSERT INTO permissions (key, module_name, description)
VALUES
  ('reputation.sync', 'reputation', 'Trigger manual review sync from Late.dev'),
  ('reputation.ai_draft', 'reputation', 'Generate AI-powered reply drafts using GPT-5.1'),
  ('reputation.delete_reply', 'reputation', 'Delete replies from Google Business reviews'),
  ('reputation.settings.read', 'reputation', 'View reputation module configuration'),
  ('reputation.settings.write', 'reputation', 'Edit reputation module configuration'),
  ('reputation.settings.integration', 'reputation', 'Connect and disconnect Late.dev integration')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('SuperAdmin', 'Admin')
  AND p.key IN (
    'reputation.sync',
    'reputation.ai_draft',
    'reputation.delete_reply',
    'reputation.settings.read',
    'reputation.settings.write',
    'reputation.settings.integration'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
  AND p.key IN (
    'reputation.sync',
    'reputation.ai_draft',
    'reputation.settings.read'
  )
ON CONFLICT DO NOTHING;
