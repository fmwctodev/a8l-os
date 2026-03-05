/*
  # Add Social DM Channel and Social Post Comments Tables

  ## Summary
  Extends the platform to support Late.dev social inbox features:
  social DMs (messages), post comments, and unified review syncing.

  ## Changes

  ### 1. Messages Table - New Channel Type
  - Adds 'social_dm' to the allowed channel values on the messages table
    via a new CHECK constraint (the old one is dropped and replaced)

  ### 2. Conversations Table - New Columns
  - `late_conversation_id` (text) - the Late.dev conversation ID, used for upsert deduplication
  - `late_dm_platform` (text) - the social platform (facebook, instagram, linkedin)

  ### 3. New Table: `social_post_comments`
  - Stores individual comments fetched from the Late.dev comments inbox API
  - Keyed on `late_comment_id` (unique) for upsert safety
  - Tracks: author info, comment text, engagement counts, moderation state, reply status

  ### 4. New Table: `social_post_comment_posts`
  - Caches the post-level context returned by the Late.dev comments list endpoint
  - Groups comments by post for the UI's Comments tab
  - Stores: late_post_id, platform, post_body_preview, platform_post_url, comment counts

  ### 5. late_connections - sync tracking
  - `last_comments_synced_at` (timestamptz) - tracks per-account comment sync freshness
  - `last_messages_synced_at` (timestamptz) - tracks per-account DM sync freshness

  ### 6. Security
  - RLS enabled on both new tables
  - Org-scoped SELECT, INSERT, UPDATE, DELETE policies for authenticated users
*/

-- =========================================================
-- 1. Add 'social_dm' to messages channel check constraint
-- =========================================================

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'messages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%channel%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE messages DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

ALTER TABLE messages
  ADD CONSTRAINT messages_channel_check
  CHECK (channel IN ('sms', 'email', 'voice', 'webchat', 'social_dm'));

-- =========================================================
-- 2. Add Late.dev columns to conversations
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'late_conversation_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN late_conversation_id text;
    CREATE INDEX IF NOT EXISTS idx_conversations_late_conversation_id
      ON conversations (late_conversation_id) WHERE late_conversation_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'late_dm_platform'
  ) THEN
    ALTER TABLE conversations ADD COLUMN late_dm_platform text;
  END IF;
END $$;

-- =========================================================
-- 3. Add sync tracking columns to late_connections
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'late_connections' AND column_name = 'last_comments_synced_at'
  ) THEN
    ALTER TABLE late_connections ADD COLUMN last_comments_synced_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'late_connections' AND column_name = 'last_messages_synced_at'
  ) THEN
    ALTER TABLE late_connections ADD COLUMN last_messages_synced_at timestamptz;
  END IF;
END $$;

-- =========================================================
-- 4. Create social_post_comment_posts table
--    (post-level context cache from Late.dev comments API)
-- =========================================================

CREATE TABLE IF NOT EXISTS social_post_comment_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  late_post_id        text NOT NULL,
  late_account_id     text NOT NULL,
  platform            text NOT NULL,
  post_body_preview   text,
  platform_post_url   text,
  comment_count       integer NOT NULL DEFAULT 0,
  last_comment_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, late_post_id, late_account_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_posts_org_id
  ON social_post_comment_posts (organization_id);

CREATE INDEX IF NOT EXISTS idx_comment_posts_platform
  ON social_post_comment_posts (organization_id, platform);

ALTER TABLE social_post_comment_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view comment posts"
  ON social_post_comment_posts FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert comment posts"
  ON social_post_comment_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can update comment posts"
  ON social_post_comment_posts FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete comment posts"
  ON social_post_comment_posts FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- =========================================================
-- 5. Create social_post_comments table
-- =========================================================

CREATE TABLE IF NOT EXISTS social_post_comments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  comment_post_id       uuid REFERENCES social_post_comment_posts(id) ON DELETE CASCADE,
  late_comment_id       text NOT NULL,
  late_post_id          text NOT NULL,
  late_account_id       text NOT NULL,
  platform              text NOT NULL,
  author_id             text,
  author_name           text,
  author_handle         text,
  author_avatar_url     text,
  text                  text,
  like_count            integer NOT NULL DEFAULT 0,
  reply_count           integer NOT NULL DEFAULT 0,
  is_reply              boolean NOT NULL DEFAULT false,
  parent_comment_id     text,
  hidden                boolean NOT NULL DEFAULT false,
  has_private_reply     boolean NOT NULL DEFAULT false,
  actioned_at           timestamptz,
  actioned_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  synced_at             timestamptz NOT NULL DEFAULT now(),
  comment_created_at    timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, late_comment_id)
);

CREATE INDEX IF NOT EXISTS idx_social_post_comments_org_id
  ON social_post_comments (organization_id);

CREATE INDEX IF NOT EXISTS idx_social_post_comments_late_post_id
  ON social_post_comments (organization_id, late_post_id);

CREATE INDEX IF NOT EXISTS idx_social_post_comments_platform
  ON social_post_comments (organization_id, platform);

CREATE INDEX IF NOT EXISTS idx_social_post_comments_comment_post_id
  ON social_post_comments (comment_post_id);

ALTER TABLE social_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view social comments"
  ON social_post_comments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert social comments"
  ON social_post_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can update social comments"
  ON social_post_comments FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete social comments"
  ON social_post_comments FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
