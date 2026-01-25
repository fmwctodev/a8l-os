/*
  # LLM Model Catalog for Dynamic Provider Model Discovery

  This migration creates a table to store models fetched dynamically from LLM
  providers (OpenAI, Anthropic, Google) via their APIs. This enables super admins
  to see and enable the full list of available models including custom/fine-tuned ones.

  1. New Tables
    - `llm_model_catalog` - Stores the complete list of available models from each provider
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations) - Models are org-specific due to API keys
      - `provider` (text) - openai, anthropic, google, custom
      - `model_key` (text) - Unique model identifier from the provider
      - `display_name` (text) - Human-readable model name
      - `context_window` (integer) - Max tokens for the model
      - `capabilities` (jsonb) - Model capabilities like vision, function_calling, etc.
      - `is_deprecated` (boolean) - Whether the model is marked as deprecated
      - `is_enabled` (boolean) - Whether this model is enabled for the org
      - `is_default` (boolean) - Whether this is the org's default model
      - `last_synced_at` (timestamptz) - When the catalog was last synced from provider
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS on the table
    - Super admins can read/write all models for their org
    - Regular users can only read enabled models

  3. Indexes
    - Composite index on (org_id, provider, model_key) for efficient lookups
    - Index on (org_id, is_enabled) for filtering enabled models
*/

-- Create the LLM Model Catalog table
CREATE TABLE IF NOT EXISTS llm_model_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'custom')),
  model_key text NOT NULL,
  display_name text NOT NULL,
  context_window integer,
  capabilities jsonb DEFAULT '{}'::jsonb,
  is_deprecated boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (org_id, provider, model_key)
);

-- Enable RLS
ALTER TABLE llm_model_catalog ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_llm_model_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS llm_model_catalog_updated_at ON llm_model_catalog;
CREATE TRIGGER llm_model_catalog_updated_at
  BEFORE UPDATE ON llm_model_catalog
  FOR EACH ROW EXECUTE FUNCTION update_llm_model_catalog_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_llm_model_catalog_org_provider ON llm_model_catalog(org_id, provider);
CREATE INDEX IF NOT EXISTS idx_llm_model_catalog_org_enabled ON llm_model_catalog(org_id, is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_llm_model_catalog_org_default ON llm_model_catalog(org_id, is_default) WHERE is_default = true;

-- RLS Policies

-- Super admins can view all catalog entries for their org
CREATE POLICY "Super admins can view model catalog"
  ON llm_model_catalog
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = llm_model_catalog.org_id
      AND r.name = 'SuperAdmin'
    )
  );

-- Super admins can insert catalog entries
CREATE POLICY "Super admins can insert model catalog"
  ON llm_model_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = llm_model_catalog.org_id
      AND r.name = 'SuperAdmin'
    )
  );

-- Super admins can update catalog entries
CREATE POLICY "Super admins can update model catalog"
  ON llm_model_catalog
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = llm_model_catalog.org_id
      AND r.name = 'SuperAdmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = llm_model_catalog.org_id
      AND r.name = 'SuperAdmin'
    )
  );

-- Super admins can delete catalog entries
CREATE POLICY "Super admins can delete model catalog"
  ON llm_model_catalog
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = llm_model_catalog.org_id
      AND r.name = 'SuperAdmin'
    )
  );

-- Regular users can view only enabled models for their org
CREATE POLICY "Users can view enabled models"
  ON llm_model_catalog
  FOR SELECT
  TO authenticated
  USING (
    is_enabled = true
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = llm_model_catalog.org_id
    )
  );

-- Function to ensure only one default model per org
CREATE OR REPLACE FUNCTION ensure_single_default_model_catalog()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE llm_model_catalog
    SET is_default = false
    WHERE org_id = NEW.org_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_default_model_catalog_trigger ON llm_model_catalog;
CREATE TRIGGER ensure_single_default_model_catalog_trigger
  BEFORE INSERT OR UPDATE ON llm_model_catalog
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_model_catalog();
