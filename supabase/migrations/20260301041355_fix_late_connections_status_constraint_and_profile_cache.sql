/*
  # Fix late_connections status constraint and add profile cache support

  1. Changes
    - Drop the restrictive status CHECK constraint
    - Add a new one that also allows 'active' (used for profile cache rows)
    - Add `published_at` column to social_posts for Late.dev confirmed publish timestamp
  
  2. Notes
    - The late-connect function stores a "_profile_cache" row with status='active'
      to remember the Late.dev profile ID per org. The old constraint blocked this.
*/

ALTER TABLE late_connections
  DROP CONSTRAINT IF EXISTS late_connections_status_check;

ALTER TABLE late_connections
  ADD CONSTRAINT late_connections_status_check
  CHECK (status IN ('connected', 'expired', 'error', 'active'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN published_at timestamptz;
  END IF;
END $$;
