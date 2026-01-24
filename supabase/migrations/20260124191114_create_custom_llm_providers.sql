/*
  # Custom LLM Providers Table

  This migration creates support for custom/self-hosted LLM API providers
  beyond the built-in OpenAI, Anthropic, and Google providers.

  1. New Tables
    - `custom_llm_providers` - Custom API provider configurations
      - `id` (uuid, PK)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - Display name for the provider
      - `base_url` (text) - API endpoint URL
      - `api_key_encrypted` (text) - Encrypted API key
      - `auth_method` (text) - Authentication method
      - `custom_headers` (jsonb) - Additional headers
      - `request_format` (text) - API format compatibility
      - `enabled` (boolean) - Whether provider is active
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Only admins can manage custom providers
*/

-- Create auth method enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_llm_auth_method') THEN
    CREATE TYPE custom_llm_auth_method AS ENUM ('bearer', 'api_key_header', 'custom');
  END IF;
END $$;

-- Create request format enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_llm_request_format') THEN
    CREATE TYPE custom_llm_request_format AS ENUM ('openai', 'anthropic', 'custom');
  END IF;
END $$;

-- Custom LLM Providers table
CREATE TABLE IF NOT EXISTS custom_llm_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_url text NOT NULL,
  api_key_encrypted text NOT NULL,
  auth_method custom_llm_auth_method NOT NULL DEFAULT 'bearer',
  custom_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_format custom_llm_request_format NOT NULL DEFAULT 'openai',
  enabled boolean NOT NULL DEFAULT false,
  last_tested_at timestamptz,
  last_test_success boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Enable RLS
ALTER TABLE custom_llm_providers ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_custom_llm_providers_org ON custom_llm_providers(org_id);
CREATE INDEX IF NOT EXISTS idx_custom_llm_providers_enabled ON custom_llm_providers(org_id, enabled);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS custom_llm_providers_updated_at ON custom_llm_providers;
CREATE TRIGGER custom_llm_providers_updated_at
  BEFORE UPDATE ON custom_llm_providers
  FOR EACH ROW EXECUTE FUNCTION update_ai_settings_updated_at();
