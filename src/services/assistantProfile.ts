import { supabase } from '../lib/supabase';
import type { AssistantProfile } from '../types/assistant';

export async function getOrCreateProfile(
  userId: string,
  orgId: string
): Promise<AssistantProfile> {
  const { data: existing, error: fetchErr } = await supabase
    .from('assistant_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (existing) return existing as AssistantProfile;

  const { data, error } = await supabase
    .from('assistant_profiles')
    .upsert(
      {
      user_id: userId,
      org_id: orgId,
      voice_enabled: true,
      elevenlabs_voice_id: '56bWURjYFHyYyVf490Dp',
      elevenlabs_voice_name: 'Clara Voice',
      auto_speak_chat: true,
    },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data as AssistantProfile;
}

export async function getProfile(userId: string): Promise<AssistantProfile | null> {
  const { data, error } = await supabase
    .from('assistant_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as AssistantProfile | null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<AssistantProfile,
    'enabled' | 'voice_enabled' | 'elevenlabs_voice_id' | 'elevenlabs_voice_name' |
    'speech_rate' | 'output_volume' | 'auto_speak_chat' | 'confirm_all_writes' | 'system_prompt_override'
  >>
): Promise<AssistantProfile> {
  const { data, error } = await supabase
    .from('assistant_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data as AssistantProfile;
}

export async function toggleEnabled(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('Profile not found');
  const updated = await updateProfile(userId, { enabled: !profile.enabled });
  return updated.enabled;
}

export async function updateVoiceSettings(
  userId: string,
  voiceId: string | null,
  voiceName: string | null,
  speechRate?: number
): Promise<AssistantProfile> {
  return updateProfile(userId, {
    elevenlabs_voice_id: voiceId,
    elevenlabs_voice_name: voiceName,
    ...(speechRate !== undefined ? { speech_rate: speechRate } : {}),
  });
}
