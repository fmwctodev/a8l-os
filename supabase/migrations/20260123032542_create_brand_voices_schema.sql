/*
  # Create Brand Voices Schema

  1. New Tables
    - `brand_voices`
      - `id` (uuid, primary key)
      - `org_id` (uuid, foreign key to organizations)
      - `name` (text, required)
      - `summary` (text, short description of the voice)
      - `active` (boolean, default false)
      - `archived_at` (timestamptz, for soft delete)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `brand_voice_versions`
      - `id` (uuid, primary key)
      - `brand_voice_id` (uuid, foreign key to brand_voices)
      - `version_number` (integer, auto-incremented per voice)
      - `tone_settings` (jsonb, slider values for formality, friendliness, energy, etc.)
      - `dos` (text[], list of writing rules to follow)
      - `donts` (text[], list of writing rules to avoid)
      - `vocabulary_preferred` (text[], preferred phrases and words)
      - `vocabulary_prohibited` (text[], phrases and words to avoid)
      - `formatting_rules` (text, punctuation and formatting guidelines)
      - `examples` (jsonb, sample copy for different contexts)
      - `ai_prompt_template` (text, editable template for generating AI system prompt)
      - `ai_system_prompt` (text, generated AI system prompt from settings)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)

  2. Indexes
    - Index on brand_voices.org_id for tenant queries
    - Index on brand_voices.active for filtering
    - Index on brand_voice_versions.brand_voice_id and version_number for version lookups

  3. Functions
    - `get_next_brand_voice_version()` for auto-incrementing version numbers
*/

-- Create brand_voices table
CREATE TABLE IF NOT EXISTS brand_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  summary text,
  active boolean DEFAULT false,
  archived_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create brand_voice_versions table
CREATE TABLE IF NOT EXISTS brand_voice_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_voice_id uuid NOT NULL REFERENCES brand_voices(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  tone_settings jsonb DEFAULT '{}'::jsonb,
  dos text[] DEFAULT ARRAY[]::text[],
  donts text[] DEFAULT ARRAY[]::text[],
  vocabulary_preferred text[] DEFAULT ARRAY[]::text[],
  vocabulary_prohibited text[] DEFAULT ARRAY[]::text[],
  formatting_rules text,
  examples jsonb DEFAULT '{}'::jsonb,
  ai_prompt_template text,
  ai_system_prompt text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_voice_id, version_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_voices_org_id ON brand_voices(org_id);
CREATE INDEX IF NOT EXISTS idx_brand_voices_active ON brand_voices(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_brand_voices_not_archived ON brand_voices(org_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brand_voice_versions_voice_id ON brand_voice_versions(brand_voice_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_versions_latest ON brand_voice_versions(brand_voice_id, version_number DESC);

-- Function to get next version number for a brand voice
CREATE OR REPLACE FUNCTION get_next_brand_voice_version(p_brand_voice_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  next_version integer;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM brand_voice_versions
  WHERE brand_voice_id = p_brand_voice_id;
  
  RETURN next_version;
END;
$$;

-- Trigger to auto-set version_number on insert
CREATE OR REPLACE FUNCTION set_brand_voice_version_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.version_number IS NULL OR NEW.version_number = 1 THEN
    NEW.version_number := get_next_brand_voice_version(NEW.brand_voice_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_brand_voice_version_number
  BEFORE INSERT ON brand_voice_versions
  FOR EACH ROW
  EXECUTE FUNCTION set_brand_voice_version_number();

-- Trigger to update updated_at on brand_voices
CREATE OR REPLACE FUNCTION update_brand_voice_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE brand_voices SET updated_at = now() WHERE id = NEW.brand_voice_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_brand_voice_timestamp
  AFTER INSERT ON brand_voice_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_brand_voice_timestamp();

-- Add comments for documentation
COMMENT ON TABLE brand_voices IS 'Stores brand voice definitions for organizations';
COMMENT ON TABLE brand_voice_versions IS 'Immutable version history for brand voices';
COMMENT ON COLUMN brand_voice_versions.tone_settings IS 'Object with tone sliders: {formality: 0-100, friendliness: 0-100, energy: 0-100, confidence: 0-100}';
COMMENT ON COLUMN brand_voice_versions.examples IS 'Object with example copy: {email?: string, sms?: string, longform?: string, social?: string}';
COMMENT ON COLUMN brand_voice_versions.ai_prompt_template IS 'Editable template with variables like {{tone_description}}, {{dos_list}}, etc.';
COMMENT ON COLUMN brand_voice_versions.ai_system_prompt IS 'Generated system prompt for AI agents using this voice';
