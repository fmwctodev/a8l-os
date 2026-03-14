import { supabase } from '../lib/supabase';
import type { VapiConversationSettings, ConversationParticipant } from '../types';

export async function getVapiConversationSettings(
  orgId: string
): Promise<VapiConversationSettings | null> {
  const { data, error } = await supabase
    .from('org_vapi_conversation_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data as VapiConversationSettings | null;
}

export async function upsertVapiConversationSettings(
  orgId: string,
  settings: Partial<Omit<VapiConversationSettings, 'org_id' | 'created_at' | 'updated_at'>>
): Promise<VapiConversationSettings> {
  const { data, error } = await supabase
    .from('org_vapi_conversation_settings')
    .upsert({
      org_id: orgId,
      ...settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id' })
    .select()
    .single();

  if (error) throw error;
  return data as VapiConversationSettings;
}

export async function getConversationParticipants(
  conversationId: string
): Promise<ConversationParticipant[]> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as ConversationParticipant[];
}
