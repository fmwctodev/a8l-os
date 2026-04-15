/*
  # Microsoft OAuth Master Table

  Mirrors google_oauth_master for Microsoft 365 / Azure AD tokens.
  Stores encrypted access and refresh tokens per user for all
  Microsoft Graph services (Outlook Mail, Calendar, OneDrive, Teams).

  Dual-provider support: users can have both a google_oauth_master
  and a microsoft_oauth_master row. The provider abstraction layer
  checks which one exists to determine which backend to use.
*/

CREATE TABLE IF NOT EXISTS microsoft_oauth_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  email text,
  tenant_id text,
  granted_scopes text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_microsoft_oauth_master_user ON microsoft_oauth_master(user_id);
CREATE INDEX IF NOT EXISTS idx_microsoft_oauth_master_org ON microsoft_oauth_master(org_id);

ALTER TABLE microsoft_oauth_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Microsoft token"
  ON microsoft_oauth_master FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own Microsoft token"
  ON microsoft_oauth_master FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own Microsoft token"
  ON microsoft_oauth_master FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own Microsoft token"
  ON microsoft_oauth_master FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Also create Outlook-specific tables for sync state
CREATE TABLE IF NOT EXISTS outlook_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  delta_token text,
  subscription_id text,
  subscription_expiry timestamptz,
  sync_status text NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  last_sync_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_outlook_sync_state_user ON outlook_sync_state(user_id);

ALTER TABLE outlook_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Outlook sync state"
  ON outlook_sync_state FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can manage their own Outlook sync state"
  ON outlook_sync_state FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- OneDrive connections table
CREATE TABLE IF NOT EXISTS onedrive_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drive_id text,
  root_folder_id text,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

ALTER TABLE onedrive_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own OneDrive connection"
  ON onedrive_connections FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can manage their own OneDrive connection"
  ON onedrive_connections FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Microsoft Calendar connections
CREATE TABLE IF NOT EXISTS microsoft_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id text DEFAULT 'primary',
  delta_token text,
  sync_enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

ALTER TABLE microsoft_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own MS calendar connection"
  ON microsoft_calendar_connections FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can manage their own MS calendar connection"
  ON microsoft_calendar_connections FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Add provider column to existing tables that need it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'provider'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN provider text DEFAULT 'google';
  END IF;
END $$;

-- Add Microsoft to integrations catalog
INSERT INTO integrations (key, name, description, category, connection_type, enabled, created_at)
VALUES (
  'microsoft_365',
  'Microsoft 365',
  'Connect Outlook Mail, Calendar, OneDrive, and Teams',
  'Other',
  'oauth',
  true,
  now()
) ON CONFLICT (key) DO NOTHING;
