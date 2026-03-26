/*
  # Support Ticket System for Client Portal

  ## Overview
  Creates a full support ticket system for the client portal, allowing clients to submit
  categorized support tickets with file attachments, and staff to manage/respond to them.

  ## New Tables

  ### project_support_tickets
  - Core support ticket record linked to a project
  - Status lifecycle: new -> in_review -> in_progress -> waiting_on_client -> resolved -> closed
  - Client identification: name, email, phone, company, preferred contact method
  - Project context: project status at submission, service category
  - Ticket classification: request type, priority
  - Issue details: subject, description, issue start time, frequency
  - Affected areas: multi-select text array
  - Technical context: browser/device, operating system
  - Attachments: JSONB array of uploaded file references
  - Business impact: impact level, impact notes
  - SLA/expectations: preferred resolution timeframe
  - Internal fields: assigned team, assigned engineer, severity score, SLA deadline

  ### project_support_ticket_comments
  - Threaded comments on support tickets
  - is_internal: true = staff-only notes, false = client-visible messages
  - portal_reply: true = submitted by client through portal

  ### project_support_ticket_audit
  - Immutable audit trail for all status changes, assignments, and key events

  ## Security
  - RLS enabled on all 3 tables
  - Authenticated users can access only their org's records
  - Public access policies for client portal operations (token-verified at app layer)

  ## Permissions
  - projects.support_tickets.view
  - projects.support_tickets.manage
  - projects.support_tickets.assign

  ## Storage
  - support-ticket-attachments bucket for client screenshot uploads
*/

