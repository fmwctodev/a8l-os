/*
  # Migrate default LLM from OpenAI GPT to Anthropic Claude

  1. Changes to `llm_providers`
    - Enable the existing Anthropic provider for the default organization

  2. Changes to `llm_models`
    - Unset GPT-5.1 as the default model (keep it enabled for embeddings/STT)
    - Add Claude Sonnet 4 as the new default text generation model
    - Add Claude Opus 4 for heavy-duty tasks (proposals, reports, agent execution)
    - Add Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku as additional options

  3. Seed `llm_model_catalog` (global model reference)
    - Add all current Anthropic Claude models
    - Add current Google Gemini models
    - Add OpenAI models (kept for embeddings/STT)

  4. Important Notes
    - OpenAI provider remains enabled for embeddings and speech-to-text
    - GPT-5.1 model remains enabled but is no longer the default
    - Claude Sonnet 4 is the new default for all text generation
    - Claude Opus 4 is available for heavy workloads
*/

-- 1. Enable the Anthropic provider for the default org
UPDATE llm_providers
SET enabled = true, updated_at = now()
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND provider = 'anthropic';

-- 2. Unset GPT-5.1 as default (keep it enabled for embeddings/STT)
UPDATE llm_models
SET is_default = false, updated_at = now()
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND is_default = true;

-- 3. Insert Anthropic Claude models for the default org
DO $$
DECLARE
  v_anthropic_provider_id uuid;
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO v_anthropic_provider_id
  FROM llm_providers
  WHERE org_id = v_org_id AND provider = 'anthropic'
  LIMIT 1;

  IF v_anthropic_provider_id IS NOT NULL THEN
    INSERT INTO llm_models (org_id, provider_id, model_key, display_name, enabled, is_default, context_window, metadata)
    VALUES
      (v_org_id, v_anthropic_provider_id, 'claude-sonnet-4-20250514', 'Claude Sonnet 4', true, true, 200000, '{"tier": "standard", "recommended": true}'),
      (v_org_id, v_anthropic_provider_id, 'claude-opus-4-20250514', 'Claude Opus 4', true, false, 200000, '{"tier": "heavy", "recommended": true}'),
      (v_org_id, v_anthropic_provider_id, 'claude-3-7-sonnet-20250219', 'Claude 3.7 Sonnet', true, false, 200000, '{}'),
      (v_org_id, v_anthropic_provider_id, 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', true, false, 200000, '{}'),
      (v_org_id, v_anthropic_provider_id, 'claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', true, false, 200000, '{"tier": "fast"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 4. Seed the global llm_model_catalog
DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Anthropic models
  INSERT INTO llm_model_catalog (org_id, provider, model_key, display_name, context_window, is_enabled, is_default, is_deprecated, capabilities)
  VALUES
    (v_org_id, 'anthropic', 'claude-sonnet-4-20250514', 'Claude Sonnet 4', 200000, true, true, false, '{"text": true, "vision": true, "tools": true}'),
    (v_org_id, 'anthropic', 'claude-opus-4-20250514', 'Claude Opus 4', 200000, true, false, false, '{"text": true, "vision": true, "tools": true}'),
    (v_org_id, 'anthropic', 'claude-3-7-sonnet-20250219', 'Claude 3.7 Sonnet', 200000, true, false, false, '{"text": true, "vision": true, "tools": true}'),
    (v_org_id, 'anthropic', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 200000, true, false, false, '{"text": true, "vision": true, "tools": true}'),
    (v_org_id, 'anthropic', 'claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', 200000, true, false, false, '{"text": true, "vision": false, "tools": true}')
  ON CONFLICT DO NOTHING;

  -- Google models
  INSERT INTO llm_model_catalog (org_id, provider, model_key, display_name, context_window, is_enabled, is_default, is_deprecated, capabilities)
  VALUES
    (v_org_id, 'google', 'gemini-2.5-pro', 'Gemini 2.5 Pro', 1048576, true, false, false, '{"text": true, "vision": true, "tools": true}'),
    (v_org_id, 'google', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 1048576, true, false, false, '{"text": true, "vision": true, "tools": true}'),
    (v_org_id, 'google', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 1048576, true, false, false, '{"text": true, "vision": true, "tools": true}'),
    (v_org_id, 'google', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 1048576, true, false, true, '{"text": true, "vision": true, "tools": true}'),
    (v_org_id, 'google', 'gemini-1.5-flash', 'Gemini 1.5 Flash', 1048576, true, false, true, '{"text": true, "vision": true, "tools": true}')
  ON CONFLICT DO NOTHING;

  -- OpenAI models (kept for embeddings and STT only)
  INSERT INTO llm_model_catalog (org_id, provider, model_key, display_name, context_window, is_enabled, is_default, is_deprecated, capabilities)
  VALUES
    (v_org_id, 'openai', 'gpt-5.1', 'GPT-5.1', 1047576, true, false, false, '{"text": true, "vision": true, "tools": true}'),
    (v_org_id, 'openai', 'text-embedding-3-small', 'Text Embedding 3 Small', 8191, true, false, false, '{"embeddings": true}'),
    (v_org_id, 'openai', 'text-embedding-3-large', 'Text Embedding 3 Large', 8191, true, false, false, '{"embeddings": true}'),
    (v_org_id, 'openai', 'gpt-4o-mini-transcribe', 'GPT-4o Mini Transcribe', 0, true, false, false, '{"stt": true}'),
    (v_org_id, 'openai', 'gpt-4o-transcribe', 'GPT-4o Transcribe', 0, true, false, false, '{"stt": true}'),
    (v_org_id, 'openai', 'whisper-1', 'Whisper v1', 0, true, false, false, '{"stt": true}')
  ON CONFLICT DO NOTHING;
END $$;
