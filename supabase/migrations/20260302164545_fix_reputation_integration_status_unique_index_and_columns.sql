/*
  # Fix reputation_integration_status unique index and add missing columns

  1. Index Changes
    - Drop existing unique index on `(org_id)` only
    - Create new unique index on `(org_id, provider)` to support multiple providers per org
    - This fixes the upsert conflict target mismatch in the late-callback edge function

  2. New Columns
    - `sync_success_count` (integer, default 0) - tracks successful sync operations
    - `sync_failure_count` (integer, default 0) - tracks failed sync operations
    - These columns are expected by the frontend IntegrationStatus interface

  3. Important Notes
    - The late-callback edge function uses `onConflict: "org_id,provider"` which requires
      a unique constraint on both columns
    - Previously only `(org_id)` was unique, causing silent upsert failures
    - The table was confirmed empty (no data loss from index change)
*/

DROP INDEX IF EXISTS idx_reputation_integration_status_org;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reputation_integration_status_org_provider
  ON reputation_integration_status (org_id, provider);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_integration_status' AND column_name = 'sync_success_count'
  ) THEN
    ALTER TABLE reputation_integration_status ADD COLUMN sync_success_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_integration_status' AND column_name = 'sync_failure_count'
  ) THEN
    ALTER TABLE reputation_integration_status ADD COLUMN sync_failure_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;