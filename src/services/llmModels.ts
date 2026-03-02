import { supabase } from '../lib/supabase';
import type {
  LLMModel,
  LLMModelFilters,
  CreateLLMModelInput,
  UpdateLLMModelInput,
} from '../types';

export async function getModels(
  orgId: string,
  filters?: LLMModelFilters
): Promise<LLMModel[]> {
  let query = supabase
    .from('llm_models')
    .select(`
      *,
      provider:llm_providers(*)
    `)
    .eq('org_id', orgId)
    .order('display_name');

  if (filters?.providerId) {
    query = query.eq('provider_id', filters.providerId);
  }
  if (filters?.enabled !== undefined) {
    query = query.eq('enabled', filters.enabled);
  }
  if (filters?.search) {
    query = query.or(`display_name.ilike.%${filters.search}%,model_key.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getEnabledModels(orgId: string): Promise<LLMModel[]> {
  return getModels(orgId, { enabled: true });
}

export async function getModelById(id: string): Promise<LLMModel | null> {
  const { data, error } = await supabase
    .from('llm_models')
    .select(`
      *,
      provider:llm_providers(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getOrgDefaultModel(orgId: string): Promise<LLMModel | null> {
  const { data, error } = await supabase
    .from('llm_models')
    .select(`
      *,
      provider:llm_providers(*)
    `)
    .eq('org_id', orgId)
    .eq('is_default', true)
    .eq('enabled', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createModel(
  orgId: string,
  input: CreateLLMModelInput
): Promise<LLMModel> {
  if (input.is_default) {
    await clearDefaultModel(orgId);
  }

  const { data, error } = await supabase
    .from('llm_models')
    .insert({
      org_id: orgId,
      provider_id: input.provider_id,
      model_key: input.model_key,
      display_name: input.display_name,
      enabled: input.enabled ?? true,
      is_default: input.is_default ?? false,
      context_window: input.context_window || null,
      metadata: input.metadata || {},
    })
    .select(`
      *,
      provider:llm_providers(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateModel(
  id: string,
  input: UpdateLLMModelInput
): Promise<LLMModel> {
  if (input.is_default) {
    const model = await getModelById(id);
    if (model) {
      await clearDefaultModel(model.org_id);
    }
  }

  const updates: Record<string, unknown> = {};

  if (input.display_name !== undefined) {
    updates.display_name = input.display_name;
  }
  if (input.enabled !== undefined) {
    updates.enabled = input.enabled;
  }
  if (input.is_default !== undefined) {
    updates.is_default = input.is_default;
  }
  if (input.context_window !== undefined) {
    updates.context_window = input.context_window || null;
  }
  if (input.metadata !== undefined) {
    updates.metadata = input.metadata;
  }

  const { data, error } = await supabase
    .from('llm_models')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      provider:llm_providers(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteModel(id: string): Promise<void> {
  const { error } = await supabase
    .from('llm_models')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleModelEnabled(
  id: string,
  enabled: boolean
): Promise<LLMModel> {
  return updateModel(id, { enabled });
}

export async function setDefaultModel(
  orgId: string,
  modelId: string
): Promise<LLMModel> {
  await clearDefaultModel(orgId);
  return updateModel(modelId, { is_default: true });
}

async function clearDefaultModel(orgId: string): Promise<void> {
  const { error } = await supabase
    .from('llm_models')
    .update({ is_default: false })
    .eq('org_id', orgId)
    .eq('is_default', true);

  if (error) throw error;
}

export const DEFAULT_MODELS: Array<{
  provider: string;
  model_key: string;
  display_name: string;
  context_window: number;
  is_legacy?: boolean;
}> = [
  { provider: 'openai', model_key: 'gpt-5.1', display_name: 'GPT-5.1', context_window: 1047576 },
  { provider: 'google', model_key: 'gemini-2.5-pro', display_name: 'Gemini 2.5 Pro', context_window: 1048576 },
  { provider: 'google', model_key: 'gemini-2.5-flash', display_name: 'Gemini 2.5 Flash', context_window: 1048576 },
  { provider: 'google', model_key: 'gemini-2.0-flash', display_name: 'Gemini 2.0 Flash', context_window: 1048576 },
  { provider: 'google', model_key: 'gemini-1.5-pro', display_name: 'Gemini 1.5 Pro', context_window: 1048576, is_legacy: true },
  { provider: 'google', model_key: 'gemini-1.5-flash', display_name: 'Gemini 1.5 Flash', context_window: 1048576, is_legacy: true },
];
