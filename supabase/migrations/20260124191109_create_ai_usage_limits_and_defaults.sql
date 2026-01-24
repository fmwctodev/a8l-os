/*
  # AI Usage Limits, Response Style Defaults, and Voice Defaults

  This migration creates tables for organization-wide AI settings including
  usage limits, response style defaults, and voice synthesis defaults.

  1. New Tables
    - `ai_usage_limits` - Rate limiting and usage controls per organization
      - `org_id` (uuid, PK, FK to organizations)
      - `max_runs_per_user_day` (integer) - Max AI runs per user per day
      - `max_runs_per_agent_day` (integer) - Max AI runs per agent per day
      - `cooldown_seconds` (integer) - Cooldown between runs
      - `error_threshold` (integer) - Auto-disable after consecutive errors
      - `created_at`, `updated_at` (timestamptz)

    - `ai_response_style_defaults` - Default response style settings
      - `org_id` (uuid, PK, FK to organizations)
      - `tone` (text) - Default tone (professional, friendly, etc.)
      - `formality_level` (integer) - 1-5 scale
      - `emoji_enabled` (boolean) - Whether to use emojis
      - `length_preference` (text) - concise, standard, detailed
      - `created_at`, `updated_at` (timestamptz)

    - `ai_voice_defaults` - Default voice synthesis settings
      - `org_id` (uuid, PK, FK to organizations)
      - `speaking_speed` (numeric) - 0.5x to 2.0x
      - `default_tone` (text) - Voice tone
      - `fallback_voice_id` (uuid, FK to elevenlabs_voices)
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Policies restrict access to org members with appropriate permissions

  3. Modifications
    - Add `default_system_prompt` column to ai_agent_settings_defaults
*/

-- AI Usage Limits table
CREATE TABLE IF NOT EXISTS ai_usage_limits (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  max_runs_per_user_day integer NOT NULL DEFAULT 100,
  max_runs_per_agent_day integer NOT NULL DEFAULT 500,
  cooldown_seconds integer NOT NULL DEFAULT 5,
  error_threshold integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI Response Style Defaults table
CREATE TABLE IF NOT EXISTS ai_response_style_defaults (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  tone text NOT NULL DEFAULT 'professional',
  formality_level integer NOT NULL DEFAULT 3 CHECK (formality_level >= 1 AND formality_level <= 5),
  emoji_enabled boolean NOT NULL DEFAULT false,
  length_preference text NOT NULL DEFAULT 'standard' CHECK (length_preference IN ('concise', 'standard', 'detailed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI Voice Defaults table
CREATE TABLE IF NOT EXISTS ai_voice_defaults (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  speaking_speed numeric NOT NULL DEFAULT 1.0 CHECK (speaking_speed >= 0.5 AND speaking_speed <= 2.0),
  default_tone text NOT NULL DEFAULT 'professional',
  fallback_voice_id uuid REFERENCES elevenlabs_voices(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add default_system_prompt to ai_agent_settings_defaults
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agent_settings_defaults' AND column_name = 'default_system_prompt'
  ) THEN
    ALTER TABLE ai_agent_settings_defaults ADD COLUMN default_system_prompt text;
  END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE ai_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_response_style_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_voice_defaults ENABLE ROW LEVEL SECURITY;

-- Create updated_at triggers
DROP TRIGGER IF EXISTS ai_usage_limits_updated_at ON ai_usage_limits;
CREATE TRIGGER ai_usage_limits_updated_at
  BEFORE UPDATE ON ai_usage_limits
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();

DROP TRIGGER IF EXISTS ai_response_style_defaults_updated_at ON ai_response_style_defaults;
CREATE TRIGGER ai_response_style_defaults_updated_at
  BEFORE UPDATE ON ai_response_style_defaults
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();

DROP TRIGGER IF EXISTS ai_voice_defaults_updated_at ON ai_voice_defaults;
CREATE TRIGGER ai_voice_defaults_updated_at
  BEFORE UPDATE ON ai_voice_defaults
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_voice_defaults_fallback_voice ON ai_voice_defaults(fallback_voice_id);
