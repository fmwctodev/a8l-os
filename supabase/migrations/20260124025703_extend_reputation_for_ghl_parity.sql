/*
  # Extend Reputation Module for GHL Parity

  1. Schema Changes
    - Add 'yelp' to provider CHECK constraints on review_providers and reviews tables
    - Add response fields to reviews table (response, responded_at, responded_by, response_source)
    - Add sent_by_source to review_requests for tracking origin (manual, quickbooks, workflow)
    - Add retry_count to review_requests
    - Add yelp_review_url to reputation_settings
    - Create reputation_competitors table for competitor analysis

  2. New Tables
    - `reputation_competitors`
      - Tracks up to 3 competitors per organization
      - Stores competitor business info and URLs

  3. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- Update provider CHECK constraint on review_providers to include yelp
DO $$
BEGIN
  ALTER TABLE review_providers DROP CONSTRAINT IF EXISTS review_providers_provider_check;
  ALTER TABLE review_providers 
    ADD CONSTRAINT review_providers_provider_check 
    CHECK (provider IN ('google', 'facebook', 'yelp', 'internal'));
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Update provider CHECK constraint on reviews to include yelp
DO $$
BEGIN
  ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_provider_check;
  ALTER TABLE reviews 
    ADD CONSTRAINT reviews_provider_check 
    CHECK (provider IN ('google', 'facebook', 'yelp', 'internal'));
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Update provider_preference CHECK constraint on review_requests to include yelp
DO $$
BEGIN
  ALTER TABLE review_requests DROP CONSTRAINT IF EXISTS review_requests_provider_preference_check;
  ALTER TABLE review_requests 
    ADD CONSTRAINT review_requests_provider_preference_check 
    CHECK (provider_preference IN ('smart', 'google', 'facebook', 'yelp', 'internal'));
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Add response fields to reviews table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'response'
  ) THEN
    ALTER TABLE reviews ADD COLUMN response text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'responded_at'
  ) THEN
    ALTER TABLE reviews ADD COLUMN responded_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'responded_by'
  ) THEN
    ALTER TABLE reviews ADD COLUMN responded_by uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'response_source'
  ) THEN
    ALTER TABLE reviews ADD COLUMN response_source text DEFAULT 'manual' CHECK (response_source IN ('manual', 'ai'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'external_response_id'
  ) THEN
    ALTER TABLE reviews ADD COLUMN external_response_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'is_spam'
  ) THEN
    ALTER TABLE reviews ADD COLUMN is_spam boolean DEFAULT false;
  END IF;
END $$;

-- Add sent_by_source and retry_count to review_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_requests' AND column_name = 'sent_by_source'
  ) THEN
    ALTER TABLE review_requests ADD COLUMN sent_by_source text DEFAULT 'manual' CHECK (sent_by_source IN ('manual', 'quickbooks', 'workflow'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_requests' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE review_requests ADD COLUMN retry_count integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_requests' AND column_name = 'status'
  ) THEN
    ALTER TABLE review_requests ADD COLUMN status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'clicked', 'completed'));
  END IF;
END $$;

-- Add yelp_review_url and additional settings to reputation_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'yelp_review_url'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN yelp_review_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'review_goal'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN review_goal integer DEFAULT 20;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'ai_replies_enabled'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN ai_replies_enabled boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'spam_keywords'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN spam_keywords text[] DEFAULT '{}';
  END IF;
END $$;

-- Create reputation_competitors table
CREATE TABLE IF NOT EXISTS reputation_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  google_place_id text,
  facebook_page_id text,
  yelp_business_id text,
  google_url text,
  facebook_url text,
  yelp_url text,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reputation_competitors_org ON reputation_competitors(organization_id);

-- Enable RLS on reputation_competitors
ALTER TABLE reputation_competitors ENABLE ROW LEVEL SECURITY;

-- RLS policies for reputation_competitors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reputation_competitors' AND policyname = 'Users can view own org competitors'
  ) THEN
    CREATE POLICY "Users can view own org competitors"
      ON reputation_competitors FOR SELECT
      TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reputation_competitors' AND policyname = 'Users with permission can manage competitors'
  ) THEN
    CREATE POLICY "Users with permission can manage competitors"
      ON reputation_competitors FOR ALL
      TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM users u
          JOIN role_permissions rp ON u.role_id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE u.id = auth.uid()
          AND p.key = 'reputation.manage'
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM users u
          JOIN role_permissions rp ON u.role_id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE u.id = auth.uid()
          AND p.key = 'reputation.manage'
        )
      );
  END IF;
END $$;

-- Add index on reviews for response queries
CREATE INDEX IF NOT EXISTS idx_reviews_responded ON reviews(responded_at) WHERE response IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_spam ON reviews(is_spam) WHERE is_spam = true;
