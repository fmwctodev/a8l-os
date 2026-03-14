/*
  # Extend LLM Model Catalog Provider CHECK Constraint

  1. Changes
    - Drops existing provider CHECK constraint on `llm_model_catalog`
    - Adds new CHECK constraint that includes 'anthropic' and 'groq' providers
    - This enables dynamic model fetching from Anthropic and Groq APIs

  2. Notes
    - Previous constraint only allowed: 'openai', 'google', 'custom'
    - New constraint allows: 'openai', 'google', 'anthropic', 'groq', 'custom'
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'llm_model_catalog'
    AND constraint_type = 'CHECK'
    AND constraint_name = 'llm_model_catalog_provider_check'
  ) THEN
    ALTER TABLE llm_model_catalog DROP CONSTRAINT llm_model_catalog_provider_check;
  END IF;
END $$;

ALTER TABLE llm_model_catalog ADD CONSTRAINT llm_model_catalog_provider_check
  CHECK (provider IN ('openai', 'google', 'anthropic', 'groq', 'custom'));