CREATE TABLE IF NOT EXISTS project_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  portal_id uuid REFERENCES project_client_portals(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ticket_number serial,
  client_name text NOT NULL DEFAULT '',
  client_email text,
  client_phone text,
  company_name text DEFAULT '',
  preferred_contact_method text NOT NULL DEFAULT 'email'
    CHECK (preferred_contact_method IN ('email', 'phone', 'slack', 'other')),
  project_status_at_submission text DEFAULT 'in_development'
    CHECK (project_status_at_submission IN ('in_development', 'recently_completed', 'completed_30_plus', 'ongoing_retainer')),
  service_category text NOT NULL DEFAULT 'other'
    CHECK (service_category IN (
      'ai_automation', 'crm_pipeline', 'content_automation', 'integration_api',
      'workflow_automation', 'custom_software', 'data_analytics', 'other'
    )),
  request_type text NOT NULL DEFAULT 'general_support'
    CHECK (request_type IN (
      'bug_issue', 'system_error', 'access_login', 'feature_request',
      'change_request', 'integration_issue', 'performance_issue',
      'security_concern', 'general_support'
    )),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  subject text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  issue_started_at timestamptz,
  frequency text DEFAULT 'one_time'
    CHECK (frequency IN ('one_time', 'intermittent', 'consistent')),
  affected_areas text[] DEFAULT '{}',
  browser_device text CHECK (browser_device IN ('chrome', 'safari', 'edge', 'firefox', 'mobile', 'other') OR browser_device IS NULL),
  operating_system text CHECK (operating_system IN ('windows', 'macos', 'ios', 'android', 'other') OR operating_system IS NULL),
  attachments jsonb DEFAULT '[]'::jsonb,
  business_impact text DEFAULT 'no_impact'
    CHECK (business_impact IN ('no_impact', 'minor_inconvenience', 'slowing_operations', 'blocking_key_processes', 'revenue_impacting')),
  impact_notes text,
  preferred_resolution text DEFAULT 'no_rush'
    CHECK (preferred_resolution IN ('no_rush', 'within_48_hours', 'within_24_hours', 'asap')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_review', 'in_progress', 'waiting_on_client', 'resolved', 'closed')),
  assigned_team text,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  severity_score integer DEFAULT 0,
  sla_deadline timestamptz,
  access_token_hash text,
  source text NOT NULL DEFAULT 'portal'
    CHECK (source IN ('portal', 'internal')),
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org_id ON project_support_tickets(org_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_project_id ON project_support_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON project_support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON project_support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON project_support_tickets(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_token ON project_support_tickets(access_token_hash) WHERE access_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_number ON project_support_tickets(org_id, ticket_number);

ALTER TABLE project_support_tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS project_support_ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES project_support_tickets(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  is_internal boolean NOT NULL DEFAULT true,
  portal_reply boolean NOT NULL DEFAULT false,
  author_type text NOT NULL DEFAULT 'user' CHECK (author_type IN ('user', 'client', 'system')),
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author_name text,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_comments_ticket_id ON project_support_ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_comments_org_id ON project_support_ticket_comments(org_id);

ALTER TABLE project_support_ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS project_support_ticket_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES project_support_tickets(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'client', 'system')),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_audit_ticket_id ON project_support_ticket_audit(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_audit_org_id ON project_support_ticket_audit(org_id);

ALTER TABLE project_support_ticket_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view support tickets"
  ON project_support_tickets FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can create support tickets"
  ON project_support_tickets FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can update support tickets"
  ON project_support_tickets FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Public can submit support tickets"
  ON project_support_tickets FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Public can view support tickets by token"
  ON project_support_tickets FOR SELECT TO anon
  USING (access_token_hash IS NOT NULL);

CREATE POLICY "Public can update support tickets by token"
  ON project_support_tickets FOR UPDATE TO anon
  USING (access_token_hash IS NOT NULL)
  WITH CHECK (access_token_hash IS NOT NULL);

CREATE POLICY "Org members can view ticket comments"
  ON project_support_ticket_comments FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can create ticket comments"
  ON project_support_ticket_comments FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can update their ticket comments"
  ON project_support_ticket_comments FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()) AND author_user_id = auth.uid())
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Public can view client-visible ticket comments"
  ON project_support_ticket_comments FOR SELECT TO anon
  USING (is_internal = false);

CREATE POLICY "Public can submit client ticket comments"
  ON project_support_ticket_comments FOR INSERT TO anon
  WITH CHECK (is_internal = false AND author_type = 'client');

CREATE POLICY "Org members can view ticket audit events"
  ON project_support_ticket_audit FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can insert ticket audit events"
  ON project_support_ticket_audit FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Public can insert ticket audit events"
  ON project_support_ticket_audit FOR INSERT TO anon
  WITH CHECK (true);

INSERT INTO permissions (key, description, module_name)
VALUES
  ('projects.support_tickets.view',   'View project support tickets',       'projects'),
  ('projects.support_tickets.manage', 'Create and manage support tickets',  'projects'),
  ('projects.support_tickets.assign', 'Assign support tickets to engineers','projects')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  v_view_perm_id uuid;
  v_manage_perm_id uuid;
  v_assign_perm_id uuid;
  v_superadmin_role_id uuid;
  v_admin_role_id uuid;
  v_manager_role_id uuid;
  v_user_role_id uuid;
BEGIN
  SELECT id INTO v_view_perm_id FROM permissions WHERE key = 'projects.support_tickets.view';
  SELECT id INTO v_manage_perm_id FROM permissions WHERE key = 'projects.support_tickets.manage';
  SELECT id INTO v_assign_perm_id FROM permissions WHERE key = 'projects.support_tickets.assign';
  SELECT id INTO v_superadmin_role_id FROM roles WHERE name = 'superadmin';
  SELECT id INTO v_admin_role_id FROM roles WHERE name = 'admin';
  SELECT id INTO v_manager_role_id FROM roles WHERE name = 'manager';
  SELECT id INTO v_user_role_id FROM roles WHERE name = 'user';

  IF v_superadmin_role_id IS NOT NULL AND v_view_perm_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_superadmin_role_id, v_view_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_superadmin_role_id, v_manage_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_superadmin_role_id, v_assign_perm_id) ON CONFLICT DO NOTHING;
  END IF;

  IF v_admin_role_id IS NOT NULL AND v_view_perm_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_admin_role_id, v_view_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_admin_role_id, v_manage_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_admin_role_id, v_assign_perm_id) ON CONFLICT DO NOTHING;
  END IF;

  IF v_manager_role_id IS NOT NULL AND v_view_perm_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_manager_role_id, v_view_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_manager_role_id, v_manage_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_manager_role_id, v_assign_perm_id) ON CONFLICT DO NOTHING;
  END IF;

  IF v_user_role_id IS NOT NULL AND v_view_perm_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_user_role_id, v_view_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_user_role_id, v_manage_perm_id) ON CONFLICT DO NOTHING;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-ticket-attachments', 'support-ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload support ticket attachments"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'support-ticket-attachments');

CREATE POLICY "Anyone can view support ticket attachments"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'support-ticket-attachments');

CREATE OR REPLACE FUNCTION update_support_ticket_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_support_ticket_updated_at'
  ) THEN
    CREATE TRIGGER trg_support_ticket_updated_at
      BEFORE UPDATE ON project_support_tickets
      FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();
  END IF;
END $$;
