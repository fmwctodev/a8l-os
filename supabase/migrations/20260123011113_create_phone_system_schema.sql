/*
  # Phone System (Twilio) Settings Module Schema

  1. New Enums
    - `phone_provider_status` - connected, disconnected
    - `phone_number_status` - active, disabled
    - `sms_mode` - number, messaging_service
    - `routing_strategy` - simultaneous, sequential

  2. New Tables
    - `twilio_connection` - Stores Twilio credentials and connection status
    - `twilio_numbers` - Phone numbers synced from Twilio
    - `twilio_messaging_services` - Messaging services from Twilio
    - `messaging_service_senders` - Join table linking services to numbers
    - `voice_routing_groups` - Ring groups for voice routing
    - `voice_routing_destinations` - Destination numbers in routing groups
    - `phone_settings` - Organization phone settings (one per org)
    - `dnc_numbers` - Do Not Call list
    - `phone_test_logs` - Test SMS/call history
    - `webhook_health` - Webhook status tracking

  3. Modifications
    - Add `dnc` column to contacts table for integrated DNC blocking

  4. Security
    - RLS enabled on all tables (policies in separate migration)
    - Encrypted auth token storage via edge function
*/

-- Create enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'phone_provider_status') THEN
    CREATE TYPE phone_provider_status AS ENUM ('connected', 'disconnected');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'phone_number_status') THEN
    CREATE TYPE phone_number_status AS ENUM ('active', 'disabled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sms_mode') THEN
    CREATE TYPE sms_mode AS ENUM ('number', 'messaging_service');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'routing_strategy') THEN
    CREATE TYPE routing_strategy AS ENUM ('simultaneous', 'sequential');
  END IF;
END $$;

-- Twilio Connection table
CREATE TABLE IF NOT EXISTS twilio_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_sid text NOT NULL,
  auth_token_encrypted text NOT NULL,
  subaccount_sid text,
  friendly_name text,
  status phone_provider_status NOT NULL DEFAULT 'disconnected',
  connected_at timestamptz,
  connected_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- Twilio Numbers table
CREATE TABLE IF NOT EXISTS twilio_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  phone_sid text NOT NULL,
  friendly_name text,
  capabilities jsonb NOT NULL DEFAULT '{"sms": false, "mms": false, "voice": false}',
  country_code text,
  status phone_number_status NOT NULL DEFAULT 'active',
  is_default_sms boolean NOT NULL DEFAULT false,
  is_default_voice boolean NOT NULL DEFAULT false,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  webhook_configured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, phone_number),
  UNIQUE(org_id, phone_sid)
);

-- Twilio Messaging Services table
CREATE TABLE IF NOT EXISTS twilio_messaging_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_sid text NOT NULL,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  status phone_number_status NOT NULL DEFAULT 'active',
  a2p_registered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, service_sid)
);

-- Messaging Service Senders join table
CREATE TABLE IF NOT EXISTS messaging_service_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES twilio_messaging_services(id) ON DELETE CASCADE,
  number_id uuid NOT NULL REFERENCES twilio_numbers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id, number_id)
);

-- Voice Routing Groups table
CREATE TABLE IF NOT EXISTS voice_routing_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  strategy routing_strategy NOT NULL DEFAULT 'simultaneous',
  ring_timeout integer NOT NULL DEFAULT 30,
  fallback_number text,
  is_default boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Voice Routing Destinations table
