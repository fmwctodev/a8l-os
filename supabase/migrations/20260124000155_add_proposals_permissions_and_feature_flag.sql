/*
  # Add Proposals Permissions and Feature Flag

  This migration adds:
  1. Feature flag for the Proposals module
  2. Permissions for proposals management
  3. Permissions for meeting transcriptions
  4. Role-permission assignments

  ## Permissions Added

  ### Proposals Permissions
  - proposals.view - View proposals
  - proposals.create - Create new proposals
  - proposals.edit - Edit proposal content
  - proposals.send - Send proposals to clients
  - proposals.delete - Delete proposals
  - proposals.ai_generate - Use AI to generate proposal content
  - proposal_templates.manage - Manage proposal templates

  ### Meeting Transcriptions Permissions
  - meetings.view - View meeting transcriptions
  - meetings.import - Import meetings from Google Meet
  - meetings.edit - Edit meeting notes and links
  - meetings.delete - Delete meeting transcriptions

  ## Role Assignments
  - SuperAdmin: All permissions
  - Admin: All permissions
  - Manager: All except delete
  - Sales: View, create, edit, send, AI generate, view/import meetings
  - Support: View only
*/

-- Insert feature flag for proposals module
INSERT INTO feature_flags (key, enabled, description)
VALUES ('proposals', true, 'Proposals module with AI-powered generation and meeting integration')
ON CONFLICT (key) DO UPDATE SET enabled = true;

-- Insert proposals permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('proposals.view', 'View proposals and proposal details', 'proposals'),
  ('proposals.create', 'Create new proposals', 'proposals'),
  ('proposals.edit', 'Edit proposal content and sections', 'proposals'),
  ('proposals.send', 'Send proposals to clients', 'proposals'),
  ('proposals.delete', 'Delete proposals', 'proposals'),
  ('proposals.ai_generate', 'Use AI to generate proposal content', 'proposals'),
  ('proposal_templates.manage', 'Create and manage proposal templates', 'proposals')
ON CONFLICT (key) DO NOTHING;

-- Insert meeting transcription permissions
INSERT INTO permissions (key, description, module_name) VALUES
  ('meetings.view', 'View meeting transcriptions and recordings', 'proposals'),
  ('meetings.import', 'Import meetings from Google Meet', 'proposals'),
  ('meetings.edit', 'Edit meeting notes and contact links', 'proposals'),
  ('meetings.delete', 'Delete meeting transcriptions', 'proposals')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to roles
DO $$
DECLARE
  super_admin_id uuid;
  admin_id uuid;
  manager_id uuid;
  sales_id uuid;
  support_id uuid;
  perm_prop_view uuid;
  perm_prop_create uuid;
  perm_prop_edit uuid;
  perm_prop_send uuid;
  perm_prop_delete uuid;
  perm_prop_ai uuid;
  perm_templates uuid;
  perm_meet_view uuid;
  perm_meet_import uuid;
  perm_meet_edit uuid;
  perm_meet_delete uuid;
