/*
  # Update LLM Models from GPT-5.2 to GPT-5.1

  1. Changes to `llm_models`
    - Update model_key from 'gpt-5.2-chat-latest' to 'gpt-5.1'
    - Update display_name from 'GPT-5.2' to 'GPT-5.1'
    - Update context_window from 2000000 to 1047576
    - Update metadata description to reflect GPT-5.1

  2. Changes to `llm_model_catalog`
    - Update any catalog entries referencing gpt-5.2-chat-latest to gpt-5.1
    - Update display_name and context_window accordingly

  3. Important Notes
    - This migration replaces the gpt-5.2-chat-latest model with gpt-5.1 across all organizations
    - No data is deleted; existing rows are updated in place
    - The is_default flag is preserved for all affected rows
*/

-- 1. Update llm_models table
UPDATE llm_models
SET
  model_key = 'gpt-5.1',
  display_name = 'GPT-5.1',
  context_window = 1047576,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{description}',
    '"OpenAI GPT-5.1"'::jsonb
  ),
  updated_at = now()
WHERE model_key = 'gpt-5.2-chat-latest';

-- 2. Update llm_model_catalog if any entries reference the old model
UPDATE llm_model_catalog
SET
  model_key = 'gpt-5.1',
  display_name = 'GPT-5.1',
  context_window = 1047576,
  updated_at = now()
WHERE model_key = 'gpt-5.2-chat-latest';
