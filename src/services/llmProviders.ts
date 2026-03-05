import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';
import type {
  LLMProvider,
  LLMProviderFilters,
  CreateLLMProviderInput,
  UpdateLLMProviderInput,
} from '../types';

export async function getProviders(
  orgId: string,
  filters?: LLMProviderFilters
): Promise<LLMProvider[]> {
  let query = supabase
    .from('llm_providers')
    .select('*')
    .eq('org_id', orgId)
    .order('provider');

  if (filters?.enabled !== undefined) {
    query = query.eq('enabled', filters.enabled);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getProviderById(id: string): Promise<LLMProvider | null> {
  const { data, error } = await supabase
    .from('llm_providers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getProviderByType(
  orgId: string,
  provider: string
): Promise<LLMProvider | null> {
  const { data, error } = await supabase
    .from('llm_providers')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createProvider(
  orgId: string,
  input: CreateLLMProviderInput
): Promise<LLMProvider> {
  const { data, error } = await supabase
    .from('llm_providers')
    .insert({
      org_id: orgId,
      provider: input.provider,
      api_key_encrypted: input.api_key,
      base_url: input.base_url || null,
      enabled: input.enabled ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProvider(
  id: string,
  input: UpdateLLMProviderInput
): Promise<LLMProvider> {
  const updates: Record<string, unknown> = {};

  if (input.api_key !== undefined) {
    updates.api_key_encrypted = input.api_key;
  }
  if (input.base_url !== undefined) {
    updates.base_url = input.base_url || null;
  }
  if (input.enabled !== undefined) {
    updates.enabled = input.enabled;
  }

  const { data, error } = await supabase
    .from('llm_providers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProvider(id: string): Promise<void> {
  const { error } = await supabase
    .from('llm_providers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleProviderEnabled(
  id: string,
  enabled: boolean
): Promise<LLMProvider> {
  return updateProvider(id, { enabled });
}

export async function testProviderConnection(
  orgId: string,
  providerId: string
): Promise<{ success: boolean; error?: string }> {
  const response = await callEdgeFunction('ai-settings-providers', {
    action: 'test-connection',
    org_id: orgId,
    provider_id: providerId,
  });

  const result = await response.json();
  return result;
}
