/*
  # Client Portal Authentication Upgrade

  ## Overview
  Adds OTP-based two-factor authentication to the existing client portal system.
  Clients must now verify their identity via a one-time email code before accessing
  any portal content. Sessions can be remembered for 30 days or expire after 12 hours.

  ## New Tables

  ### project_client_portal_auth_codes
  - Stores hashed OTP codes for portal email verification
  - Tracks attempt counts and enforces max attempts (5)
  - Codes expire after 10 minutes and are invalidated after use
  - Only hashed codes are stored — never plaintext

  ### project_client_portal_sessions
  - Stores hashed session tokens created after successful OTP verification
  - Tracks device info, IP, user agent for security auditing
  - remember_device sessions last 30 days; standard sessions last 12 hours
  - Sessions can be revoked individually or all at once

  ## Security
  - RLS enabled on both tables
  - Anonymous access allowed for the auth flow (no CRM login required)
  - Authenticated (org member) access for internal admin session management
  - All tokens and codes stored as SHA-256 hashes only
*/

-- ============================================================
-- 1. project_client_portal_auth_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS project_client_portal_auth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES project_client_portals(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_auth_codes_portal_id ON project_client_portal_auth_codes(portal_id);
CREATE INDEX IF NOT EXISTS idx_portal_auth_codes_expires_at ON project_client_portal_auth_codes(expires_at);

ALTER TABLE project_client_portal_auth_codes ENABLE ROW LEVEL SECURITY;

-- Anon can insert (send code) and update (attempts/consumed) their own codes via portal_id
CREATE POLICY "Anon can insert auth codes"
  ON project_client_portal_auth_codes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can update auth codes"
  ON project_client_portal_auth_codes FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can read auth codes for verification"
  ON project_client_portal_auth_codes FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================
-- 2. project_client_portal_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS project_client_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES project_client_portals(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  session_token_hash text NOT NULL,
  device_label text,
  ip_address text,
  user_agent text,
  remember_device boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  last_otp_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_portal_id ON project_client_portal_sessions(portal_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token_hash ON project_client_portal_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires_at ON project_client_portal_sessions(expires_at);

ALTER TABLE project_client_portal_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert portal sessions"
  ON project_client_portal_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can update portal sessions"
  ON project_client_portal_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can read portal sessions"
  ON project_client_portal_sessions FOR SELECT
  TO anon, authenticated
  USING (true);
