/*
  # Gmail Sync State and User Flags

  1. New Tables
    - `gmail_sync_state`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `user_id` (uuid, FK to users)
      - `history_id` (text) - Gmail incremental sync cursor
      - `watch_expiration` (timestamptz) - When the Pub/Sub watch expires
      - `last_full_sync_at` (timestamptz) - Last full sync timestamp
      - `last_incremental_sync_at` (timestamptz) - Last incremental sync timestamp
      - `sync_status` (text) - idle, syncing, error
      - `error_message` (text) - Last error message if any
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `users` - Add `gmail_connected` boolean column

  3. Security
    - Enable RLS on `gmail_sync_state`
    - Policies for authenticated users to read/update their own sync state
*/

-- Create gmail_sync_state table
CREATE TABLE IF NOT EXISTS gmail_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  history_id text,
  watch_expiration timestamptz,
  last_full_sync_at timestamptz,
  last_incremental_sync_at timestamptz,
  sync_status text NOT NULL DEFAULT 'idle',
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE gmail_sync_state ENABLE ROW LEVEL SECURITY;

-- Add gmail_connected flag to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'gmail_connected'
  ) THEN
    ALTER TABLE users ADD COLUMN gmail_connected boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add last_gmail_sync_at to user_connected_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_connected_accounts' AND column_name = 'last_gmail_sync_at'
  ) THEN
    ALTER TABLE user_connected_accounts ADD COLUMN last_gmail_sync_at timestamptz;
  END IF;
END $$;

-- RLS policies for gmail_sync_state
CREATE POLICY "Users can view own gmail sync state"
  ON gmail_sync_state
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own gmail sync state"
  ON gmail_sync_state
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert gmail sync state"
  ON gmail_sync_state
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own gmail sync state"
  ON gmail_sync_state
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_gmail_sync_state_user_id ON gmail_sync_state(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_sync_state_org_id ON gmail_sync_state(organization_id);
CREATE INDEX IF NOT EXISTS idx_gmail_sync_state_watch_expiration ON gmail_sync_state(watch_expiration) WHERE watch_expiration IS NOT NULL;