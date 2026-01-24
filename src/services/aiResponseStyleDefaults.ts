import { supabase } from '../lib/supabase';
import type { AIResponseStyleDefaults, UpdateAIResponseStyleDefaultsInput } from '../types';

export async function getResponseStyleDefaults(orgId: string): Promise<AIResponseStyleDefaults | null> {
  const { data, error } = await supabase
    .from('ai_response_style_defaults')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createResponseStyleDefaults(
  orgId: string,
  input?: Partial<UpdateAIResponseStyleDefaultsInput>
): Promise<AIResponseStyleDefaults> {
  const { data, error } = await supabase
    .from('ai_response_style_defaults')
    .insert({
      org_id: orgId,
      tone: input?.tone ?? 'professional',
      formality_level: input?.formality_level ?? 3,
      emoji_enabled: input?.emoji_enabled ?? false,
      length_preference: input?.length_preference ?? 'standard',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateResponseStyleDefaults(
  orgId: string,
  input: UpdateAIResponseStyleDefaultsInput
): Promise<AIResponseStyleDefaults> {
  const existing = await getResponseStyleDefaults(orgId);

  if (!existing) {
    return createResponseStyleDefaults(orgId, input);
  }

  const updates: Record<string, unknown> = {};

  if (input.tone !== undefined) {
    updates.tone = input.tone;
  }
  if (input.formality_level !== undefined) {
    updates.formality_level = input.formality_level;
  }
  if (input.emoji_enabled !== undefined) {
    updates.emoji_enabled = input.emoji_enabled;
  }
  if (input.length_preference !== undefined) {
    updates.length_preference = input.length_preference;
  }

  const { data, error } = await supabase
    .from('ai_response_style_defaults')
    .update(updates)
    .eq('org_id', orgId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getOrCreateResponseStyleDefaults(orgId: string): Promise<AIResponseStyleDefaults> {
  const existing = await getResponseStyleDefaults(orgId);
  if (existing) return existing;
  return createResponseStyleDefaults(orgId);
}
