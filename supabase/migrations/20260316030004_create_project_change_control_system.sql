/*
  # Project Change Control System

  ## Overview
  Creates a full change control system for projects, including:
  - Change requests (submitted by clients via tokenized public form or internally by staff)
  - Change orders (standalone documents clients sign to approve scope changes)
  - Comments (internal notes and client-visible messages)
  - Audit trail (all status transitions and key events)
  - Storage bucket for change order signatures

  ## New Tables

  ### project_change_requests
  - Core change request record linking to a project
  - Status lifecycle: submitted → under_review → needs_more_info → quoted_awaiting_approval → approved/rejected → scheduled → in_progress → completed/cancelled
  - Stores client contact info, request details, internal assessment, and change impact fields
  - access_token_hash: SHA-256 of the raw client portal token (never stored plaintext)
  - source: 'public_form' | 'internal' | 'ai'

  ### project_change_orders
  - Standalone document generated from an approved/quoted change request
  - Mirrors proposal_signature_requests pattern for e-signature
  - frozen_html_snapshot / frozen_document_hash for tamper-evident signing
  - access_token_hash: SHA-256 of the raw token embedded in the client signing URL

  ### project_change_request_comments
  - Threaded comments on a change request
  - is_internal: true = staff-only, false = visible to client on status portal

  ### project_change_request_audit
  - Immutable audit trail: every status transition, assignment, comment, and key event

  ## Security
  - RLS enabled on all 4 tables
  - Authenticated users can access only their org's records
  - Public access policies for client portal operations (token-verified at application layer)

  ## Permissions
  - projects.change_requests.view
  - projects.change_requests.manage
  - projects.change_requests.approve
*/

-- ============================================================
-- 1. project_change_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS project_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Client contact info (may differ from project contact if submitted via public form)
  client_name text NOT NULL DEFAULT '',
  client_email text,
  client_phone text,

  -- Request details
  title text NOT NULL DEFAULT '',
  request_type text NOT NULL DEFAULT 'scope'
    CHECK (request_type IN ('scope', 'timeline', 'design', 'feature', 'bugfix', 'support', 'other')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  description text NOT NULL DEFAULT '',
  requested_due_date date,
  attachments jsonb DEFAULT '[]'::jsonb,

  -- Lifecycle status
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN (
      'submitted', 'under_review', 'needs_more_info', 'quoted_awaiting_approval',
      'approved', 'rejected', 'scheduled', 'in_progress', 'completed', 'cancelled'
    )),

  -- Internal assessment (filled by staff)
  scope_impact text,
  timeline_impact_days integer DEFAULT 0,
  cost_impact numeric(12,2) DEFAULT 0,
  internal_summary text,

  -- Client decision tracking
  client_decision text CHECK (client_decision IN ('pending', 'approved', 'declined') OR client_decision IS NULL),

  -- Assignment
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  approver_user_id uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Source and token for client portal access
  source text NOT NULL DEFAULT 'internal'
    CHECK (source IN ('public_form', 'internal', 'ai')),
  access_token_hash text,

  -- Timestamps
  reviewed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_change_requests_org_id ON project_change_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_project_change_requests_project_id ON project_change_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_project_change_requests_status ON project_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_project_change_requests_token ON project_change_requests(access_token_hash) WHERE access_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_change_requests_reviewer ON project_change_requests(reviewer_user_id) WHERE reviewer_user_id IS NOT NULL;

