/*
  # Create Integrations Module - Core Schema

  1. New Tables
    - `integrations` - Catalog of available integrations
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `key` (text, unique identifier like 'google_workspace', 'twilio')
      - `name` (text, display name)
      - `description` (text)
      - `icon_url` (text, optional icon)
      - `category` (text - Advertising, CRM_Data, Calendars, Email, Phone, Payments, Storage, AI_LLM, Other)
      - `scope` (text - global or user)
      - `connection_type` (text - oauth, api_key, webhook)
      - `oauth_config` (jsonb - client_id, scopes, auth_url, token_url)
      - `api_key_config` (jsonb - field_name, validation_pattern, test_endpoint)
      - `docs_url` (text, optional documentation link)
      - `settings_path` (text, optional path to existing settings page)
      - `enabled` (boolean)
      - `created_at`, `updated_at`
    
    - `integration_connections` - Actual connections made by orgs/users
      - `id` (uuid, primary key)
      - `integration_id` (uuid, references integrations)
      - `org_id` (uuid, references organizations)
      - `user_id` (uuid, nullable for global connections)
      - `status` (text - connected, disconnected, error)
      - `credentials_encrypted` (text)
      - `credentials_iv` (text)
      - `access_token_encrypted` (text)
      - `refresh_token_encrypted` (text)
      - `token_expires_at` (timestamptz)
      - `account_info` (jsonb - email, name, avatar for display)
      - `error_message` (text)
      - `connected_at` (timestamptz)
      - `connected_by` (uuid)
      - `updated_at` (timestamptz)
    
    - `oauth_states` - Temporary OAuth flow state storage
      - `id` (uuid, primary key)
      - `org_id` (uuid)
      - `user_id` (uuid)
      - `integration_key` (text)
      - `state_token` (text, unique)
      - `redirect_uri` (text)
      - `scope_requested` (text)
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)
    
    - `module_integration_requirements` - Which modules need which integrations
      - `id` (uuid, primary key)
      - `org_id` (uuid)
      - `module_key` (text)
      - `integration_key` (text)
      - `is_required` (boolean)
      - `feature_description` (text)
    
    - `integration_logs` - Audit trail for integration actions
      - `id` (uuid, primary key)
      - `integration_id` (uuid)
      - `org_id` (uuid)
      - `user_id` (uuid)
      - `action` (text - connect, disconnect, enable, disable, test, sync, error)
      - `status` (text - success, failure)
      - `error_message` (text)
      - `request_meta` (jsonb)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Policies created in separate migration
*/

-- Create integrations catalog table
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  icon_url text,
  category text NOT NULL CHECK (category IN ('Advertising', 'CRM_Data', 'Calendars', 'Email', 'Phone', 'Payments', 'Storage', 'AI_LLM', 'Other')),
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'user')),
  connection_type text NOT NULL CHECK (connection_type IN ('oauth', 'api_key', 'webhook')),
  oauth_config jsonb,
  api_key_config jsonb,
  docs_url text,
  settings_path text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, key)
);

-- Create integration connections table
CREATE TABLE IF NOT EXISTS integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  credentials_encrypted text,
  credentials_iv text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  account_info jsonb,
  error_message text,
  connected_at timestamptz,
  connected_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create OAuth states table for secure OAuth flow
CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration_key text NOT NULL,
  state_token text NOT NULL UNIQUE,
  redirect_uri text NOT NULL,
  scope_requested text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);

-- Create module integration requirements table
CREATE TABLE IF NOT EXISTS module_integration_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  integration_key text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  feature_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, module_key, integration_key)
);

-- Create integration logs table
CREATE TABLE IF NOT EXISTS integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('connect', 'disconnect', 'enable', 'disable', 'test', 'sync', 'error', 'token_refresh')),
  status text NOT NULL CHECK (status IN ('success', 'failure')),
  error_message text,
  request_meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_integrations_key ON integrations(key);
CREATE INDEX IF NOT EXISTS idx_integrations_category ON integrations(category);

CREATE INDEX IF NOT EXISTS idx_integration_connections_org_id ON integration_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_user_id ON integration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_integration_id ON integration_connections(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON integration_connections(status);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

CREATE INDEX IF NOT EXISTS idx_module_integration_requirements_org_id ON module_integration_requirements(org_id);
CREATE INDEX IF NOT EXISTS idx_module_integration_requirements_integration_key ON module_integration_requirements(integration_key);

CREATE INDEX IF NOT EXISTS idx_integration_logs_org_id ON integration_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration_id ON integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON integration_logs(created_at);

-- Enable RLS on all tables
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_integration_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_integrations_updated_at();

CREATE TRIGGER integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_integrations_updated_at();

-- Create function to clean up expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
