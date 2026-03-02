/*
  # Extend Reputation Settings - SLA, Routing, Escalation, AI Temperature, Signature

  1. Modified Tables
    - `reputation_settings`
      - `default_temperature` (numeric) - AI temperature for reply generation, default 0.7
      - `default_signature` (text) - Signature appended to AI replies
      - `auto_append_signature` (boolean) - Whether to auto-append signature, default false
      - `sla_hours_positive` (integer) - SLA hours for positive reviews, default 48
      - `sla_hours_negative` (integer) - SLA hours for negative reviews, default 4
      - `escalation_email` (text) - Email address for escalation notifications
      - `escalation_user_id` (uuid) - User to assign escalated reviews
      - `escalation_keywords` (text[]) - Keywords that trigger auto-escalation
      - `auto_route_negative` (uuid) - User to auto-route negative reviews to
      - `auto_route_positive` (uuid) - User to auto-route positive reviews to

  2. Important Notes
    - All columns use IF NOT EXISTS to be idempotent
    - Foreign key references to users table with ON DELETE SET NULL
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'default_temperature'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN default_temperature numeric DEFAULT 0.7;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'default_signature'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN default_signature text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'auto_append_signature'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN auto_append_signature boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'sla_hours_positive'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN sla_hours_positive integer DEFAULT 48;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'sla_hours_negative'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN sla_hours_negative integer DEFAULT 4;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'escalation_email'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN escalation_email text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'escalation_user_id'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN escalation_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'escalation_keywords'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN escalation_keywords text[] DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'auto_route_negative'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN auto_route_negative uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'auto_route_positive'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN auto_route_positive uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;