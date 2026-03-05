import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';
import type { ElevenLabsConnection, ElevenLabsVoice } from '../types';

export async function getConnection(orgId: string): Promise<ElevenLabsConnection | null> {
  const { data, error } = await supabase
    .from('elevenlabs_connection')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveConnection(
  orgId: string,
  apiKey: string,
  enabled: boolean
): Promise<ElevenLabsConnection> {
  const existing = await getConnection(orgId);

  if (existing) {
    const { data, error } = await supabase
      .from('elevenlabs_connection')
      .update({
        api_key_encrypted: apiKey,
        enabled,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('elevenlabs_connection')
    .insert({
      org_id: orgId,
      api_key_encrypted: apiKey,
      enabled,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateConnectionEnabled(
  orgId: string,
  enabled: boolean
): Promise<ElevenLabsConnection> {
  const { data, error } = await supabase
    .from('elevenlabs_connection')
    .update({ enabled })
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteConnection(orgId: string): Promise<void> {
  const { error } = await supabase
    .from('elevenlabs_connection')
    .delete()
    .eq('org_id', orgId);

  if (error) throw error;

  await supabase
    .from('elevenlabs_voices')
    .delete()
    .eq('org_id', orgId);
}

export async function testConnection(
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  const response = await callEdgeFunction('ai-settings-elevenlabs', {
    action: 'test-connection',
    org_id: orgId,
  });

  const result = await response.json();
  return result;
}

export async function syncVoices(
  orgId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  const response = await callEdgeFunction('ai-settings-elevenlabs', {
    action: 'sync-voices',
    org_id: orgId,
  });

  const result = await response.json();

  if (result.success) {
    await supabase
      .from('elevenlabs_connection')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('org_id', orgId);
  }

  return result;
}

export async function getVoices(orgId: string): Promise<ElevenLabsVoice[]> {
  const { data, error } = await supabase
    .from('elevenlabs_voices')
    .select('*')
    .eq('org_id', orgId)
    .order('voice_name');

  if (error) throw error;
  return data || [];
}

export async function getEnabledVoices(orgId: string): Promise<ElevenLabsVoice[]> {
  const { data, error } = await supabase
    .from('elevenlabs_voices')
    .select('*')
    .eq('org_id', orgId)
    .eq('enabled', true)
    .order('voice_name');

  if (error) throw error;
  return data || [];
}

export async function getDefaultVoice(orgId: string): Promise<ElevenLabsVoice | null> {
  const { data, error } = await supabase
    .from('elevenlabs_voices')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_default', true)
    .eq('enabled', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function toggleVoiceEnabled(
  id: string,
  enabled: boolean
): Promise<ElevenLabsVoice> {
  const { data, error } = await supabase
    .from('elevenlabs_voices')
    .update({ enabled })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setDefaultVoice(
  orgId: string,
  voiceId: string
): Promise<ElevenLabsVoice> {
  await supabase
    .from('elevenlabs_voices')
    .update({ is_default: false })
    .eq('org_id', orgId)
    .eq('is_default', true);

  const { data, error } = await supabase
    .from('elevenlabs_voices')
    .update({ is_default: true })
    .eq('id', voiceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function previewVoice(
  orgId: string,
  voiceId: string,
  text: string
): Promise<{ audioUrl?: string; error?: string }> {
  const response = await callEdgeFunction('ai-settings-elevenlabs', {
    action: 'preview-voice',
    org_id: orgId,
    voice_id: voiceId,
    text,
  });

  const result = await response.json();
  return result;
}
