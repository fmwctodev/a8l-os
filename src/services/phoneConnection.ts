import { supabase } from '../lib/supabase';

export interface TwilioConnection {
  id: string;
  accountSid: string;
  subaccountSid?: string;
  friendlyName?: string;
  status: 'connected' | 'disconnected';
  connectedAt?: string;
}

export interface ConnectTwilioParams {
  accountSid: string;
  authToken: string;
  subaccountSid?: string;
  friendlyName?: string;
}

export async function getConnection(): Promise<TwilioConnection | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-twilio-connection`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'get' }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result.connection;
}

export async function connectTwilio(params: ConnectTwilioParams): Promise<TwilioConnection> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-twilio-connection`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'connect', ...params }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result.connection;
}

export async function testConnection(): Promise<{ success: boolean; status: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-twilio-connection`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'test' }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function disconnectTwilio(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-twilio-connection`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'disconnect' }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
}
