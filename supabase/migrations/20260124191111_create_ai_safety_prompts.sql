/*
  # AI Safety Prompts Table

  This migration creates the safety prompts table for runtime-enforced
  restrictions that are automatically injected into every AI agent run.

  1. New Tables
    - `ai_safety_prompts` - Safety rules enforced at runtime
      - `org_id` (uuid, PK, FK to organizations)
      - `restricted_topics` (text) - Topics agents should not discuss
      - `disallowed_outputs` (text) - Phrases/patterns to never generate
      - `escalation_triggers` (text) - Language that triggers human handoff
      - `is_active` (boolean) - Whether safety prompts are enabled
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Only admins can modify safety prompts

  3. Notes
    - These prompts are injected into every AI agent run at runtime
    - The is_active flag allows temporarily disabling without deleting config
*/

-- AI Safety Prompts table
CREATE TABLE IF NOT EXISTS ai_safety_prompts (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  restricted_topics text NOT NULL DEFAULT '',
  disallowed_outputs text NOT NULL DEFAULT '',
  escalation_triggers text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_safety_prompts ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger
DROP TRIGGER IF EXISTS ai_safety_prompts_updated_at ON ai_safety_prompts;
CREATE TRIGGER ai_safety_prompts_updated_at
  BEFORE UPDATE ON ai_safety_prompts
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();
