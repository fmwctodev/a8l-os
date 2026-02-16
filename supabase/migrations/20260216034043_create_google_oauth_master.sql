/*
  # Create Google OAuth Master Table

  Unified token storage for all Google OAuth connections (Gmail, Calendar, Drive).
  Prevents token invalidation when connecting multiple Google services.

  1. New Tables
    - `google_oauth_master`
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `user_id` (uuid, FK to users, unique)
      - `email` (text, Google account email)
      - `encrypted_refresh_token` (text, AES-GCM encrypted)
      - `encrypted_access_token` (text, AES-GCM encrypted)
      - `token_expiry` (timestamptz)
      - `granted_scopes` (text[], list of Google API scopes)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `google_oauth_master`
    - Policy for authenticated users to manage their own connection
*/

CREATE TABLE IF NOT EXISTS google_oauth_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  email text NOT NULL DEFAULT '',
  encrypted_refresh_token text NOT NULL DEFAULT '',
  encrypted_access_token text NOT NULL DEFAULT '',
  token_expiry timestamptz NOT NULL DEFAULT now(),
  granted_scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_oauth_master_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_master_org_id ON google_oauth_master(org_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_master_user_id ON google_oauth_master(user_id);

ALTER TABLE google_oauth_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own google oauth master"
  ON google_oauth_master
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own google oauth master"
  ON google_oauth_master
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own google oauth master"
  ON google_oauth_master
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own google oauth master"
  ON google_oauth_master
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
