/*
  # Google Chat Integration Schema

  1. New Tables
    - `google_chat_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `org_id` (uuid, references organizations)
      - `access_token` (text, encrypted)
      - `refresh_token` (text, encrypted)
      - `token_expiry` (timestamptz)
      - `google_email` (text)
      - `google_user_id` (text)
      - `scopes` (text array)
      - `connected_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `google_chat_spaces_cache`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `org_id` (uuid, references organizations)
      - `space_id` (text, Google Chat space resource name)
      - `space_name` (text)
      - `space_type` (text: ROOM, DM, SPACE)
      - `display_name` (text)
      - `single_user_bot_dm` (boolean)
      - `threaded` (boolean)
      - `member_count` (integer)
      - `last_synced_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `google_chat_messages_cache`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `org_id` (uuid, references organizations)
      - `space_cache_id` (uuid, references google_chat_spaces_cache)
      - `message_id` (text, Google Chat message resource name)
      - `thread_id` (text)
      - `sender_name` (text)
      - `sender_email` (text)
      - `sender_avatar_url` (text)
      - `sender_type` (text: HUMAN, BOT)
      - `content` (text)
      - `formatted_text` (text)
      - `attachment_urls` (jsonb)
      - `sent_at` (timestamptz)
      - `is_read` (boolean)
      - `created_at` (timestamptz)
    
    - `google_chat_subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `org_id` (uuid, references organizations)
      - `space_id` (text)
      - `subscription_id` (text)
      - `expire_time` (timestamptz)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own Google Chat data
    - Organization scope for data isolation

  3. Indexes
    - Index on user_id for fast lookups
    - Index on space_id for message queries
    - Index on message_id for deduplication
*/

-- Google Chat OAuth Tokens
CREATE TABLE IF NOT EXISTS google_chat_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  token_expiry timestamptz,
  google_email text,
  google_user_id text,
  scopes text[] DEFAULT ARRAY[]::text[],
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Google Chat Spaces Cache
CREATE TABLE IF NOT EXISTS google_chat_spaces_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  space_id text NOT NULL,
  space_name text,
  space_type text NOT NULL DEFAULT 'SPACE',
  display_name text,
  single_user_bot_dm boolean DEFAULT false,
  threaded boolean DEFAULT false,
  member_count integer DEFAULT 0,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, space_id)
);

-- Google Chat Messages Cache
CREATE TABLE IF NOT EXISTS google_chat_messages_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  space_cache_id uuid NOT NULL REFERENCES google_chat_spaces_cache(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  thread_id text,
  sender_name text,
  sender_email text,
  sender_avatar_url text,
  sender_type text DEFAULT 'HUMAN',
  content text,
  formatted_text text,
  attachment_urls jsonb DEFAULT '[]'::jsonb,
  sent_at timestamptz NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- Google Chat Webhook Subscriptions
CREATE TABLE IF NOT EXISTS google_chat_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  space_id text NOT NULL,
  subscription_id text,
  expire_time timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, space_id)
);

-- Enable RLS
ALTER TABLE google_chat_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_chat_spaces_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_chat_messages_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_chat_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for google_chat_tokens
CREATE POLICY "Users can view own Google Chat tokens"
  ON google_chat_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Google Chat tokens"
  ON google_chat_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Google Chat tokens"
  ON google_chat_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Google Chat tokens"
  ON google_chat_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for google_chat_spaces_cache
CREATE POLICY "Users can view own Google Chat spaces"
  ON google_chat_spaces_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Google Chat spaces"
  ON google_chat_spaces_cache FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Google Chat spaces"
  ON google_chat_spaces_cache FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Google Chat spaces"
  ON google_chat_spaces_cache FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for google_chat_messages_cache
CREATE POLICY "Users can view own Google Chat messages"
  ON google_chat_messages_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Google Chat messages"
  ON google_chat_messages_cache FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Google Chat messages"
  ON google_chat_messages_cache FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Google Chat messages"
  ON google_chat_messages_cache FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for google_chat_subscriptions
CREATE POLICY "Users can view own Google Chat subscriptions"
  ON google_chat_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Google Chat subscriptions"
  ON google_chat_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Google Chat subscriptions"
  ON google_chat_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Google Chat subscriptions"
  ON google_chat_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_chat_tokens_user_id ON google_chat_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_google_chat_spaces_cache_user_id ON google_chat_spaces_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_google_chat_spaces_cache_space_id ON google_chat_spaces_cache(space_id);
CREATE INDEX IF NOT EXISTS idx_google_chat_messages_cache_user_id ON google_chat_messages_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_google_chat_messages_cache_space_cache_id ON google_chat_messages_cache(space_cache_id);
CREATE INDEX IF NOT EXISTS idx_google_chat_messages_cache_message_id ON google_chat_messages_cache(message_id);
CREATE INDEX IF NOT EXISTS idx_google_chat_messages_cache_sent_at ON google_chat_messages_cache(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_chat_subscriptions_user_id ON google_chat_subscriptions(user_id);

-- Trigger for updated_at on tokens
CREATE OR REPLACE FUNCTION update_google_chat_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_google_chat_tokens_updated_at
  BEFORE UPDATE ON google_chat_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_chat_tokens_updated_at();

-- Trigger for updated_at on spaces cache
CREATE OR REPLACE FUNCTION update_google_chat_spaces_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_google_chat_spaces_cache_updated_at
  BEFORE UPDATE ON google_chat_spaces_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_google_chat_spaces_cache_updated_at();

-- Trigger for updated_at on subscriptions
CREATE OR REPLACE FUNCTION update_google_chat_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_google_chat_subscriptions_updated_at
  BEFORE UPDATE ON google_chat_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_google_chat_subscriptions_updated_at();
