/*
  # Add Approval Workflow and Platform Options to Social Posts

  1. Changes to `social_posts`
    - Add `platform_options` (jsonb) for platform-specific settings
    - Add `approval_token` (text, unique) for secure approval links
    - Add `approval_notes` (text) for rejection reasons
    - Add `approval_requested_at` (timestamptz) for tracking
    - Add `approval_email_sent_at` (timestamptz) for email tracking
    - Add `customized_per_channel` (boolean) flag

  2. Indexes
    - approval_token for fast lookup during approval flow

  3. Notes
    - approval_token is nullable and unique (only set when approval needed)
    - platform_options stores GBP type, Facebook post type, YouTube metadata, etc.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'platform_options'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN platform_options jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'approval_token'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN approval_token text UNIQUE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'approval_notes'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN approval_notes text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'approval_requested_at'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN approval_requested_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'approval_email_sent_at'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN approval_email_sent_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'customized_per_channel'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN customized_per_channel boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_posts_approval_token ON social_posts(approval_token) WHERE approval_token IS NOT NULL;
