/*
  # Fix auto_route columns to boolean type

  1. Modified Tables
    - `reputation_settings`
      - `auto_route_negative` changed from uuid to boolean (toggle for auto-routing negative reviews)
      - `auto_route_positive` changed from uuid to boolean (toggle for auto-routing positive reviews)

  2. Important Notes
    - These columns are used as on/off toggles in the UI
    - Actual user assignment for routing is handled by the reputation_routing_rules table
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'auto_route_negative'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE reputation_settings ALTER COLUMN auto_route_negative TYPE boolean USING false;
    ALTER TABLE reputation_settings ALTER COLUMN auto_route_negative SET DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'auto_route_positive'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE reputation_settings ALTER COLUMN auto_route_positive TYPE boolean USING false;
    ALTER TABLE reputation_settings ALTER COLUMN auto_route_positive SET DEFAULT false;
  END IF;
END $$;