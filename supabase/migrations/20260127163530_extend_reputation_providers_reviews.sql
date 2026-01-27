/*
  # Extend Reputation - Providers and Reviews

  1. Schema Changes
    - Add OAuth fields to review_providers (tokens, expiry, refresh)
    - Add sync configuration (sync_enabled, sync_interval_hours)
    - Add hidden and moderation fields to reviews
    - Add AI analysis reference to reviews
*/

-- Add OAuth and sync fields to review_providers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_providers' AND column_name = 'oauth_access_token'
  ) THEN
    ALTER TABLE review_providers ADD COLUMN oauth_access_token text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_providers' AND column_name = 'oauth_refresh_token'
  ) THEN
    ALTER TABLE review_providers ADD COLUMN oauth_refresh_token text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_providers' AND column_name = 'oauth_token_expires_at'
  ) THEN
    ALTER TABLE review_providers ADD COLUMN oauth_token_expires_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_providers' AND column_name = 'oauth_scopes'
  ) THEN
    ALTER TABLE review_providers ADD COLUMN oauth_scopes text[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_providers' AND column_name = 'sync_enabled'
  ) THEN
    ALTER TABLE review_providers ADD COLUMN sync_enabled boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_providers' AND column_name = 'sync_interval_hours'
  ) THEN
    ALTER TABLE review_providers ADD COLUMN sync_interval_hours integer DEFAULT 6;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_providers' AND column_name = 'sync_error'
  ) THEN
    ALTER TABLE review_providers ADD COLUMN sync_error text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_providers' AND column_name = 'total_reviews_synced'
  ) THEN
    ALTER TABLE review_providers ADD COLUMN total_reviews_synced integer DEFAULT 0;
  END IF;
END $$;

-- Add hidden and moderation fields to reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'hidden'
  ) THEN
    ALTER TABLE reviews ADD COLUMN hidden boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'hidden_at'
  ) THEN
    ALTER TABLE reviews ADD COLUMN hidden_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'hidden_by'
  ) THEN
    ALTER TABLE reviews ADD COLUMN hidden_by uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'spam_score'
  ) THEN
    ALTER TABLE reviews ADD COLUMN spam_score numeric(3,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'spam_reason'
  ) THEN
    ALTER TABLE reviews ADD COLUMN spam_reason text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'ai_analysis_id'
  ) THEN
    ALTER TABLE reviews ADD COLUMN ai_analysis_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'reply_posted_at'
  ) THEN
    ALTER TABLE reviews ADD COLUMN reply_posted_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'reply_post_error'
  ) THEN
    ALTER TABLE reviews ADD COLUMN reply_post_error text;
  END IF;
END $$;
