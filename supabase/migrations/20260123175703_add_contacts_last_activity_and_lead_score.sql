/*
  # Contacts Module Enhancement - Last Activity and Lead Score Support

  ## Overview
  This migration adds columns and indexes to support enhanced contact filtering,
  sorting, and display capabilities for GHL parity.

  ## 1. Changes to contacts table
    - `last_activity_at` (timestamptz) - Tracks when the last activity occurred for this contact
    - `lead_score` (integer) - Cached lead score for quick filtering and display

  ## 2. New Indexes
    - Index on last_activity_at for sorting
    - Index on lead_score for range filtering
    - Index on created_at for date range filtering

  ## 3. Function
    - Function to update last_activity_at when timeline events are added

  ## Notes
    - lead_score is cached from the scoring module for performance
    - last_activity_at is updated automatically via trigger
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE contacts ADD COLUMN last_activity_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'lead_score'
  ) THEN
    ALTER TABLE contacts ADD COLUMN lead_score integer DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_last_activity 
  ON contacts(last_activity_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_contacts_lead_score 
  ON contacts(lead_score DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_created_at 
  ON contacts(created_at DESC);

CREATE OR REPLACE FUNCTION update_contact_last_activity()
RETURNS TRIGGER AS $func$
BEGIN
  UPDATE contacts
  SET last_activity_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_contact_last_activity ON contact_timeline;
CREATE TRIGGER trigger_update_contact_last_activity
  AFTER INSERT ON contact_timeline
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_last_activity();

UPDATE contacts c
SET last_activity_at = COALESCE(
  (SELECT MAX(created_at) FROM contact_timeline WHERE contact_id = c.id),
  c.created_at
)
WHERE c.last_activity_at IS NULL OR c.last_activity_at = c.created_at;
