import { supabase } from '../lib/supabase';
import type {
  LLMModelCatalogEntry,
  LLMProviderType,
  FetchProviderModelsResponse,
  SyncCatalogResponse,
  ProviderModelInfo,
} from '../types';

export async function fetchProviderModels(
  orgId: string,
  provider: LLMProviderType
): Promise<FetchProviderModelsResponse> {
  const session = await supabase.auth.getSession();

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-provider-models`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.data.session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'fetch-models',
        org_id: orgId,
        provider,
      }),
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch models');
  }

  return result.data;
}

export async function syncModelCatalog(
  orgId: string,
  provider: LLMProviderType
): Promise<SyncCatalogResponse> {
  const session = await supabase.auth.getSession();

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-provider-models`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.data.session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sync-catalog',
        org_id: orgId,
        provider,
      }),
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to sync catalog');
  }

  return result.data;
}

export async function getCatalogModels(
  orgId: string,
  provider?: LLMProviderType
): Promise<LLMModelCatalogEntry[]> {
  let query = supabase
    .from('llm_model_catalog')
    .select('*')
    .eq('org_id', orgId)
    .order('display_name');

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getEnabledCatalogModels(
  orgId: string,
  provider?: LLMProviderType
): Promise<LLMModelCatalogEntry[]> {
  let query = supabase
    .from('llm_model_catalog')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_enabled', true)
    .order('display_name');

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function toggleModelEnabled(
  orgId: string,
  provider: LLMProviderType,
  modelKey: string,
  model: ProviderModelInfo,
  enabled: boolean
): Promise<LLMModelCatalogEntry> {
  const { data: existing } = await supabase
    .from('llm_model_catalog')
    .select('id')
    .eq('org_id', orgId)
    .eq('provider', provider)
    .eq('model_key', modelKey)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('llm_model_catalog')
      .update({ is_enabled: enabled })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('llm_model_catalog')
    .insert({
      org_id: orgId,
      provider,
      model_key: modelKey,
      display_name: model.display_name,
      context_window: model.context_window,
      capabilities: model.capabilities,
      is_deprecated: model.is_deprecated,
      is_enabled: enabled,
      is_default: false,
      last_synced_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setDefaultModel(
  orgId: string,
  provider: LLMProviderType,
  modelKey: string,
  model: ProviderModelInfo
): Promise<LLMModelCatalogEntry> {
  const { error: clearError } = await supabase
    .from('llm_model_catalog')
    .update({ is_default: false })
    .eq('org_id', orgId)
    .eq('is_default', true);

  if (clearError) throw clearError;

  const { data: existing } = await supabase
    .from('llm_model_catalog')
    .select('id')
    .eq('org_id', orgId)
    .eq('provider', provider)
    .eq('model_key', modelKey)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('llm_model_catalog')
      .update({ is_default: true, is_enabled: true })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('llm_model_catalog')
    .insert({
      org_id: orgId,
      provider,
      model_key: modelKey,
      display_name: model.display_name,
      context_window: model.context_window,
      capabilities: model.capabilities,
      is_deprecated: model.is_deprecated,
      is_enabled: true,
      is_default: true,
      last_synced_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getDefaultModel(
  orgId: string
): Promise<LLMModelCatalogEntry | null> {
  const { data, error } = await supabase
    .from('llm_model_catalog')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}
