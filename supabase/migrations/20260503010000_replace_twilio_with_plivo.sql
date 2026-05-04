/*
  # Replace Twilio with Plivo

  Hard cut: drop everything Twilio-shaped, add Plivo-shaped equivalents.
  Voice goes Plivo → Vapi (1:1 number↔assistant). SMS goes Plivo → Clara
  by default, optionally to a user-owned inbox where Clara composes replies.

  Schema changes:
    DROP   twilio_connection, twilio_numbers, twilio_messaging_services,
           messaging_service_senders
    CREATE plivo_connection, plivo_numbers
    ALTER  call_logs           — twilio_call_sid → plivo_call_uuid
    ALTER  phone_test_logs     — twilio_sid → provider_uuid
    ALTER  phone_settings      — drop messaging-service columns,
                                  re-point default_sms_number_id and
                                  default_voice_number_id to plivo_numbers,
                                  add inbound_sms_route default
    KEEP   voice_routing_groups, voice_routing_destinations, dnc_numbers,
           webhook_health (vendor-agnostic)

  Numbers carry their own assignment fields:
    - vapi_assistant_id (1:1 for inbound voice → Vapi)
    - assigned_user_id  (owner for inbound SMS routed to a user inbox)
    - sms_route ('clara' | 'user') — drives plivo-sms-inbound dispatch
*/

-- 1) Drop Twilio FKs from phone_settings BEFORE dropping referenced tables
ALTER TABLE phone_settings
  DROP COLUMN IF EXISTS default_sms_number_id,
  DROP COLUMN IF EXISTS default_messaging_service_id,
  DROP COLUMN IF EXISTS default_voice_number_id;

-- 2) Drop the Twilio messaging-service joiner before its parents
DROP TABLE IF EXISTS messaging_service_senders CASCADE;
DROP TABLE IF EXISTS twilio_messaging_services CASCADE;

-- 3) Drop the Twilio numbers + connection
DROP TABLE IF EXISTS twilio_numbers CASCADE;
DROP TABLE IF EXISTS twilio_connection CASCADE;

-- 4) Rename vendor-specific identifier columns to provider-neutral names
ALTER TABLE call_logs
  RENAME COLUMN twilio_call_sid TO plivo_call_uuid;

ALTER TABLE phone_test_logs
  RENAME COLUMN twilio_sid TO provider_uuid;

-- Drop the legacy sms_mode enum (only Twilio used messaging_service mode)
DROP TYPE IF EXISTS sms_mode CASCADE;

-- 5) New enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plivo_sms_route') THEN
    CREATE TYPE plivo_sms_route AS ENUM ('clara', 'user');
  END IF;
END $$;

-- 6) plivo_connection — credentials per org
CREATE TABLE IF NOT EXISTS plivo_connection (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  auth_id                  text NOT NULL,
  auth_token_encrypted     text NOT NULL,
  subaccount_auth_id       text,
  friendly_name            text,
  status                   phone_provider_status NOT NULL DEFAULT 'disconnected',
  connected_at             timestamptz,
  connected_by             uuid REFERENCES users(id),
  vapi_sip_username        text,
  vapi_sip_password_encrypted text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

-- 7) plivo_numbers — synced from Plivo, with assignment fields baked in
CREATE TABLE IF NOT EXISTS plivo_numbers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number        text NOT NULL,
  plivo_number_uuid   text NOT NULL,
  friendly_name       text,
  capabilities        jsonb NOT NULL DEFAULT '{"sms": false, "mms": false, "voice": false}',
  country_code        text,
  status              phone_number_status NOT NULL DEFAULT 'active',

  -- SMS routing
  sms_route           plivo_sms_route NOT NULL DEFAULT 'clara',
  assigned_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  is_default_sms      boolean NOT NULL DEFAULT false,

  -- Voice routing (1:1 with a Vapi assistant)
  vapi_assistant_id   uuid REFERENCES vapi_assistants(id) ON DELETE SET NULL,
  is_default_voice    boolean NOT NULL DEFAULT false,

  -- Department + webhook hookup
  department_id       uuid REFERENCES departments(id) ON DELETE SET NULL,
  webhook_configured  boolean NOT NULL DEFAULT false,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, phone_number),
  UNIQUE (org_id, plivo_number_uuid)
);

CREATE INDEX IF NOT EXISTS idx_plivo_numbers_org              ON plivo_numbers(org_id);
CREATE INDEX IF NOT EXISTS idx_plivo_numbers_assigned_user    ON plivo_numbers(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_plivo_numbers_vapi_assistant   ON plivo_numbers(vapi_assistant_id);
CREATE INDEX IF NOT EXISTS idx_plivo_numbers_phone_number     ON plivo_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_plivo_numbers_active           ON plivo_numbers(org_id, status);

CREATE INDEX IF NOT EXISTS idx_plivo_connection_org           ON plivo_connection(org_id);

-- 8) Re-add the default-number columns on phone_settings, now pointing at plivo_numbers
ALTER TABLE phone_settings
  ADD COLUMN IF NOT EXISTS default_sms_number_id   uuid REFERENCES plivo_numbers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_voice_number_id uuid REFERENCES plivo_numbers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inbound_sms_route       plivo_sms_route NOT NULL DEFAULT 'clara';

-- 9) updated_at triggers
DROP TRIGGER IF EXISTS update_plivo_connection_updated_at ON plivo_connection;
CREATE TRIGGER update_plivo_connection_updated_at
  BEFORE UPDATE ON plivo_connection
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plivo_numbers_updated_at ON plivo_numbers;
CREATE TRIGGER update_plivo_numbers_updated_at
  BEFORE UPDATE ON plivo_numbers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10) RLS — same per-org policy pattern used elsewhere
ALTER TABLE plivo_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE plivo_numbers     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plivo_connection_org_select ON plivo_connection;
CREATE POLICY plivo_connection_org_select ON plivo_connection
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS plivo_numbers_org_select ON plivo_numbers;
CREATE POLICY plivo_numbers_org_select ON plivo_numbers
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS plivo_numbers_org_modify ON plivo_numbers;
CREATE POLICY plivo_numbers_org_modify ON plivo_numbers
  FOR ALL TO authenticated
  USING (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
