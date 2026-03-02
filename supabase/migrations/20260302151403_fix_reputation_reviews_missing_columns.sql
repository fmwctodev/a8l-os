/*
  # Fix reputation_reviews - add missing columns

  The initial migration partially failed. This adds missing columns
  and the SLA index.

  1. Added Columns
    - `reply_id` (text) - Late.dev reply identifier
    - `reply_text` (text) - Current reply text
    - `reply_created_at` (timestamptz)
    - `sla_breached` (boolean) - Whether SLA target was missed
    - `escalated` (boolean) - Whether review was escalated

  2. Indexes
    - Partial index on sla_breached reviews
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_reviews' AND column_name = 'reply_id'
  ) THEN
    ALTER TABLE reputation_reviews ADD COLUMN reply_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_reviews' AND column_name = 'reply_text'
  ) THEN
    ALTER TABLE reputation_reviews ADD COLUMN reply_text text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_reviews' AND column_name = 'reply_created_at'
  ) THEN
    ALTER TABLE reputation_reviews ADD COLUMN reply_created_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_reviews' AND column_name = 'sla_breached'
  ) THEN
    ALTER TABLE reputation_reviews ADD COLUMN sla_breached boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_reviews' AND column_name = 'escalated'
  ) THEN
    ALTER TABLE reputation_reviews ADD COLUMN escalated boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reputation_reviews_sla_breached
  ON reputation_reviews(org_id) WHERE sla_breached = true;

-- Also add missing settings columns
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
    ALTER TABLE reputation_settings ADD COLUMN auto_append_signature boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'default_temperature'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN default_temperature numeric DEFAULT 0.4;
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
    ALTER TABLE reputation_settings ADD COLUMN sla_hours_negative integer DEFAULT 12;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'auto_route_negative'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN auto_route_negative boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'auto_route_positive'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN auto_route_positive boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'escalation_keywords'
  ) THEN
    ALTER TABLE reputation_settings ADD COLUMN escalation_keywords text[] DEFAULT '{refund,lawsuit,attorney,scam,lawyer,legal}';
  END IF;
END $$;
