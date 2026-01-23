/*
  # Seed Roles and Permissions

  ## Overview
  Seeds the default roles and permissions for the Autom8ion Lab OS CRM.

  ## 1. Roles (hierarchy_level: lower = more power)
  - SuperAdmin (1): Full system access, bypasses all checks
  - Admin (2): Organization-level admin
  - Manager (3): Team management capabilities
  - Sales (4): Sales-focused permissions
  - Ops (5): Operations-focused permissions
  - ReadOnly (6): View-only access

  ## 2. Permissions by Module
  - Conversations: view, manage
  - Calendars: view, manage
  - Contacts: view, create, edit, delete
  - Opportunities: view, manage
  - Payments: view, manage
  - AI Agents: view, manage
  - Marketing: view, manage
  - Automation: view, manage
  - Media: view, manage
  - Reputation: view, manage
  - Reporting: view, export
  - Users: view, invite, manage
  - Settings: view, manage
  - Audit Logs: view (SuperAdmin only)

  ## 3. Role-Permission Assignments
  - SuperAdmin: All permissions
  - Admin: All except audit_logs.view
  - Manager: Most permissions except user management and settings
  - Sales: Contacts, Opportunities, Calendars, Conversations
  - Ops: Contacts, Automation, Reporting, Media
  - ReadOnly: All view permissions only
*/

INSERT INTO roles (name, description, hierarchy_level) VALUES
  ('SuperAdmin', 'Full system access with ability to view audit logs', 1),
  ('Admin', 'Organization administrator with full management capabilities', 2),
  ('Manager', 'Team manager with department-level access', 3),
  ('Sales', 'Sales representative with customer-facing permissions', 4),
  ('Ops', 'Operations team member with backend permissions', 5),
  ('ReadOnly', 'View-only access across permitted modules', 6)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (key, description, module_name) VALUES
  ('conversations.view', 'View conversations', 'conversations'),
  ('conversations.manage', 'Create, edit, and delete conversations', 'conversations'),
  ('calendars.view', 'View calendars and appointments', 'calendars'),
  ('calendars.manage', 'Create, edit, and delete calendar events', 'calendars'),
  ('contacts.view', 'View contacts', 'contacts'),
  ('contacts.create', 'Create new contacts', 'contacts'),
  ('contacts.edit', 'Edit existing contacts', 'contacts'),
  ('contacts.delete', 'Delete contacts', 'contacts'),
  ('opportunities.view', 'View opportunities and deals', 'opportunities'),
  ('opportunities.manage', 'Create, edit, and manage opportunities', 'opportunities'),
  ('payments.view', 'View payment information', 'payments'),
  ('payments.manage', 'Process and manage payments', 'payments'),
  ('ai_agents.view', 'View AI agent configurations', 'ai_agents'),
  ('ai_agents.manage', 'Configure and manage AI agents', 'ai_agents'),
  ('marketing.view', 'View marketing campaigns', 'marketing'),
  ('marketing.manage', 'Create and manage marketing campaigns', 'marketing'),
  ('automation.view', 'View automation workflows', 'automation'),
  ('automation.manage', 'Create and manage automation workflows', 'automation'),
  ('media.view', 'View media storage', 'media'),
  ('media.manage', 'Upload and manage media files', 'media'),
  ('reputation.view', 'View reputation and reviews', 'reputation'),
  ('reputation.manage', 'Manage reputation responses', 'reputation'),
  ('reporting.view', 'View reports and analytics', 'reporting'),
  ('reporting.export', 'Export reports', 'reporting'),
  ('users.view', 'View user list', 'users'),
  ('users.invite', 'Invite new users', 'users'),
  ('users.manage', 'Manage user roles and status', 'users'),
  ('settings.view', 'View organization settings', 'settings'),
  ('settings.manage', 'Manage organization settings', 'settings'),
  ('audit_logs.view', 'View audit logs (SuperAdmin only)', 'audit_logs')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Admin' AND p.key != 'audit_logs.view'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Manager' AND p.key IN (
  'conversations.view', 'conversations.manage',
  'calendars.view', 'calendars.manage',
  'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.delete',
  'opportunities.view', 'opportunities.manage',
  'payments.view',
  'ai_agents.view',
  'marketing.view', 'marketing.manage',
  'automation.view', 'automation.manage',
  'media.view', 'media.manage',
  'reputation.view', 'reputation.manage',
  'reporting.view', 'reporting.export',
  'users.view',
  'settings.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Sales' AND p.key IN (
  'conversations.view', 'conversations.manage',
  'calendars.view', 'calendars.manage',
  'contacts.view', 'contacts.create', 'contacts.edit',
  'opportunities.view', 'opportunities.manage',
  'payments.view',
  'reputation.view',
  'reporting.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Ops' AND p.key IN (
  'contacts.view', 'contacts.create', 'contacts.edit',
  'automation.view', 'automation.manage',
  'media.view', 'media.manage',
  'reporting.view', 'reporting.export',
  'ai_agents.view'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ReadOnly' AND p.key LIKE '%.view'
ON CONFLICT DO NOTHING;

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('conversations', false, 'Conversations module'),
  ('calendars', false, 'Calendars module'),
  ('contacts', false, 'Contacts module'),
  ('opportunities', false, 'Opportunities module'),
  ('payments', false, 'Payments module'),
  ('ai_agents', false, 'AI Agents module'),
  ('marketing', false, 'Marketing module'),
  ('automation', false, 'Automation module'),
  ('media', false, 'Media Storage module'),
  ('reputation', false, 'Reputation module'),
  ('reporting', false, 'Reporting module')
ON CONFLICT (key) DO NOTHING;