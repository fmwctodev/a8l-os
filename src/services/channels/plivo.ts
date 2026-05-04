import { supabase } from '../../lib/supabase';

/**
 * Client-side helper for Plivo SMS/MMS sending. Calls the plivo-sms-send
 * edge function which handles Plivo authentication, message persistence,
 * and delivery callbacks.
 *
 * Voice handling does NOT live here — calls always go through Vapi (see
 * src/services/vapiCalls.ts), and Plivo serves only as the SIP trunk.
 */

export interface PlivoSendSmsArgs {
  orgId: string;
  toNumber: string;
  body: string;
  fromNumber?: string;
  contactId?: string;
  conversationId?: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
}

export interface PlivoSendSmsResult {
  success: boolean;
  messageId?: string;
  plivoMessageUuid?: string;
  error?: string;
}

export async function sendPlivoSms(args: PlivoSendSmsArgs): Promise<PlivoSendSmsResult> {
  const { data, error } = await supabase.functions.invoke('plivo-sms-send', {
    body: args,
  });
  if (error) return { success: false, error: error.message };
  if (!data?.success) return { success: false, error: data?.error || 'Send failed' };
  return {
    success: true,
    messageId: data.messageId,
    plivoMessageUuid: data.plivoMessageUuid,
  };
}
