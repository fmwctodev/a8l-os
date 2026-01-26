/*
  # Create Social AI Content Metadata Schema

  This migration creates tables and schema changes needed for the AI Content Assistant
  feature in the Social Planner composer.

  1. New Tables
    - `social_post_ai_metadata`
      - Tracks all AI interactions per post for analytics
      - Stores input/output content, model used, tokens, brandboard reference
      - Links to social_posts, organizations, users, brand_kits
      - Tracks whether AI suggestion was applied

  2. Schema Changes
    - `content_ai_generations`: Add action_type, platform_scope, applied columns
    - `organizations`: Add business location fields (address, city, state, country, timezone)

  3. Indexes
    - Composite index on (organization_id, created_at) for analytics queries
    - Index on post_id for post-level lookups
    - Index on action_type for filtering by action

  4. Security
    - Enable RLS on social_post_ai_metadata
    - Policies for organization-level access

  5. Purpose
    - Analytics data capture for future AI dashboards
    - Tracking AI feature usage patterns
    - Measuring AI suggestion acceptance rates
    - Cost tracking via tokens_used
*/

-- Create AI action type enum for social content
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_ai_action_type') THEN
    CREATE TYPE social_ai_action_type AS ENUM (
      'improve_engagement',
      'shorten',
      'rewrite_tone',
      'make_promotional',
      'add_cta',
      'optimize_hashtags',
      'localize',
      'generate_new',
      'repurpose'
    );
  END IF;
END $$;

-- Create social_post_ai_metadata table
CREATE TABLE IF NOT EXISTS social_post_ai_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES social_posts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  platform text CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'twitter', 'all')),
  action_type social_ai_action_type NOT NULL,
  model_used text,
  brand_kit_id uuid REFERENCES brand_kits(id) ON DELETE SET NULL,
  brand_voice_id uuid REFERENCES brand_voices(id) ON DELETE SET NULL,
  brand_kit_version integer,
  brand_voice_version integer,
  input_content text,
  input_length integer,
  output_content text,
  output_length integer,
  tokens_used integer DEFAULT 0,
  generation_params jsonb DEFAULT '{}'::jsonb,
  applied boolean DEFAULT false,
  applied_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for social_post_ai_metadata
CREATE INDEX IF NOT EXISTS idx_social_post_ai_metadata_org_created 
  ON social_post_ai_metadata(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_post_ai_metadata_post_id 
  ON social_post_ai_metadata(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_post_ai_metadata_user_id 
  ON social_post_ai_metadata(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_post_ai_metadata_action_type 
  ON social_post_ai_metadata(action_type);
CREATE INDEX IF NOT EXISTS idx_social_post_ai_metadata_applied 
  ON social_post_ai_metadata(organization_id, applied) WHERE applied = true;
CREATE INDEX IF NOT EXISTS idx_social_post_ai_metadata_platform 
  ON social_post_ai_metadata(platform) WHERE platform IS NOT NULL;

-- Enable RLS
ALTER TABLE social_post_ai_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_post_ai_metadata
CREATE POLICY "Users can view AI metadata in their organization"
  ON social_post_ai_metadata
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create AI metadata in their organization"
  ON social_post_ai_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update AI metadata they created"
  ON social_post_ai_metadata
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role_id IN (
        SELECT id FROM roles WHERE name IN ('SuperAdmin', 'Admin')
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role_id IN (
        SELECT id FROM roles WHERE name IN ('SuperAdmin', 'Admin')
      )
    )
  );

-- Extend content_ai_generations with action_type, platform_scope, applied
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_ai_generations' AND column_name = 'action_type'
  ) THEN
    ALTER TABLE content_ai_generations ADD COLUMN action_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_ai_generations' AND column_name = 'platform_scope'
  ) THEN
    ALTER TABLE content_ai_generations ADD COLUMN platform_scope text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_ai_generations' AND column_name = 'applied'
  ) THEN
    ALTER TABLE content_ai_generations ADD COLUMN applied boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_ai_generations' AND column_name = 'brand_kit_id'
  ) THEN
    ALTER TABLE content_ai_generations ADD COLUMN brand_kit_id uuid REFERENCES brand_kits(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_ai_generations' AND column_name = 'brand_voice_id'
  ) THEN
    ALTER TABLE content_ai_generations ADD COLUMN brand_voice_id uuid REFERENCES brand_voices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for action_type on content_ai_generations
CREATE INDEX IF NOT EXISTS idx_content_ai_generations_action_type 
  ON content_ai_generations(action_type) WHERE action_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_ai_generations_applied 
  ON content_ai_generations(applied) WHERE applied = true;

-- Add business location fields to organizations table for localization feature
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'business_address'
  ) THEN
    ALTER TABLE organizations ADD COLUMN business_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'business_city'
  ) THEN
    ALTER TABLE organizations ADD COLUMN business_city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'business_state'
  ) THEN
    ALTER TABLE organizations ADD COLUMN business_state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'business_country'
  ) THEN
    ALTER TABLE organizations ADD COLUMN business_country text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'business_postal_code'
  ) THEN
    ALTER TABLE organizations ADD COLUMN business_postal_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'business_timezone'
  ) THEN
    ALTER TABLE organizations ADD COLUMN business_timezone text DEFAULT 'UTC';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE social_post_ai_metadata IS 'Tracks AI content generation interactions for social posts analytics';
COMMENT ON COLUMN social_post_ai_metadata.action_type IS 'Type of AI action: improve_engagement, shorten, rewrite_tone, make_promotional, add_cta, optimize_hashtags, localize, generate_new, repurpose';
COMMENT ON COLUMN social_post_ai_metadata.applied IS 'Whether the AI suggestion was applied to the post';
COMMENT ON COLUMN social_post_ai_metadata.generation_params IS 'Additional parameters like tone, length, objective';
