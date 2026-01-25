/*
  # Extend Brand Kit Versions for Integrated Brand System

  This migration adds comprehensive brand voice, messaging, and AI usage rules
  directly to brand_kit_versions, creating a unified brand system of record.

  1. Changes to brand_kits Table
    - Add `status` column (draft, active, archived) to replace boolean `active`

  2. New Columns in brand_kit_versions
    Voice & Tone:
      - `tone_settings` (jsonb) - formality, friendliness, energy, confidence sliders
      - `voice_descriptors` (text[]) - freeform tags like "Authoritative", "Helpful"
      - `voice_examples` (jsonb) - good/bad examples for AI training
      - `dos` (text[]) - writing guidelines to follow
      - `donts` (text[]) - writing guidelines to avoid

    Messaging & Copy:
      - `elevator_pitch` (text) - short company pitch ~150 chars
      - `value_proposition` (text) - core value statement
      - `short_tagline` (text) - brand tagline
      - `long_description` (text) - detailed brand description
      - `ctas` (jsonb) - array of CTA objects with text, context, placement

    AI Usage Rules:
      - `ai_enforce_voice` (boolean) - enforce voice in AI outputs
      - `ai_enforce_terminology` (boolean) - enforce approved terms only
      - `ai_avoid_restricted` (boolean) - avoid restricted phrases
      - `ai_forbidden_topics` (text[]) - topics AI should never discuss
      - `ai_forbidden_claims` (text[]) - claims AI should never make
      - `ai_forbidden_phrases` (text[]) - phrases AI should never use
      - `ai_fallback_behavior` (text) - 'ask_human', 'neutral_copy', 'skip'

    Publishing:
      - `published_at` (timestamptz) - when version was published
      - `published_by` (uuid) - who published the version

  3. New Permissions
    - `brandboard.publish` for SuperAdmin-only publishing

  4. Security
    - All existing RLS policies remain in effect
    - New data columns inherit table-level security
*/

-- Add status column to brand_kits (replacing boolean active)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kits' AND column_name = 'status'
  ) THEN
    ALTER TABLE brand_kits ADD COLUMN status text DEFAULT 'draft';
    
    -- Migrate existing active boolean to status
    UPDATE brand_kits SET status = CASE 
      WHEN active = true THEN 'active'
      WHEN archived_at IS NOT NULL THEN 'archived'
      ELSE 'draft'
    END;
    
    -- Add constraint for valid status values
    ALTER TABLE brand_kits ADD CONSTRAINT brand_kits_status_check 
      CHECK (status IN ('draft', 'active', 'archived'));
  END IF;
END $$;

-- Add voice fields to brand_kit_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'tone_settings'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN tone_settings jsonb DEFAULT '{"formality": 50, "friendliness": 50, "energy": 50, "confidence": 50}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'voice_descriptors'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN voice_descriptors text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'voice_examples'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN voice_examples jsonb DEFAULT '{"good": [], "bad": []}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'dos'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN dos text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'donts'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN donts text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

-- Add messaging fields to brand_kit_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'elevator_pitch'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN elevator_pitch text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'value_proposition'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN value_proposition text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'short_tagline'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN short_tagline text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'long_description'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN long_description text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'ctas'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN ctas jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add AI usage rules fields to brand_kit_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'ai_enforce_voice'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN ai_enforce_voice boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'ai_enforce_terminology'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN ai_enforce_terminology boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'ai_avoid_restricted'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN ai_avoid_restricted boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'ai_forbidden_topics'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN ai_forbidden_topics text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'ai_forbidden_claims'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN ai_forbidden_claims text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'ai_forbidden_phrases'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN ai_forbidden_phrases text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'ai_fallback_behavior'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN ai_fallback_behavior text DEFAULT 'ask_human';
    ALTER TABLE brand_kit_versions ADD CONSTRAINT brand_kit_versions_ai_fallback_check 
      CHECK (ai_fallback_behavior IN ('ask_human', 'neutral_copy', 'skip'));
  END IF;
END $$;

-- Add publishing fields to brand_kit_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN published_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_kit_versions' AND column_name = 'published_by'
  ) THEN
    ALTER TABLE brand_kit_versions ADD COLUMN published_by uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for published versions
CREATE INDEX IF NOT EXISTS idx_brand_kit_versions_published 
  ON brand_kit_versions(brand_kit_id, published_at DESC) 
  WHERE published_at IS NOT NULL;

-- Add brandboard.publish permission
INSERT INTO permissions (key, description, module_name)
VALUES ('brandboard.publish', 'Publish brand kit versions and set active brand', 'brandboard')
ON CONFLICT (key) DO NOTHING;

-- Grant brandboard.publish to SuperAdmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SuperAdmin' AND p.key = 'brandboard.publish'
ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON COLUMN brand_kits.status IS 'Kit status: draft (work in progress), active (published and in use), archived (no longer used)';
COMMENT ON COLUMN brand_kit_versions.tone_settings IS 'Voice tone sliders: {formality: 0-100, friendliness: 0-100, energy: 0-100, confidence: 0-100}';
COMMENT ON COLUMN brand_kit_versions.voice_descriptors IS 'Freeform voice tags: ["Authoritative", "Helpful", "Professional"]';
COMMENT ON COLUMN brand_kit_versions.voice_examples IS 'Training examples: {good: [{text, context}], bad: [{text, context}]}';
COMMENT ON COLUMN brand_kit_versions.dos IS 'Writing guidelines to follow';
COMMENT ON COLUMN brand_kit_versions.donts IS 'Writing guidelines to avoid';
COMMENT ON COLUMN brand_kit_versions.elevator_pitch IS 'Short company pitch, ~150 characters';
COMMENT ON COLUMN brand_kit_versions.value_proposition IS 'Core value statement';
COMMENT ON COLUMN brand_kit_versions.short_tagline IS 'Brand tagline';
COMMENT ON COLUMN brand_kit_versions.long_description IS 'Detailed brand description';
COMMENT ON COLUMN brand_kit_versions.ctas IS 'CTA library: [{text, context, placement}]';
COMMENT ON COLUMN brand_kit_versions.ai_enforce_voice IS 'Enforce brand voice in AI outputs';
COMMENT ON COLUMN brand_kit_versions.ai_enforce_terminology IS 'Enforce approved terminology only';
COMMENT ON COLUMN brand_kit_versions.ai_avoid_restricted IS 'Automatically avoid restricted phrases';
COMMENT ON COLUMN brand_kit_versions.ai_forbidden_topics IS 'Topics AI should never discuss';
COMMENT ON COLUMN brand_kit_versions.ai_forbidden_claims IS 'Claims AI should never make';
COMMENT ON COLUMN brand_kit_versions.ai_forbidden_phrases IS 'Phrases AI should never use';
COMMENT ON COLUMN brand_kit_versions.ai_fallback_behavior IS 'AI behavior when rules are violated: ask_human, neutral_copy, skip';
COMMENT ON COLUMN brand_kit_versions.published_at IS 'When this version was published';
COMMENT ON COLUMN brand_kit_versions.published_by IS 'User who published this version';
