/*
  # Client Portal — contact-scoped refactor (schema)

  Replaces the three `project_client_portal_*` tables with four new
  contact-scoped `client_portal_*` tables so that one contact with multiple
  projects has exactly one portal login and sees all of their projects in
  one session.

  ## New tables (contact-scoped)

  - `client_portal_accounts`   — one row per (org_id, contact_id). The portal user.
  - `client_portal_auth_codes` — 6-digit OTP codes, 10 min expiry, 5 attempts.
  - `client_portal_sessions`   — contact sessions, 12h / 30d with remember.
  - `client_portal_events`     — audit log for all portal interactions.

  ## Old tables dropped

  - `project_client_portal_events`
  - `project_client_portal_sessions`
  - `project_client_portal_auth_codes`
  - `project_client_portals`

  Production has zero rows in the old tables (verified earlier in this session
  via Supabase MCP). A guard `RAISE EXCEPTION` aborts the migration if any
  data is found so we never silently drop real portal access.

  ## Permissions

  The existing `projects.client_portal.manage` and `projects.client_portal.view`
  permission rows are preserved — the new "Send portal invite" admin button
  will gate on `projects.client_portal.manage`.
*/

-- ============================================================
-- 0. Safety guard — refuse to drop any real portal data
-- ============================================================
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM project_client_portals;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: project_client_portals contains % row(s). Refusing to drop. Review data before running.', v_count;
  END IF;
END $$;

-- ============================================================
-- 1. client_portal_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS client_portal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  invite_sent_at timestamptz,
  invite_count int NOT NULL DEFAULT 0,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_client_portal_accounts_org_id ON client_portal_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_accounts_contact_id ON client_portal_accounts(contact_id);

ALTER TABLE client_portal_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view portal accounts for their org"
  ON client_portal_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.organization_id = client_portal_accounts.org_id
    )
  );

CREATE POLICY "Org members can insert portal accounts for their org"
  ON client_portal_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.organization_id = client_portal_accounts.org_id
    )
  );

CREATE POLICY "Org members can update portal accounts for their org"
  ON client_portal_accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.organization_id = client_portal_accounts.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.organization_id = client_portal_accounts.org_id
    )
  );

-- ============================================================
-- 2. client_portal_auth_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS client_portal_auth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_portal_auth_codes_active
  ON client_portal_auth_codes(org_id, contact_id)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;

ALTER TABLE client_portal_auth_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view auth codes for their org"
  ON client_portal_auth_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.organization_id = client_portal_auth_codes.org_id
    )
  );

-- Anonymous callers go through the edge function which uses the service role,
-- so we don't expose INSERT/UPDATE to anon directly. Edge function bypasses RLS.

-- ============================================================
-- 3. client_portal_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS client_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  remember_device boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  last_otp_verified_at timestamptz,
  revoked_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_portal_sessions_active
  ON client_portal_sessions(org_id, contact_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_portal_sessions_token_hash
  ON client_portal_sessions(session_token_hash);

ALTER TABLE client_portal_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view sessions for their org"
  ON client_portal_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.organization_id = client_portal_sessions.org_id
    )
  );

-- ============================================================
-- 4. client_portal_events
-- ============================================================
CREATE TABLE IF NOT EXISTS client_portal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES client_portal_accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_portal_events_account_id ON client_portal_events(account_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_events_event_type ON client_portal_events(event_type);
CREATE INDEX IF NOT EXISTS idx_client_portal_events_project_id ON client_portal_events(project_id);

ALTER TABLE client_portal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view portal events for their org"
  ON client_portal_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.organization_id = client_portal_events.org_id
    )
  );

-- ============================================================
-- 5. Drop old per-project portal tables
-- ============================================================
DROP TABLE IF EXISTS project_client_portal_events CASCADE;
DROP TABLE IF EXISTS project_client_portal_sessions CASCADE;
DROP TABLE IF EXISTS project_client_portal_auth_codes CASCADE;
DROP TABLE IF EXISTS project_client_portals CASCADE;
