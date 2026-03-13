import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';

export interface VapiCall {
  id: string;
  org_id: string;
  assistant_id: string | null;
  vapi_call_id: string | null;
  direction: 'inbound' | 'outbound';
  status: string;
  from_number: string | null;
  to_number: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  summary: string | null;
  transcript: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  assistant?: { id: string; name: string } | null;
}

export interface VapiSession {
  id: string;
  org_id: string;
  assistant_id: string | null;
  vapi_session_id: string | null;
  channel: 'sms' | 'webchat';
  external_user_id: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  assistant?: { id: string; name: string } | null;
}

export interface CallFilters {
  direction?: string;
  status?: string;
  assistant_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface SessionFilters {
  channel?: string;
  status?: string;
  assistant_id?: string;
  date_from?: string;
  date_to?: string;
}

export async function listCalls(
  orgId: string,
  filters?: CallFilters,
  page = 1,
  pageSize = 25
): Promise<{ data: VapiCall[]; count: number }> {
  let query = supabase
    .from('vapi_calls')
    .select('*, assistant:vapi_assistants!vapi_calls_assistant_id_fkey(id, name)', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters?.direction && filters.direction !== 'all') {
    query = query.eq('direction', filters.direction);
  }
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.assistant_id) {
    query = query.eq('assistant_id', filters.assistant_id);
  }
  if (filters?.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getCall(id: string): Promise<VapiCall | null> {
  const { data, error } = await supabase
    .from('vapi_calls')
    .select('*, assistant:vapi_assistants!vapi_calls_assistant_id_fkey(id, name)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createOutboundCall(
  orgId: string,
  assistantId: string,
  fromNumberBindingId: string,
  toNumber: string,
  metadata?: Record<string, unknown>
): Promise<VapiCall> {
  const { data: assistant } = await supabase
    .from('vapi_assistants')
    .select('vapi_assistant_id')
    .eq('id', assistantId)
    .single();

  if (!assistant?.vapi_assistant_id) {
    throw new Error('Assistant must be published before making calls');
  }

  const { data: binding } = await supabase
    .from('vapi_bindings')
    .select('external_binding_id, display_name')
    .eq('id', fromNumberBindingId)
    .single();

  if (!binding) throw new Error('Phone number binding not found');

  const response = await callEdgeFunction('vapi-client', {
    action: 'create_outbound_call',
    config: {
      assistantId: assistant.vapi_assistant_id,
      phoneNumberId: binding.external_binding_id,
      customer: { number: toNumber },
      ...(metadata ? { metadata } : {}),
    },
  });

  const json = await response.json();
  if (!json.success) throw new Error(json.error?.message || 'Failed to create outbound call');

  const vapiCall = json.data as { id?: string; status?: string };

  const { data: callRecord, error } = await supabase
    .from('vapi_calls')
    .insert({
      org_id: orgId,
      assistant_id: assistantId,
      vapi_call_id: vapiCall.id || null,
      direction: 'outbound',
      status: vapiCall.status || 'queued',
      from_number: binding.display_name,
      to_number: toNumber,
      started_at: new Date().toISOString(),
      metadata: metadata || {},
    })
    .select('*, assistant:vapi_assistants!vapi_calls_assistant_id_fkey(id, name)')
    .single();

  if (error) throw error;
  return callRecord;
}

export async function listSessions(
  orgId: string,
  filters?: SessionFilters,
  page = 1,
  pageSize = 25
): Promise<{ data: VapiSession[]; count: number }> {
  let query = supabase
    .from('vapi_sessions')
    .select('*, assistant:vapi_assistants!vapi_sessions_assistant_id_fkey(id, name)', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters?.channel && filters.channel !== 'all') {
    query = query.eq('channel', filters.channel);
  }
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.assistant_id) {
    query = query.eq('assistant_id', filters.assistant_id);
  }
  if (filters?.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getSession(id: string): Promise<VapiSession | null> {
  const { data, error } = await supabase
    .from('vapi_sessions')
    .select('*, assistant:vapi_assistants!vapi_sessions_assistant_id_fkey(id, name)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}