CREATE TABLE IF NOT EXISTS voice_routing_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES voice_routing_groups(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Phone Settings table (one per org)
CREATE TABLE IF NOT EXISTS phone_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  default_sms_mode sms_mode NOT NULL DEFAULT 'number',
  default_sms_number_id uuid REFERENCES twilio_numbers(id) ON DELETE SET NULL,
  default_messaging_service_id uuid REFERENCES twilio_messaging_services(id) ON DELETE SET NULL,
  default_voice_number_id uuid REFERENCES twilio_numbers(id) ON DELETE SET NULL,
  default_routing_group_id uuid REFERENCES voice_routing_groups(id) ON DELETE SET NULL,
  call_timeout integer NOT NULL DEFAULT 30,
  voicemail_fallback_number text,
  record_inbound_calls boolean NOT NULL DEFAULT false,
  record_outbound_calls boolean NOT NULL DEFAULT false,
  record_voicemail boolean NOT NULL DEFAULT true,
  recording_retention_days integer NOT NULL DEFAULT 90,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  quiet_hours_timezone text DEFAULT 'America/New_York',
  business_name text,
  opt_out_language text DEFAULT 'Reply STOP to unsubscribe',
  auto_append_opt_out boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- DNC Numbers table
CREATE TABLE IF NOT EXISTS dnc_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  reason text,
  added_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, phone_number)
);

-- Phone Test Logs table
CREATE TABLE IF NOT EXISTS phone_test_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  test_type text NOT NULL CHECK (test_type IN ('sms', 'call')),
  to_number text NOT NULL,
  from_number text NOT NULL,
  message_body text,
  status text NOT NULL,
  twilio_sid text,
  error_message text,
  tested_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Webhook Health table
CREATE TABLE IF NOT EXISTS webhook_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  webhook_type text NOT NULL CHECK (webhook_type IN ('sms', 'voice', 'status')),
  last_received_at timestamptz,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, webhook_type)
);

-- Add dnc column to contacts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'dnc'
  ) THEN
    ALTER TABLE contacts ADD COLUMN dnc boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_twilio_connection_org_id ON twilio_connection(org_id);
CREATE INDEX IF NOT EXISTS idx_twilio_numbers_org_id ON twilio_numbers(org_id);
CREATE INDEX IF NOT EXISTS idx_twilio_numbers_status ON twilio_numbers(org_id, status);
CREATE INDEX IF NOT EXISTS idx_twilio_numbers_phone ON twilio_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_twilio_messaging_services_org_id ON twilio_messaging_services(org_id);
CREATE INDEX IF NOT EXISTS idx_messaging_service_senders_service ON messaging_service_senders(service_id);
CREATE INDEX IF NOT EXISTS idx_voice_routing_groups_org_id ON voice_routing_groups(org_id);
CREATE INDEX IF NOT EXISTS idx_voice_routing_destinations_group ON voice_routing_destinations(group_id);
CREATE INDEX IF NOT EXISTS idx_phone_settings_org_id ON phone_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_dnc_numbers_org_id ON dnc_numbers(org_id);
CREATE INDEX IF NOT EXISTS idx_dnc_numbers_phone ON dnc_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_test_logs_org_id ON phone_test_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_health_org_id ON webhook_health(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_dnc ON contacts(organization_id, dnc) WHERE dnc = true;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_twilio_connection_updated_at ON twilio_connection;
CREATE TRIGGER update_twilio_connection_updated_at
  BEFORE UPDATE ON twilio_connection
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_twilio_numbers_updated_at ON twilio_numbers;
CREATE TRIGGER update_twilio_numbers_updated_at
  BEFORE UPDATE ON twilio_numbers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_twilio_messaging_services_updated_at ON twilio_messaging_services;
CREATE TRIGGER update_twilio_messaging_services_updated_at
  BEFORE UPDATE ON twilio_messaging_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_voice_routing_groups_updated_at ON voice_routing_groups;
CREATE TRIGGER update_voice_routing_groups_updated_at
  BEFORE UPDATE ON voice_routing_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_voice_routing_destinations_updated_at ON voice_routing_destinations;
CREATE TRIGGER update_voice_routing_destinations_updated_at
  BEFORE UPDATE ON voice_routing_destinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_phone_settings_updated_at ON phone_settings;
CREATE TRIGGER update_phone_settings_updated_at
  BEFORE UPDATE ON phone_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhook_health_updated_at ON webhook_health;
CREATE TRIGGER update_webhook_health_updated_at
  BEFORE UPDATE ON webhook_health
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE twilio_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE twilio_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE twilio_messaging_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_service_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_routing_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_routing_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_test_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_health ENABLE ROW LEVEL SECURITY;
