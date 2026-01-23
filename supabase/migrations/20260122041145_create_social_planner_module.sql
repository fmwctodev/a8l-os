/*
  # Create Social Planner Module

  1. New Tables
    - `social_accounts`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `provider` (text) - facebook, instagram, linkedin, google_business, tiktok, youtube
      - `external_account_id` (text) - provider's account/page ID
      - `display_name` (text) - account name for display
      - `profile_image_url` (text) - account avatar
      - `access_token_encrypted` (text) - encrypted access token
      - `refresh_token_encrypted` (text) - encrypted refresh token
      - `token_expiry` (timestamptz) - when token expires
      - `token_meta` (jsonb) - additional token data (scopes, etc)
      - `account_type` (text) - page, profile, channel, location
      - `status` (text) - connected, disconnected, error
      - `last_error` (text)
      - `connected_by` (uuid, references users)
      - `created_at`, `updated_at` (timestamptz)

    - `social_oauth_states`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `user_id` (uuid, references users)
      - `provider` (text)
      - `state_token` (text, unique) - CSRF protection token
      - `redirect_uri` (text) - where to redirect after OAuth
      - `meta` (jsonb) - additional state data
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)

    - `social_posts`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `created_by` (uuid, references users)
      - `body` (text) - post content
      - `media` (jsonb) - array of media URLs and types
      - `targets` (jsonb) - array of account IDs to post to
      - `status` (text) - draft, scheduled, queued, posting, posted, failed, cancelled
      - `scheduled_at_utc` (timestamptz) - when to publish
      - `scheduled_timezone` (text) - user's timezone for display
      - `requires_approval` (boolean)
      - `approved_by` (uuid, references users)
      - `approved_at` (timestamptz)
      - `posted_at` (timestamptz) - actual post time
      - `provider_post_ids` (jsonb) - map of account_id -> provider post ID
      - `attempt_count` (integer)
      - `last_error` (text)
      - `created_at`, `updated_at` (timestamptz)

    - `social_post_logs`
      - `id` (uuid, primary key)
      - `post_id` (uuid, references social_posts)
      - `account_id` (uuid, references social_accounts)
      - `action` (text) - scheduled, queued, attempt, success, failure, cancelled
      - `details` (jsonb) - error message, provider response, etc
      - `created_at` (timestamptz)

  2. Indexes
    - Social accounts: organization_id, provider, status
    - OAuth states: state_token, expires_at
    - Social posts: organization_id, status, scheduled_at_utc
    - Post logs: post_id, account_id

  3. Security
    - Enable RLS on all tables
*/

-- Create social accounts table
CREATE TABLE IF NOT EXISTS social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('facebook', 'instagram', 'linkedin', 'google_business', 'tiktok', 'youtube')),
  external_account_id text NOT NULL,
  display_name text NOT NULL,
  profile_image_url text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expiry timestamptz,
  token_meta jsonb DEFAULT '{}'::jsonb,
  account_type text DEFAULT 'page' CHECK (account_type IN ('page', 'profile', 'channel', 'location', 'business')),
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'token_expiring')),
  last_error text,
  connected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, provider, external_account_id)
);

-- Create OAuth states table for CSRF protection
CREATE TABLE IF NOT EXISTS social_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('facebook', 'instagram', 'linkedin', 'google_business', 'tiktok', 'youtube')),
  state_token text UNIQUE NOT NULL,
  redirect_uri text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);

-- Create social posts table
CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL DEFAULT '',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'queued', 'posting', 'posted', 'failed', 'cancelled')),
  scheduled_at_utc timestamptz,
  scheduled_timezone text DEFAULT 'UTC',
  requires_approval boolean DEFAULT false,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  posted_at timestamptz,
  provider_post_ids jsonb DEFAULT '{}'::jsonb,
  attempt_count integer DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create social post logs table
CREATE TABLE IF NOT EXISTS social_post_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('created', 'scheduled', 'queued', 'attempt', 'success', 'failure', 'cancelled', 'approved')),
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for social accounts
CREATE INDEX IF NOT EXISTS idx_social_accounts_organization_id ON social_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider ON social_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_social_accounts_status ON social_accounts(status);
CREATE INDEX IF NOT EXISTS idx_social_accounts_token_expiry ON social_accounts(token_expiry) WHERE token_expiry IS NOT NULL;

-- Create indexes for OAuth states
CREATE INDEX IF NOT EXISTS idx_social_oauth_states_state_token ON social_oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_social_oauth_states_expires_at ON social_oauth_states(expires_at);

-- Create indexes for social posts
CREATE INDEX IF NOT EXISTS idx_social_posts_organization_id ON social_posts(organization_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_at ON social_posts(scheduled_at_utc) WHERE scheduled_at_utc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_created_by ON social_posts(created_by);

-- Create indexes for post logs
CREATE INDEX IF NOT EXISTS idx_social_post_logs_post_id ON social_post_logs(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_logs_account_id ON social_post_logs(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_post_logs_created_at ON social_post_logs(created_at);

-- Enable RLS on all tables
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_logs ENABLE ROW LEVEL SECURITY;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER update_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_posts_updated_at ON social_posts;
CREATE TRIGGER update_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
