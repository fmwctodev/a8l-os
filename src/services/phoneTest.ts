import { supabase } from '../lib/supabase';

export interface PhoneTestLog {
  id: string;
  org_id: string;
  test_type: 'sms' | 'call';
  to_number: string;
  from_number: string;
  message_body?: string;
  status: string;
  twilio_sid?: string;
  error_message?: string;
  tested_by: string;
  tested_by_user?: { id: string; full_name?: string; email: string };
  created_at: string;
}

export interface WebhookHealthStatus {
  lastReceived?: string;
  successCount: number;
  failureCount: number;
  failureRate: number;
  lastError?: string;
  status: 'healthy' | 'degraded' | 'never_received';
}

async function callEdgeFunction(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-test`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...payload }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function sendTestSms(params: {
  toNumber: string;
  fromNumberId?: string;
  messageBody: string;
}): Promise<{ success: boolean; messageSid: string; status: string }> {
  return callEdgeFunction('sms', params);
}

export async function sendTestCall(params: {
  toNumber: string;
  fromNumberId?: string;
  ttsMessage?: string;
}): Promise<{ success: boolean; callSid: string; status: string }> {
  return callEdgeFunction('call', params);
}

export async function getTestLogs(limit?: number): Promise<PhoneTestLog[]> {
  const result = await callEdgeFunction('logs', { limit: limit || 20 });
  return result.logs || [];
}

export async function getWebhookHealth(): Promise<Record<string, WebhookHealthStatus>> {
  const result = await callEdgeFunction('webhook-health');
  return result.health || {};
}
