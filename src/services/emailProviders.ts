import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type { EmailProvider } from '../types';

const SLUG = 'email-sendgrid-provider';

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
  const response = await fetchEdge(SLUG, { body: { action: 'connect', apiKey, nickname } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'test' } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function disconnectProvider(): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'disconnect' } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}
