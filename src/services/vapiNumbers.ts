import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';

export interface VapiBinding {
  id: string;
  org_id: string;
  assistant_id: string;
  binding_type: 'voice_number' | 'sms_number' | 'web_widget';
  external_binding_id: string;
  display_name: string;
  status: 'active' | 'inactive';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  assistant?: { id: string; name: string; status: string } | null;
}

export async function listNumbers(orgId: string): Promise<VapiBinding[]> {
  const { data, error } = await supabase
    .from('vapi_bindings')
    .select('*, assistant:vapi_assistants!vapi_bindings_assistant_id_fkey(id, name, status)')
    .eq('org_id', orgId)
    .in('binding_type', ['voice_number', 'sms_number'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createFreeNumber(
  orgId: string,
  assistantId: string,
  userId: string
): Promise<VapiBinding> {
  const response = await callEdgeFunction('vapi-client', {
    action: 'create_phone_number',
    config: {
      provider: 'vapi',
      assistantId,
    },
  });

  const json = await response.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to create phone number');

  const vapiNumber = json.data as { id: string; number?: string; phoneNumber?: string };

  const { data, error } = await supabase
    .from('vapi_bindings')
    .insert({
      org_id: orgId,
      assistant_id: assistantId,
      binding_type: 'voice_number',
      external_binding_id: vapiNumber.id,
      display_name: vapiNumber.number || vapiNumber.phoneNumber || 'Free US Number',
      status: 'active',
      metadata: {
        source: 'vapi_free',
        vapi_data: vapiNumber,
        created_by: userId,
      },
    })
    .select('*, assistant:vapi_assistants!vapi_bindings_assistant_id_fkey(id, name, status)')
    .single();

  if (error) throw error;
  return data;
}

export async function importTwilioNumber(
  orgId: string,
  config: {
    twilioAccountSid: string;
    twilioAuthToken: string;
    phoneNumber: string;
    assistantId: string;
    bindingType: 'voice_number' | 'sms_number';
  },
  userId: string
): Promise<VapiBinding> {
  const response = await callEdgeFunction('vapi-client', {
    action: 'import_twilio_number',
    config: {
      provider: 'twilio',
      number: config.phoneNumber,
      twilioAccountSid: config.twilioAccountSid,
      twilioAuthToken: config.twilioAuthToken,
      assistantId: config.assistantId,
    },
  });

  const json = await response.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to import Twilio number');

  const vapiNumber = json.data as { id: string };

  const { data, error } = await supabase
    .from('vapi_bindings')
    .insert({
      org_id: orgId,
      assistant_id: config.assistantId,
      binding_type: config.bindingType,
      external_binding_id: vapiNumber.id,
      display_name: config.phoneNumber,
      status: 'active',
      metadata: {
        source: 'twilio_import',
        is_10dlc: config.bindingType === 'sms_number',
        vapi_data: vapiNumber,
        created_by: userId,
      },
    })
    .select('*, assistant:vapi_assistants!vapi_bindings_assistant_id_fkey(id, name, status)')
    .single();

  if (error) throw error;
  return data;
}

export async function assignNumber(
  bindingId: string,
  assistantId: string
): Promise<VapiBinding> {
  const { data: binding } = await supabase
    .from('vapi_bindings')
    .select('external_binding_id')
    .eq('id', bindingId)
    .single();

  if (binding) {
    const { data: assistant } = await supabase
      .from('vapi_assistants')
      .select('vapi_assistant_id')
      .eq('id', assistantId)
      .single();

    if (assistant?.vapi_assistant_id) {
      try {
        await callEdgeFunction('vapi-client', {
          action: 'update_phone_number',
          phone_id: binding.external_binding_id,
          config: { assistantId: assistant.vapi_assistant_id },
        });
      } catch (e) {
        console.warn('Failed to update Vapi phone number assignment:', e);
      }
    }
  }

  const { data, error } = await supabase
    .from('vapi_bindings')
    .update({
      assistant_id: assistantId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bindingId)
    .select('*, assistant:vapi_assistants!vapi_bindings_assistant_id_fkey(id, name, status)')
    .single();

  if (error) throw error;
  return data;
}

export async function disableNumber(bindingId: string): Promise<void> {
  const { error } = await supabase
    .from('vapi_bindings')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', bindingId);

  if (error) throw error;
}

export async function enableNumber(bindingId: string): Promise<void> {
  const { error } = await supabase
    .from('vapi_bindings')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', bindingId);

  if (error) throw error;
}

export async function getNumbersForAssistant(assistantId: string): Promise<VapiBinding[]> {
  const { data, error } = await supabase
    .from('vapi_bindings')
    .select('*')
    .eq('assistant_id', assistantId)
    .in('binding_type', ['voice_number', 'sms_number'])
    .eq('status', 'active');

  if (error) throw error;
  return data || [];
}

export async function hasSmsNumberForAssistant(assistantId: string): Promise<boolean> {
  const { data } = await supabase
    .from('vapi_bindings')
    .select('id, metadata')
    .eq('assistant_id', assistantId)
    .eq('binding_type', 'sms_number')
    .eq('status', 'active')
    .limit(1);

  if (!data || data.length === 0) return false;
  const binding = data[0];
  const meta = binding.metadata as Record<string, unknown>;
  return meta?.source === 'twilio_import';
}
