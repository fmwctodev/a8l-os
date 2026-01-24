import { supabase } from '../lib/supabase';
import type { AIVoiceDefaults, UpdateAIVoiceDefaultsInput } from '../types';

export async function getVoiceDefaults(orgId: string): Promise<AIVoiceDefaults | null> {
  const { data, error } = await supabase
    .from('ai_voice_defaults')
    .select(`
      *,
      fallback_voice:elevenlabs_voices(*)
    `)
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createVoiceDefaults(
  orgId: string,
  input?: Partial<UpdateAIVoiceDefaultsInput>
): Promise<AIVoiceDefaults> {
  const { data, error } = await supabase
    .from('ai_voice_defaults')
    .insert({
      org_id: orgId,
      speaking_speed: input?.speaking_speed ?? 1.0,
      default_tone: input?.default_tone ?? 'professional',
      fallback_voice_id: input?.fallback_voice_id ?? null,
    })
    .select(`
      *,
      fallback_voice:elevenlabs_voices(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateVoiceDefaults(
  orgId: string,
  input: UpdateAIVoiceDefaultsInput
): Promise<AIVoiceDefaults> {
  const existing = await getVoiceDefaults(orgId);

  if (!existing) {
    return createVoiceDefaults(orgId, input);
  }

  const updates: Record<string, unknown> = {};

  if (input.speaking_speed !== undefined) {
    updates.speaking_speed = input.speaking_speed;
  }
  if (input.default_tone !== undefined) {
    updates.default_tone = input.default_tone;
  }
  if (input.fallback_voice_id !== undefined) {
    updates.fallback_voice_id = input.fallback_voice_id;
  }

  const { data, error } = await supabase
    .from('ai_voice_defaults')
    .update(updates)
    .eq('org_id', orgId)
    .select(`
      *,
      fallback_voice:elevenlabs_voices(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function getOrCreateVoiceDefaults(orgId: string): Promise<AIVoiceDefaults> {
  const existing = await getVoiceDefaults(orgId);
  if (existing) return existing;
  return createVoiceDefaults(orgId);
}