ALTER TABLE project_change_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. project_change_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS project_change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  change_request_id uuid NOT NULL REFERENCES project_change_requests(id) ON DELETE CASCADE,

  -- Document content
  title text NOT NULL DEFAULT '',
  description text,
  scope_changes text,
  timeline_extension_days integer DEFAULT 0,
  cost_amount numeric(12,2) DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  terms_and_conditions text,

  -- Signature flow status
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'declined', 'voided')),

  -- Frozen snapshot for tamper-evident signing
  frozen_html_snapshot text,
  frozen_document_hash text,

  -- Signature data
  signer_name text,
  signer_email text,
  access_token_hash text,
  expires_at timestamptz,

  -- Signature result
  signature_type text CHECK (signature_type IN ('typed', 'drawn') OR signature_type IS NULL),
  signature_text text,
  signature_image_url text,
  consent_text text,
  ip_address text,
  user_agent text,

  -- Timestamps
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,

  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_change_orders_org_id ON project_change_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_project_change_orders_project_id ON project_change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_change_orders_request_id ON project_change_orders(change_request_id);
CREATE INDEX IF NOT EXISTS idx_project_change_orders_status ON project_change_orders(status);
CREATE INDEX IF NOT EXISTS idx_project_change_orders_token ON project_change_orders(access_token_hash) WHERE access_token_hash IS NOT NULL;

ALTER TABLE project_change_orders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. project_change_request_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS project_change_request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  change_request_id uuid NOT NULL REFERENCES project_change_requests(id) ON DELETE CASCADE,

  body text NOT NULL DEFAULT '',
  is_internal boolean NOT NULL DEFAULT true,
  author_type text NOT NULL DEFAULT 'user' CHECK (author_type IN ('user', 'client', 'system')),
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author_name text,
  attachments jsonb DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcr_comments_request_id ON project_change_request_comments(change_request_id);
CREATE INDEX IF NOT EXISTS idx_pcr_comments_org_id ON project_change_request_comments(org_id);

ALTER TABLE project_change_request_comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. project_change_request_audit
-- ============================================================
CREATE TABLE IF NOT EXISTS project_change_request_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  change_request_id uuid NOT NULL REFERENCES project_change_requests(id) ON DELETE CASCADE,

  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'client', 'system')),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text,
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcr_audit_request_id ON project_change_request_audit(change_request_id);
CREATE INDEX IF NOT EXISTS idx_pcr_audit_org_id ON project_change_request_audit(org_id);

ALTER TABLE project_change_request_audit ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS Policies — project_change_requests
-- ============================================================

-- Authenticated users: view own org's requests
CREATE POLICY "Org members can view change requests"
  ON project_change_requests FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Authenticated users: insert change requests (internal creation)
CREATE POLICY "Org members can create change requests"
  ON project_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Authenticated users: update change requests in their org
CREATE POLICY "Org members can update change requests"
  ON project_change_requests FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Public: allow anonymous insert (client form submissions) — token validation at app layer
CREATE POLICY "Public can submit change requests"
  ON project_change_requests FOR INSERT
  TO anon
  WITH CHECK (true);

-- Public: allow anonymous select by access_token_hash (app layer verifies token)
CREATE POLICY "Public can view change requests by token"
  ON project_change_requests FOR SELECT
  TO anon
  USING (access_token_hash IS NOT NULL);

-- Public: allow anonymous update by access_token_hash (for status acknowledgements)
CREATE POLICY "Public can update change requests by token"
  ON project_change_requests FOR UPDATE
  TO anon
  USING (access_token_hash IS NOT NULL)
  WITH CHECK (access_token_hash IS NOT NULL);

-- ============================================================
-- 6. RLS Policies — project_change_orders
-- ============================================================

CREATE POLICY "Org members can view change orders"
  ON project_change_orders FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can create change orders"
  ON project_change_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can update change orders"
  ON project_change_orders FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Public: allow reading change orders by token (for client sign page)
CREATE POLICY "Public can view change orders by token"
  ON project_change_orders FOR SELECT
  TO anon
  USING (access_token_hash IS NOT NULL);

-- Public: allow updating change orders by token (for signing/declining)
CREATE POLICY "Public can update change orders by token"
  ON project_change_orders FOR UPDATE
  TO anon
  USING (access_token_hash IS NOT NULL)
  WITH CHECK (access_token_hash IS NOT NULL);

