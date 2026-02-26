/*
  # Add Unipile Integration Columns

  1. Modified Tables
    - `social_accounts`
      - `unipile_account_id` (text, nullable) - Unipile's internal account identifier for API calls
    - `social_posts`
      - `unipile_response` (jsonb, nullable) - Raw response payload from Unipile publish API

  2. Indexes
    - Unique index on social_accounts(organization_id, unipile_account_id) for fast lookups
    - Index on social_accounts(unipile_account_id) for webhook matching

  3. Important Notes
    - These columns enable the transition from direct platform OAuth/APIs to Unipile as the unified social publishing layer
    - Existing direct-API columns (access_token_encrypted, etc.) are preserved for backward compatibility
    - unipile_account_id is the primary identifier used for all Unipile API calls (posting, status checks)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'unipile_account_id'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN unipile_account_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'unipile_response'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN unipile_response jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_accounts_unipile_account_id
  ON social_accounts(unipile_account_id)
  WHERE unipile_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_org_unipile_id
  ON social_accounts(organization_id, unipile_account_id)
  WHERE unipile_account_id IS NOT NULL;
