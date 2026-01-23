/*
  # API Keys & Secrets Management Schema
  
  1. Overview
    - Secure storage for API keys, tokens, and sensitive credentials
    - Database-level encryption using Supabase Vault (pg_sodium)
    - Support for dynamic references that pull from other system data
    - Usage tracking and audit logging
  
  2. New Tables
    - `secret_categories` - Categorization for organizing secrets (e.g., "Payment Gateways", "AI Services")
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `name` (text) - Category display name
      - `description` (text) - Optional description
      - `icon` (text) - Lucide icon name
      - `sort_order` (integer) - Display ordering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `org_secrets` - Main secrets storage table
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `category_id` (uuid, references secret_categories, nullable)
      - `name` (text) - Human-readable name
      - `key` (text) - Unique key identifier for referencing (e.g., "STRIPE_SECRET_KEY")
      - `encrypted_value` (bytea) - Encrypted secret value using pg_sodium
      - `value_type` (text) - Type: 'static', 'dynamic', 'rotating'
      - `description` (text) - Optional description
      - `metadata` (jsonb) - Additional metadata (expiry, rotation schedule, etc.)
      - `is_system` (boolean) - System-managed vs user-created
      - `last_used_at` (timestamptz) - Last access timestamp
      - `expires_at` (timestamptz) - Optional expiration
      - `created_by` (uuid, references users)
      - `updated_by` (uuid, references users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `secret_dynamic_refs` - Dynamic reference definitions
      - `id` (uuid, primary key)
      - `secret_id` (uuid, references org_secrets)
      - `ref_path` (text) - JSONPath or dot notation path to source data
      - `source_table` (text) - Source table name
      - `source_filter` (jsonb) - Filter criteria to identify source record
      - `transform` (text) - Optional transformation function
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `secret_usage_log` - Audit log for secret access and usage
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `secret_id` (uuid, references org_secrets)
      - `action` (text) - 'read', 'write', 'rotate', 'delete'
      - `actor_type` (text) - 'user', 'system', 'edge_function', 'workflow'
      - `actor_id` (uuid) - User or system component ID
      - `actor_name` (text) - Display name for audit
      - `ip_address` (inet) - Request IP if available
      - `user_agent` (text) - Request user agent
      - `context` (jsonb) - Additional context data
      - `created_at` (timestamptz)
  
  3. Security
    - Enable RLS on all tables
    - Encryption using pg_sodium via Supabase Vault
    - Audit logging for all secret access
  
  4. Notes
    - The encrypted_value column stores data encrypted with pgsodium
    - Decryption happens in Edge Functions with proper authorization
    - Dynamic references allow pulling values from other tables at runtime
*/

-- Enable pgsodium extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Create secret_categories table
CREATE TABLE IF NOT EXISTS secret_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'key',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Create org_secrets table
CREATE TABLE IF NOT EXISTS org_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES secret_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  key text NOT NULL,
  encrypted_value bytea,
  value_type text NOT NULL DEFAULT 'static' CHECK (value_type IN ('static', 'dynamic', 'rotating')),
  description text,
  metadata jsonb DEFAULT '{}',
  is_system boolean DEFAULT false,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, key)
);

-- Create secret_dynamic_refs table
CREATE TABLE IF NOT EXISTS secret_dynamic_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id uuid NOT NULL REFERENCES org_secrets(id) ON DELETE CASCADE,
  ref_path text NOT NULL,
  source_table text NOT NULL,
  source_filter jsonb DEFAULT '{}',
  transform text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create secret_usage_log table
CREATE TABLE IF NOT EXISTS secret_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  secret_id uuid REFERENCES org_secrets(id) ON DELETE SET NULL,
  secret_key text,
  action text NOT NULL CHECK (action IN ('read', 'write', 'rotate', 'delete', 'create')),
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'system', 'edge_function', 'workflow')),
  actor_id uuid,
  actor_name text,
  ip_address inet,
  user_agent text,
  context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_secret_categories_org ON secret_categories(org_id);
CREATE INDEX IF NOT EXISTS idx_org_secrets_org ON org_secrets(org_id);
CREATE INDEX IF NOT EXISTS idx_org_secrets_category ON org_secrets(category_id);
CREATE INDEX IF NOT EXISTS idx_org_secrets_key ON org_secrets(org_id, key);
CREATE INDEX IF NOT EXISTS idx_org_secrets_expires ON org_secrets(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_secret_dynamic_refs_secret ON secret_dynamic_refs(secret_id);
CREATE INDEX IF NOT EXISTS idx_secret_usage_log_org ON secret_usage_log(org_id);
CREATE INDEX IF NOT EXISTS idx_secret_usage_log_secret ON secret_usage_log(secret_id);
CREATE INDEX IF NOT EXISTS idx_secret_usage_log_created ON secret_usage_log(created_at DESC);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_secret_categories_updated_at ON secret_categories;
CREATE TRIGGER update_secret_categories_updated_at
  BEFORE UPDATE ON secret_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_org_secrets_updated_at ON org_secrets;
CREATE TRIGGER update_org_secrets_updated_at
  BEFORE UPDATE ON org_secrets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_secret_dynamic_refs_updated_at ON secret_dynamic_refs;
CREATE TRIGGER update_secret_dynamic_refs_updated_at
  BEFORE UPDATE ON secret_dynamic_refs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE secret_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_dynamic_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_usage_log ENABLE ROW LEVEL SECURITY;

-- Create encryption key for secrets (stored in vault)
-- This creates a key that will be used for encrypting/decrypting secrets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pgsodium.valid_key 
    WHERE name = 'org_secrets_key'
  ) THEN
    PERFORM pgsodium.create_key(
      name := 'org_secrets_key',
      key_type := 'aead-det'
    );
  END IF;
END $$;

-- Create helper function to encrypt secret values
CREATE OR REPLACE FUNCTION encrypt_secret_value(plain_value text)
RETURNS bytea AS $$
DECLARE
  key_id uuid;
BEGIN
  SELECT id INTO key_id FROM pgsodium.valid_key WHERE name = 'org_secrets_key' LIMIT 1;
  IF key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  RETURN pgsodium.crypto_aead_det_encrypt(
    plain_value::bytea,
    ''::bytea,
    key_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to decrypt secret values
CREATE OR REPLACE FUNCTION decrypt_secret_value(encrypted_value bytea)
RETURNS text AS $$
DECLARE
  key_id uuid;
BEGIN
  IF encrypted_value IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO key_id FROM pgsodium.valid_key WHERE name = 'org_secrets_key' LIMIT 1;
  IF key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  RETURN convert_from(
    pgsodium.crypto_aead_det_decrypt(
      encrypted_value,
      ''::bytea,
      key_id
    ),
    'UTF8'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on encryption functions to authenticated users
GRANT EXECUTE ON FUNCTION encrypt_secret_value(text) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_secret_value(bytea) TO authenticated;