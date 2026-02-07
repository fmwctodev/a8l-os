/*
  # Seed Updated LLM Models for OpenAI and Anthropic

  Updates the llm_models table with the current model roster for both providers.
  Sets GPT-4.1 as the organization default model.

  1. Changes
    - Clears existing is_default flags
    - Inserts new OpenAI models: GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano, o3, o3 Pro, o4 Mini
    - Inserts new Anthropic models: Claude Opus 4.6, Sonnet 4.5, Haiku 4.5, Opus 4, Sonnet 4, 3.7 Sonnet
    - Marks legacy models (GPT-4o, GPT-4o Mini, Claude 3.5 Sonnet, Claude 3.5 Haiku) as disabled
    - Sets GPT-4.1 as the default model
    - Existing rows are preserved via ON CONFLICT DO NOTHING

  2. Notes
    - Legacy models remain in the database but are disabled by default
    - GPT-4.1 is set as the organization default per configuration
    - Only affects org 00000000-0000-0000-0000-000000000001
*/

DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_openai_provider_id uuid;
  v_anthropic_provider_id uuid;
  v_gpt41_id uuid;
BEGIN
  SELECT id INTO v_openai_provider_id
  FROM llm_providers
  WHERE org_id = v_org_id AND provider = 'openai'
  LIMIT 1;

  SELECT id INTO v_anthropic_provider_id
  FROM llm_providers
  WHERE org_id = v_org_id AND provider = 'anthropic'
  LIMIT 1;

  UPDATE llm_models
  SET is_default = false
  WHERE org_id = v_org_id AND is_default = true;

  IF v_openai_provider_id IS NOT NULL THEN
    INSERT INTO llm_models (org_id, provider_id, model_key, display_name, enabled, is_default, context_window, metadata)
    VALUES
      (v_org_id, v_openai_provider_id, 'gpt-4.1', 'GPT-4.1', true, true, 1047576, '{"supports_vision": true, "cost_per_1k_input": 0.002, "cost_per_1k_output": 0.008}'::jsonb),
      (v_org_id, v_openai_provider_id, 'gpt-4.1-mini', 'GPT-4.1 Mini', true, false, 1047576, '{"supports_vision": true, "cost_per_1k_input": 0.0004, "cost_per_1k_output": 0.0016}'::jsonb),
      (v_org_id, v_openai_provider_id, 'gpt-4.1-nano', 'GPT-4.1 Nano', true, false, 1047576, '{"supports_vision": true, "cost_per_1k_input": 0.0001, "cost_per_1k_output": 0.0004}'::jsonb),
      (v_org_id, v_openai_provider_id, 'o3', 'o3', true, false, 200000, '{"reasoning": true, "cost_per_1k_input": 0.01, "cost_per_1k_output": 0.04}'::jsonb),
      (v_org_id, v_openai_provider_id, 'o3-pro', 'o3 Pro', true, false, 200000, '{"reasoning": true, "cost_per_1k_input": 0.02, "cost_per_1k_output": 0.08}'::jsonb),
      (v_org_id, v_openai_provider_id, 'o4-mini', 'o4 Mini', true, false, 200000, '{"reasoning": true, "cost_per_1k_input": 0.0011, "cost_per_1k_output": 0.0044}'::jsonb)
    ON CONFLICT (org_id, model_key) DO NOTHING;

    UPDATE llm_models
    SET enabled = false
    WHERE org_id = v_org_id
      AND provider_id = v_openai_provider_id
      AND model_key IN ('gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo');

    SELECT id INTO v_gpt41_id
    FROM llm_models
    WHERE org_id = v_org_id AND model_key = 'gpt-4.1'
    LIMIT 1;

    IF v_gpt41_id IS NOT NULL THEN
      UPDATE llm_models
      SET is_default = true, enabled = true
      WHERE id = v_gpt41_id;
    END IF;
  END IF;

  IF v_anthropic_provider_id IS NOT NULL THEN
    INSERT INTO llm_models (org_id, provider_id, model_key, display_name, enabled, is_default, context_window, metadata)
    VALUES
      (v_org_id, v_anthropic_provider_id, 'claude-opus-4-6-20260101', 'Claude Opus 4.6', true, false, 200000, '{"supports_vision": true, "cost_per_1k_input": 0.015, "cost_per_1k_output": 0.075}'::jsonb),
      (v_org_id, v_anthropic_provider_id, 'claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5', true, false, 200000, '{"supports_vision": true, "cost_per_1k_input": 0.003, "cost_per_1k_output": 0.015}'::jsonb),
      (v_org_id, v_anthropic_provider_id, 'claude-haiku-4-5-20251001', 'Claude Haiku 4.5', true, false, 200000, '{"supports_vision": true, "cost_per_1k_input": 0.0008, "cost_per_1k_output": 0.004}'::jsonb),
      (v_org_id, v_anthropic_provider_id, 'claude-opus-4-20250514', 'Claude Opus 4', true, false, 200000, '{"supports_vision": true, "cost_per_1k_input": 0.015, "cost_per_1k_output": 0.075}'::jsonb),
      (v_org_id, v_anthropic_provider_id, 'claude-sonnet-4-20250514', 'Claude Sonnet 4', true, false, 200000, '{"supports_vision": true, "cost_per_1k_input": 0.003, "cost_per_1k_output": 0.015}'::jsonb),
      (v_org_id, v_anthropic_provider_id, 'claude-3-7-sonnet-20250219', 'Claude 3.7 Sonnet', false, false, 200000, '{"supports_vision": true, "cost_per_1k_input": 0.003, "cost_per_1k_output": 0.015}'::jsonb)
    ON CONFLICT (org_id, model_key) DO NOTHING;

    UPDATE llm_models
    SET enabled = false
    WHERE org_id = v_org_id
      AND provider_id = v_anthropic_provider_id
      AND model_key IN ('claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022');
  END IF;
END $$;
