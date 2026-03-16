/*
  # Project Client Portal System

  ## Overview
  Creates the secure client portal infrastructure for project change requests, including:
  - Portal access records tied to a project, contact, and org via a hashed token
  - Portal event audit log for every client interaction
  - Extensions to project_change_requests: client-visible assessment fields and client_summary
  - Extensions to project_change_request_comments: client_visible and portal_reply flags

  ## New Tables

  ### project_client_portals
  - One portal record per project/contact/org combination
  - Stores SHA-256 hashed token only (never plaintext)
  - Tracks status (active/revoked/expired), expiry, and last_accessed_at
  - Created by an internal CRM user when generating the portal link

  ### project_client_portal_events
  - Immutable event log for all portal interactions
  - Records event_type, IP address, user agent, metadata
  - Used for audit trail and automation triggers

  ## Modified Tables

  ### project_change_requests
  - Adds client_summary: text shown to client (separate from internal_summary)
  - Adds cost_impact_visible_to_client: boolean controlling cost display in portal
  - Adds timeline_impact_visible_to_client: boolean controlling timeline display in portal

  ### project_change_request_comments
  - Adds client_visible: boolean (true = shown in portal)
  - Adds portal_reply: boolean (true = submitted by client via portal)

  ## Security
  - RLS enabled on both new tables
  - Uses organization_id on users table to match org membership
  - Public (anon) can insert portal events and read active portals for token verification

  ## Permissions
  - projects.client_portal.manage
  - projects.client_portal.view
*/

-- ============================================================
-- 1. project_client_portals
-- ============================================================
CREATE TABLE IF NOT EXISTS project_client_portals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  portal_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at timestamptz,
  last_accessed_at timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_client_portals_org_id ON project_client_portals(org_id);
CREATE INDEX IF NOT EXISTS idx_project_client_portals_project_id ON project_client_portals(project_id);
CREATE INDEX IF NOT EXISTS idx_project_client_portals_token_hash ON project_client_portals(portal_token_hash);

ALTER TABLE project_client_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view portals for their org"
  ON project_client_portals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.organization_id = project_client_portals.org_id
    )
  );

CREATE POLICY "Org members can insert portals for their org"
  ON project_client_portals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.organization_id = project_client_portals.org_id
    )
  );

CREATE POLICY "Org members can update portals for their org"
  ON project_client_portals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.organization_id = project_client_portals.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.organization_id = project_client_portals.org_id
    )
  );

CREATE POLICY "Public can read active portal for token verification"
  ON project_client_portals FOR SELECT
  TO anon
  USING (status = 'active');

CREATE POLICY "Public can update last_accessed_at on active portal"
  ON project_client_portals FOR UPDATE
  TO anon
  USING (status = 'active')
  WITH CHECK (status = 'active');

-- ============================================================
-- 2. project_client_portal_events
-- ============================================================
CREATE TABLE IF NOT EXISTS project_client_portal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES project_client_portals(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_events_portal_id ON project_client_portal_events(portal_id);
CREATE INDEX IF NOT EXISTS idx_portal_events_project_id ON project_client_portal_events(project_id);
CREATE INDEX IF NOT EXISTS idx_portal_events_event_type ON project_client_portal_events(event_type);

ALTER TABLE project_client_portal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view portal events for their org"
  ON project_client_portal_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_client_portals pcp
      JOIN users u ON u.organization_id = pcp.org_id
      WHERE pcp.id = project_client_portal_events.portal_id
        AND u.id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Anyone can insert portal events"
  ON project_client_portal_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ============================================================
-- 3. Extend project_change_requests
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_change_requests' AND column_name = 'client_summary'
  ) THEN
    ALTER TABLE project_change_requests ADD COLUMN client_summary text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_change_requests' AND column_name = 'cost_impact_visible_to_client'
  ) THEN
    ALTER TABLE project_change_requests ADD COLUMN cost_impact_visible_to_client boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_change_requests' AND column_name = 'timeline_impact_visible_to_client'
  ) THEN
    ALTER TABLE project_change_requests ADD COLUMN timeline_impact_visible_to_client boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 4. Extend project_change_request_comments
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_change_request_comments' AND column_name = 'client_visible'
  ) THEN
    ALTER TABLE project_change_request_comments ADD COLUMN client_visible boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_change_request_comments' AND column_name = 'portal_reply'
  ) THEN
    ALTER TABLE project_change_request_comments ADD COLUMN portal_reply boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 5. Permissions
-- ============================================================
DO $$
DECLARE
  v_super_admin_id uuid;
  v_admin_id uuid;
  v_manager_id uuid;
  v_perm_manage_id uuid;
  v_perm_view_id uuid;
BEGIN
  SELECT id INTO v_super_admin_id FROM roles WHERE name = 'SuperAdmin' LIMIT 1;
  SELECT id INTO v_admin_id FROM roles WHERE name = 'Admin' LIMIT 1;
  SELECT id INTO v_manager_id FROM roles WHERE name = 'Manager' LIMIT 1;

  INSERT INTO permissions (key, description, module_name, created_at)
  VALUES
    ('projects.client_portal.manage', 'Generate, revoke and manage client portal links for projects', 'projects', now()),
    ('projects.client_portal.view', 'View client portal status and events for projects', 'projects', now())
  ON CONFLICT (key) DO NOTHING;

  SELECT id INTO v_perm_manage_id FROM permissions WHERE key = 'projects.client_portal.manage';
  SELECT id INTO v_perm_view_id FROM permissions WHERE key = 'projects.client_portal.view';

  IF v_super_admin_id IS NOT NULL AND v_perm_manage_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_super_admin_id, v_perm_manage_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_super_admin_id IS NOT NULL AND v_perm_view_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_super_admin_id, v_perm_view_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_admin_id IS NOT NULL AND v_perm_manage_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_admin_id, v_perm_manage_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_admin_id IS NOT NULL AND v_perm_view_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_admin_id, v_perm_view_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_manager_id IS NOT NULL AND v_perm_view_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_manager_id, v_perm_view_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