-- ============================================================
-- 7. RLS Policies — project_change_request_comments
-- ============================================================

CREATE POLICY "Org members can view comments"
  ON project_change_request_comments FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can create comments"
  ON project_change_request_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can update their comments"
  ON project_change_request_comments FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND author_user_id = auth.uid()
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Public: allow reading non-internal comments by change_request_id (client portal)
CREATE POLICY "Public can view client-visible comments"
  ON project_change_request_comments FOR SELECT
  TO anon
  USING (is_internal = false);

-- Public: allow inserting client comments (author_type = 'client')
CREATE POLICY "Public can submit client comments"
  ON project_change_request_comments FOR INSERT
  TO anon
  WITH CHECK (is_internal = false AND author_type = 'client');

-- ============================================================
-- 8. RLS Policies — project_change_request_audit
-- ============================================================

CREATE POLICY "Org members can view audit events"
  ON project_change_request_audit FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert audit events"
  ON project_change_request_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Public: allow inserting audit events (for client-side signing actions)
CREATE POLICY "Public can insert audit events"
  ON project_change_request_audit FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================================
-- 9. Permissions
-- ============================================================

INSERT INTO permissions (key, description, module_name)
VALUES
  ('projects.change_requests.view',    'View project change requests',    'projects'),
  ('projects.change_requests.manage',  'Create and manage change requests', 'projects'),
  ('projects.change_requests.approve', 'Approve or reject change requests', 'projects')
ON CONFLICT (key) DO NOTHING;

-- Assign to roles: superadmin and admin get all 3; manager gets view+manage; user gets view
DO $$
DECLARE
  v_view_perm_id uuid;
  v_manage_perm_id uuid;
  v_approve_perm_id uuid;
  v_superadmin_role_id uuid;
  v_admin_role_id uuid;
  v_manager_role_id uuid;
  v_user_role_id uuid;
BEGIN
  SELECT id INTO v_view_perm_id FROM permissions WHERE key = 'projects.change_requests.view';
  SELECT id INTO v_manage_perm_id FROM permissions WHERE key = 'projects.change_requests.manage';
  SELECT id INTO v_approve_perm_id FROM permissions WHERE key = 'projects.change_requests.approve';
  SELECT id INTO v_superadmin_role_id FROM roles WHERE name = 'superadmin';
  SELECT id INTO v_admin_role_id FROM roles WHERE name = 'admin';
  SELECT id INTO v_manager_role_id FROM roles WHERE name = 'manager';
  SELECT id INTO v_user_role_id FROM roles WHERE name = 'user';

  -- superadmin
  IF v_superadmin_role_id IS NOT NULL AND v_view_perm_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_superadmin_role_id, v_view_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_superadmin_role_id, v_manage_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_superadmin_role_id, v_approve_perm_id) ON CONFLICT DO NOTHING;
  END IF;

  -- admin
  IF v_admin_role_id IS NOT NULL AND v_view_perm_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_admin_role_id, v_view_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_admin_role_id, v_manage_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_admin_role_id, v_approve_perm_id) ON CONFLICT DO NOTHING;
  END IF;

  -- manager
  IF v_manager_role_id IS NOT NULL AND v_view_perm_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_manager_role_id, v_view_perm_id) ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_manager_role_id, v_manage_perm_id) ON CONFLICT DO NOTHING;
  END IF;

  -- user
  IF v_user_role_id IS NOT NULL AND v_view_perm_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_user_role_id, v_view_perm_id) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 10. Storage bucket for change order signatures
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('change-order-signatures', 'change-order-signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads for signature images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies
    WHERE bucket_id = 'change-order-signatures' AND name = 'Allow public uploads'
  ) THEN
    INSERT INTO storage.policies (name, bucket_id, operation, definition)
    VALUES (
      'Allow public uploads',
      'change-order-signatures',
      'INSERT',
      '{"check": "true"}'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
