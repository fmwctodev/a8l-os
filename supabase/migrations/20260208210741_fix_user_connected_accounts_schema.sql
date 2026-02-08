/*
  # Fix user_connected_accounts Schema Mismatch

  The table was created by an earlier migration with different column names
  than what the application code expects. This migration renames columns and
  adjusts constraints to align the database with the codebase.

  1. Column Renames
    - `external_account_id` -> `provider_account_id`
    - `external_email` -> `provider_account_email`

  2. New Columns
    - `scopes` (text[], nullable) - OAuth scopes granted by the user
    - `connected_at` (timestamptz, default now()) - When the account was connected
    - `last_synced_at` (timestamptz, nullable) - Last sync timestamp

  3. Constraint Changes
    - Drop `user_connected_accounts_provider_check` (was restricted to only 'google')
    - Make `provider_account_id` nullable for flexibility
    - Make `provider_account_email` nullable for flexibility

  4. Important Notes
    - Table has zero rows so renames are safe
    - RLS policies are unchanged (they only reference user_id)
    - Unique constraint on (user_id, provider) is preserved
*/

-- Rename columns to match application code
ALTER TABLE user_connected_accounts RENAME COLUMN external_account_id TO provider_account_id;
ALTER TABLE user_connected_accounts RENAME COLUMN external_email TO provider_account_email;

-- Make renamed columns nullable for flexibility
ALTER TABLE user_connected_accounts ALTER COLUMN provider_account_id DROP NOT NULL;
ALTER TABLE user_connected_accounts ALTER COLUMN provider_account_email DROP NOT NULL;

-- Drop restrictive provider CHECK (only allowed 'google')
ALTER TABLE user_connected_accounts DROP CONSTRAINT IF EXISTS user_connected_accounts_provider_check;

-- Add missing columns that the code expects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_connected_accounts' AND column_name = 'scopes'
  ) THEN
    ALTER TABLE user_connected_accounts ADD COLUMN scopes text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_connected_accounts' AND column_name = 'connected_at'
  ) THEN
    ALTER TABLE user_connected_accounts ADD COLUMN connected_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_connected_accounts' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE user_connected_accounts ADD COLUMN last_synced_at timestamptz;
  END IF;
END $$;
