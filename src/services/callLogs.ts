import { supabase } from '../lib/supabase';
import type { CallLog } from '../types';

export async function getCallLogs(
  conversationId: string
): Promise<CallLog[]> {
  const { data, error } = await supabase
    .from('call_logs')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as CallLog[];
}

export async function getCallLogBySid(twilioCallSid: string): Promise<CallLog | null> {
  const { data, error } = await supabase
    .from('call_logs')
    .select('*')
    .eq('twilio_call_sid', twilioCallSid)
    .maybeSingle();

  if (error) throw error;
  return data as CallLog | null;
}

export async function createCallLog(
  orgId: string,
  conversationId: string,
  contactId: string,
  twilioCallSid: string,
  direction: 'inbound' | 'outbound',
  fromNumber: string,
  toNumber: string,
  status: string
): Promise<CallLog> {
  const { data, error } = await supabase
    .from('call_logs')
    .insert({
      organization_id: orgId,
      conversation_id: conversationId,
      contact_id: contactId,
      twilio_call_sid: twilioCallSid,
      direction,
      from_number: fromNumber,
      to_number: toNumber,
      status
    })
    .select()
    .single();

  if (error) throw error;
  return data as CallLog;
}

export async function updateCallLog(
  id: string,
  updates: {
    duration?: number;
    recording_url?: string;
    status?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('call_logs')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function updateCallLogBySid(
  twilioCallSid: string,
  updates: {
    duration?: number;
    recording_url?: string;
    status?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('call_logs')
    .update(updates)
    .eq('twilio_call_sid', twilioCallSid);

  if (error) throw error;
}

export async function getRecentCallsForOrg(
  orgId: string,
  limit = 50
): Promise<CallLog[]> {
  const { data, error } = await supabase
    .from('call_logs')
    .select(`
      *,
      contact:contacts!contact_id (
        id, first_name, last_name, phone
      )
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as CallLog[];
}
