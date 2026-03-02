/*
  # Remove Anthropic Provider and Consolidate to OpenAI GPT-5.2

  1. Changes to `llm_model_catalog`
    - Delete all rows with provider = 'anthropic'
    - Update CHECK constraint to remove 'anthropic' option
  
  2. Changes to `llm_models`
    - Delete all Anthropic-linked models
  
  3. Changes to `llm_providers`
    - Disable all Anthropic providers (preserved for audit trail)

  4. Changes to `reputation_settings`
    - Update ai_provider CHECK constraint to only allow 'openai'
    - Update any non-openai rows to 'openai'

  5. Changes to `custom_llm_providers`
    - Update rows with 'anthropic' request_format to 'openai'

  6. Changes to `custom_llm_request_format` enum
    - Recreate without 'anthropic' value

  7. Seed data
    - Insert gpt-5.2-chat-latest model for each org that has an OpenAI provider

  8. Important Notes
    - All Anthropic references are removed from the database
    - Existing Anthropic provider rows are disabled (not deleted) to preserve audit trail
    - The only supported AI providers going forward are: openai, google, custom
*/

-- 1. Clean up llm_model_catalog: remove anthropic rows
DELETE FROM llm_model_catalog WHERE provider = 'anthropic';

-- Update the CHECK constraint on llm_model_catalog.provider
ALTER TABLE llm_model_catalog DROP CONSTRAINT IF EXISTS llm_model_catalog_provider_check;
ALTER TABLE llm_model_catalog ADD CONSTRAINT llm_model_catalog_provider_check
  CHECK (provider IN ('openai', 'google', 'custom'));

-- 2. Delete Anthropic-linked llm_models
DELETE FROM llm_models
WHERE provider_id IN (
  SELECT id FROM llm_providers WHERE provider = 'anthropic'
);

-- 3. Disable Anthropic providers (preserve for audit)
UPDATE llm_providers SET enabled = false WHERE provider = 'anthropic';

-- 4. Update reputation_settings
UPDATE reputation_settings SET ai_provider = 'openai' WHERE ai_provider != 'openai';

ALTER TABLE reputation_settings DROP CONSTRAINT IF EXISTS reputation_settings_ai_provider_check;
ALTER TABLE reputation_settings ADD CONSTRAINT reputation_settings_ai_provider_check
  CHECK (ai_provider IN ('openai'));

-- 5. Update custom_llm_providers with anthropic request_format to openai
UPDATE custom_llm_providers SET request_format = 'openai' WHERE request_format = 'anthropic';

-- 6. Recreate the custom_llm_request_format enum without 'anthropic'
-- Must drop the default first, then alter the type, then re-add default
ALTER TABLE custom_llm_providers ALTER COLUMN request_format DROP DEFAULT;

ALTER TYPE custom_llm_request_format RENAME TO custom_llm_request_format_old;
CREATE TYPE custom_llm_request_format AS ENUM ('openai', 'custom');

ALTER TABLE custom_llm_providers
  ALTER COLUMN request_format TYPE custom_llm_request_format
  USING request_format::text::custom_llm_request_format;

ALTER TABLE custom_llm_providers ALTER COLUMN request_format SET DEFAULT 'openai'::custom_llm_request_format;

DROP TYPE custom_llm_request_format_old;

-- 7. Seed gpt-5.2-chat-latest for each org with an enabled OpenAI provider
INSERT INTO llm_models (org_id, provider_id, model_key, display_name, enabled, is_default, context_window, metadata)
SELECT 
  p.org_id,
  p.id,
  'gpt-5.2-chat-latest',
  'GPT-5.2',
  true,
  true,
  2000000,
  '{"description": "OpenAI GPT-5.2 Chat Latest", "max_output_tokens": 32768}'::jsonb
FROM llm_providers p
WHERE p.provider = 'openai'
  AND p.enabled = true
  AND NOT EXISTS (
    SELECT 1 FROM llm_models m
    WHERE m.provider_id = p.id AND m.model_key = 'gpt-5.2-chat-latest'
  );

-- Clear is_default from all other models in orgs that now have gpt-5.2
UPDATE llm_models SET is_default = false
WHERE is_default = true
  AND model_key != 'gpt-5.2-chat-latest'
  AND org_id IN (
    SELECT org_id FROM llm_models WHERE model_key = 'gpt-5.2-chat-latest' AND is_default = true
  );