BEGIN
  -- Get role IDs
  SELECT id INTO super_admin_id FROM roles WHERE name = 'SuperAdmin';
  SELECT id INTO admin_id FROM roles WHERE name = 'Admin';
  SELECT id INTO manager_id FROM roles WHERE name = 'Manager';
  SELECT id INTO sales_id FROM roles WHERE name = 'Sales';
  SELECT id INTO support_id FROM roles WHERE name = 'Support';

  -- Get proposals permission IDs
  SELECT id INTO perm_prop_view FROM permissions WHERE key = 'proposals.view';
  SELECT id INTO perm_prop_create FROM permissions WHERE key = 'proposals.create';
  SELECT id INTO perm_prop_edit FROM permissions WHERE key = 'proposals.edit';
  SELECT id INTO perm_prop_send FROM permissions WHERE key = 'proposals.send';
  SELECT id INTO perm_prop_delete FROM permissions WHERE key = 'proposals.delete';
  SELECT id INTO perm_prop_ai FROM permissions WHERE key = 'proposals.ai_generate';
  SELECT id INTO perm_templates FROM permissions WHERE key = 'proposal_templates.manage';

  -- Get meetings permission IDs
  SELECT id INTO perm_meet_view FROM permissions WHERE key = 'meetings.view';
  SELECT id INTO perm_meet_import FROM permissions WHERE key = 'meetings.import';
  SELECT id INTO perm_meet_edit FROM permissions WHERE key = 'meetings.edit';
  SELECT id INTO perm_meet_delete FROM permissions WHERE key = 'meetings.delete';

  -- SuperAdmin: all permissions
  IF super_admin_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (super_admin_id, perm_prop_view),
      (super_admin_id, perm_prop_create),
      (super_admin_id, perm_prop_edit),
      (super_admin_id, perm_prop_send),
      (super_admin_id, perm_prop_delete),
      (super_admin_id, perm_prop_ai),
      (super_admin_id, perm_templates),
      (super_admin_id, perm_meet_view),
      (super_admin_id, perm_meet_import),
      (super_admin_id, perm_meet_edit),
      (super_admin_id, perm_meet_delete)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Admin: all permissions
  IF admin_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (admin_id, perm_prop_view),
      (admin_id, perm_prop_create),
      (admin_id, perm_prop_edit),
      (admin_id, perm_prop_send),
      (admin_id, perm_prop_delete),
      (admin_id, perm_prop_ai),
      (admin_id, perm_templates),
      (admin_id, perm_meet_view),
      (admin_id, perm_meet_import),
      (admin_id, perm_meet_edit),
      (admin_id, perm_meet_delete)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Manager: all except delete
  IF manager_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (manager_id, perm_prop_view),
      (manager_id, perm_prop_create),
      (manager_id, perm_prop_edit),
      (manager_id, perm_prop_send),
      (manager_id, perm_prop_ai),
      (manager_id, perm_templates),
      (manager_id, perm_meet_view),
      (manager_id, perm_meet_import),
      (manager_id, perm_meet_edit)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Sales: view, create, edit, send, AI generate, view/import meetings
  IF sales_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (sales_id, perm_prop_view),
      (sales_id, perm_prop_create),
      (sales_id, perm_prop_edit),
      (sales_id, perm_prop_send),
      (sales_id, perm_prop_ai),
      (sales_id, perm_meet_view),
      (sales_id, perm_meet_import),
      (sales_id, perm_meet_edit)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Support: view only
  IF support_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES
      (support_id, perm_prop_view),
      (support_id, perm_meet_view)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed default proposal templates
INSERT INTO proposal_templates (org_id, name, description, content, category, is_default, variables, created_by)
SELECT 
  o.id,
  'Professional Services Proposal',
  'Standard template for professional services engagements',
  E'# {{company_name}} Proposal\n\n## Executive Summary\n{{executive_summary}}\n\n## Scope of Work\n{{scope}}\n\n## Deliverables\n{{deliverables}}\n\n## Timeline\n{{timeline}}\n\n## Investment\n{{pricing}}\n\n## Terms & Conditions\n{{terms}}',
  'services',
  true,
  '[{"key": "company_name", "label": "Company Name", "type": "text"}, {"key": "executive_summary", "label": "Executive Summary", "type": "textarea"}, {"key": "scope", "label": "Scope of Work", "type": "textarea"}, {"key": "deliverables", "label": "Deliverables", "type": "textarea"}, {"key": "timeline", "label": "Timeline", "type": "textarea"}, {"key": "pricing", "label": "Pricing Details", "type": "textarea"}, {"key": "terms", "label": "Terms", "type": "textarea"}]'::jsonb,
  u.id
FROM organizations o
CROSS JOIN LATERAL (
  SELECT id FROM users WHERE organization_id = o.id LIMIT 1
) u
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_templates pt WHERE pt.org_id = o.id
)
ON CONFLICT DO NOTHING;
