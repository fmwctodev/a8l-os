/*
  # Add archived_at column to proposals table

  1. Modified Tables
    - `proposals`
      - Added `archived_at` (timestamptz, nullable) - tracks when a proposal was archived

  2. Notes
    - Column defaults to NULL (not archived)
    - Used by the proposals service for soft-delete/archive functionality
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE proposals ADD COLUMN archived_at timestamptz DEFAULT NULL;
  END IF;
END $$;
