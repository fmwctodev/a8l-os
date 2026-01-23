/*
  # Email Services Module Schema

  1. Overview
    - Creates comprehensive schema for SendGrid email integration
    - Supports provider connections, domain authentication, from addresses, unsubscribe groups
    - Includes audit-friendly test logging

  2. New Types
    - `email_provider_status` enum: 'connected', 'disconnected'
    - `email_domain_status` enum: 'pending', 'verified', 'failed'

  3. New Tables
    - `email_providers` - SendGrid API connection per organization
    - `email_domains` - Authenticated sender domains
    - `email_from_addresses` - Configured from addresses
    - `email_unsubscribe_groups` - SendGrid ASM groups
    - `email_defaults` - Organization email sending defaults
    - `email_test_logs` - Test email history

  4. Security
    - All tables have RLS enabled (policies in separate migration)
    - API keys stored with application-level encryption
    - Sensitive columns protected at query level

  5. Notes
    - api_key_encrypted uses AES-256-GCM encryption
    - api_key_iv stores initialization vector for decryption
*/

-- Create enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_provider_status') THEN
    CREATE TYPE email_provider_status AS ENUM ('connected', 'disconnected');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_domain_status') THEN
    CREATE TYPE email_domain_status AS ENUM ('pending', 'verified', 'failed');
  END IF;
END $$;

-- Email Providers table (one per organization)
CREATE TABLE IF NOT EXISTS email_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'sendgrid',
  api_key_encrypted text,
  api_key_iv text,
  account_nickname text,
  status email_provider_status NOT NULL DEFAULT 'disconnected',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_providers_org_unique UNIQUE (org_id)
);

-- Email Domains table
CREATE TABLE IF NOT EXISTS email_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  sendgrid_domain_id text,
  status email_domain_status NOT NULL DEFAULT 'pending',
  dns_records jsonb DEFAULT '[]'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_domains_org_domain_unique UNIQUE (org_id, domain)
);

-- Email From Addresses table
CREATE TABLE IF NOT EXISTS email_from_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text NOT NULL,
  domain_id uuid REFERENCES email_domains(id) ON DELETE SET NULL,
  reply_to text,
  sendgrid_sender_id text,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_from_addresses_org_email_unique UNIQUE (org_id, email)
);

-- Email Unsubscribe Groups table
CREATE TABLE IF NOT EXISTS email_unsubscribe_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sendgrid_group_id text NOT NULL,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_unsubscribe_groups_org_sgid_unique UNIQUE (org_id, sendgrid_group_id)
);

-- Email Defaults table (one per organization)
CREATE TABLE IF NOT EXISTS email_defaults (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  default_from_address_id uuid REFERENCES email_from_addresses(id) ON DELETE SET NULL,
  default_reply_to text,
  default_unsubscribe_group_id uuid REFERENCES email_unsubscribe_groups(id) ON DELETE SET NULL,
  track_opens boolean NOT NULL DEFAULT true,
  track_clicks boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email Test Logs table
CREATE TABLE IF NOT EXISTS email_test_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sent_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_email text NOT NULL,
  from_address_id uuid REFERENCES email_from_addresses(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  error_message text,
  sendgrid_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_providers_org_id ON email_providers(org_id);
CREATE INDEX IF NOT EXISTS idx_email_domains_org_id ON email_domains(org_id);
CREATE INDEX IF NOT EXISTS idx_email_domains_org_status ON email_domains(org_id, status);
CREATE INDEX IF NOT EXISTS idx_email_from_addresses_org_id ON email_from_addresses(org_id);
CREATE INDEX IF NOT EXISTS idx_email_from_addresses_domain_id ON email_from_addresses(domain_id);
CREATE INDEX IF NOT EXISTS idx_email_unsubscribe_groups_org_id ON email_unsubscribe_groups(org_id);
CREATE INDEX IF NOT EXISTS idx_email_test_logs_org_id ON email_test_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_email_test_logs_sent_at ON email_test_logs(sent_at DESC);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_email_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_providers_updated_at ON email_providers;
CREATE TRIGGER email_providers_updated_at
  BEFORE UPDATE ON email_providers
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

DROP TRIGGER IF EXISTS email_domains_updated_at ON email_domains;
CREATE TRIGGER email_domains_updated_at
  BEFORE UPDATE ON email_domains
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

DROP TRIGGER IF EXISTS email_from_addresses_updated_at ON email_from_addresses;
CREATE TRIGGER email_from_addresses_updated_at
  BEFORE UPDATE ON email_from_addresses
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

DROP TRIGGER IF EXISTS email_unsubscribe_groups_updated_at ON email_unsubscribe_groups;
CREATE TRIGGER email_unsubscribe_groups_updated_at
  BEFORE UPDATE ON email_unsubscribe_groups
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

DROP TRIGGER IF EXISTS email_defaults_updated_at ON email_defaults;
CREATE TRIGGER email_defaults_updated_at
  BEFORE UPDATE ON email_defaults
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

-- Enable RLS on all tables
ALTER TABLE email_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_from_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribe_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_test_logs ENABLE ROW LEVEL SECURITY;
