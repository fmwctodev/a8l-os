/*
  # Remove Duplicate Indexes

  This migration removes redundant indexes that duplicate functionality
  already provided by other indexes or constraints.

  1. Removed Indexes
    - idx_webhook_triggers_token: Duplicates workflow_webhook_triggers_token_key
      (the UNIQUE constraint already creates this index)

  2. Impact
    - Reduces storage overhead
    - Improves write performance (fewer indexes to maintain)
*/

-- Remove duplicate index on workflow_webhook_triggers.token
-- The UNIQUE constraint already creates workflow_webhook_triggers_token_key
DROP INDEX IF EXISTS idx_webhook_triggers_token;
