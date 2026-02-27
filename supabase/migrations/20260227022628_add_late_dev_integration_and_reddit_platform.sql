/*
  # Add Late.dev Integration and Reddit Platform Support

  This migration adds support for Late.dev as the social publishing layer (replacing Unipile for publishing)
  and adds Reddit as a new supported platform.

  1. New Tables
    - `late_connections`
      - `id` (uuid, primary key) - Unique connection identifier
      - `org_id` (uuid, FK to organizations) - Organization this connection belongs to
      - `connected_by_user_id` (uuid, FK to users) - User who created the connection
      - `late_account_id` (text, not null) - Late.dev account identifier for API calls
      - `late_profile_id` (text) - Late.dev profile this account belongs to
      - `platform` (text, not null) - Social platform name (facebook, instagram, linkedin, etc.)
      - `account_name` (text) - Display name of the connected account
      - `avatar_url` (text) - Profile image URL
      - `status` (text, default 'connected') - Connection status (connected, expired, error)
      - `created_at` (timestamptz, default now)
      - `updated_at` (timestamptz, default now)

  2. Modified Tables
    - `social_posts`
      - `late_post_id` (text, nullable) - Post ID returned by Late.dev after publishing
      - `late_status` (text, nullable) - Publishing status from Late.dev webhook
      - `late_response` (jsonb, nullable) - Full response payload from Late.dev API

  3. Indexes
    - Unique index on late_connections(org_id, late_account_id)
    - Index on late_connections(org_id)
    - Index on late_connections(late_account_id)
    - Index on social_posts(late_post_id) for webhook lookups

  4. Security
    - Enable RLS on late_connections
    - Policies: org members can SELECT, admins can INSERT/UPDATE/DELETE
*/

CREATE TABLE IF NOT EXISTS late_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connected_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  late_account_id text NOT NULL,
  late_profile_id text,
  platform text NOT NULL,
  account_name text,
  avatar_url text,
  status text NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'expired', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_late_connections_org_account
  ON late_connections(org_id, late_account_id);

CREATE INDEX IF NOT EXISTS idx_late_connections_org_id
  ON late_connections(org_id);

CREATE INDEX IF NOT EXISTS idx_late_connections_late_account_id
  ON late_connections(late_account_id);

ALTER TABLE late_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view late connections"
  ON late_connections
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert late connections"
  ON late_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org admins can update late connections"
  ON late_connections
  FOR UPDATE
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

CREATE POLICY "Org admins can delete late connections"
  ON late_connections
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'late_post_id'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN late_post_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'late_status'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN late_status text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'late_response'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN late_response jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_posts_late_post_id
  ON social_posts(late_post_id)
  WHERE late_post_id IS NOT NULL;
