import { supabase } from '../lib/supabase';
import type {
  CustomLLMProvider,
  CreateCustomLLMProviderInput,
  UpdateCustomLLMProviderInput,
} from '../types';

export async function getCustomProviders(orgId: string): Promise<CustomLLMProvider[]> {
  const { data, error } = await supabase
    .from('custom_llm_providers')
    .select('*')
    .eq('org_id', orgId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getCustomProvider(id: string): Promise<CustomLLMProvider | null> {
  const { data, error } = await supabase
    .from('custom_llm_providers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCustomProvider(
  orgId: string,
  input: CreateCustomLLMProviderInput
): Promise<CustomLLMProvider> {
  const { data, error } = await supabase
    .from('custom_llm_providers')
    .insert({
      org_id: orgId,
      name: input.name,
      base_url: input.base_url,
      api_key_encrypted: input.api_key,
      auth_method: input.auth_method ?? 'bearer',
      custom_headers: input.custom_headers ?? {},
      request_format: input.request_format ?? 'openai',
      enabled: input.enabled ?? false,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateCustomProvider(
  id: string,
  input: UpdateCustomLLMProviderInput
): Promise<CustomLLMProvider> {
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.base_url !== undefined) {
    updates.base_url = input.base_url;
  }
  if (input.api_key !== undefined) {
    updates.api_key_encrypted = input.api_key;
  }
  if (input.auth_method !== undefined) {
    updates.auth_method = input.auth_method;
  }
  if (input.custom_headers !== undefined) {
    updates.custom_headers = input.custom_headers;
  }
  if (input.request_format !== undefined) {
    updates.request_format = input.request_format;
  }
  if (input.enabled !== undefined) {
    updates.enabled = input.enabled;
  }

  const { data, error } = await supabase
    .from('custom_llm_providers')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCustomProvider(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_llm_providers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function testCustomProviderConnection(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const provider = await getCustomProvider(id);
  if (!provider) {
    return { success: false, error: 'Provider not found' };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (provider.auth_method === 'bearer') {
      headers['Authorization'] = `Bearer ${provider.api_key_encrypted}`;
    } else if (provider.auth_method === 'api_key_header') {
      headers['X-API-Key'] = provider.api_key_encrypted;
    }

    Object.entries(provider.custom_headers || {}).forEach(([key, value]) => {
      headers[key] = value;
    });

    const testBody = provider.request_format === 'openai'
      ? {
          model: 'gpt-5.1',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }
      : { test: true };

    const response = await fetch(provider.base_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(testBody),
    });

    const testSuccess = response.ok || response.status === 401 || response.status === 403;

    await supabase
      .from('custom_llm_providers')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_success: testSuccess,
      })
      .eq('id', id);

    if (!testSuccess) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    return { success: true };
  } catch (err) {
    await supabase
      .from('custom_llm_providers')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_success: false,
      })
      .eq('id', id);

    return {
      success: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}
