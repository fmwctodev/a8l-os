import { supabase } from '../lib/supabase';
import type { EmailProvider } from '../types';

export async function getProvider(orgId: string): Promise<EmailProvider | null> {
  const { data, error } = await supabase
    .from('email_providers')
    .select('id, org_id, provider, account_nickname, status, created_at, updated_at')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function connectProvider(
  apiKey: string,
  nickname?: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-provider`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'connect',
        apiKey,
        nickname,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-provider`,
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
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function disconnectProvider(): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-provider`,
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
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true };
}
