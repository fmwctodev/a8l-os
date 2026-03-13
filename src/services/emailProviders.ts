import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';

const SLUG = 'email-sendgrid-provider';

export async function getProviderStatus(orgId: string): Promise<{ connected: boolean; nickname: string | null } | null> {
  const { data, error } = await supabase
    .from('integration_connections')
    .select('status, account_info, integrations!inner(key)')
    .eq('org_id', orgId)
    .eq('integrations.key', 'sendgrid')
    .maybeSingle();

  if (error || !data) return null;

  return {
    connected: data.status === 'connected',
    nickname: (data.account_info as Record<string, unknown>)?.nickname as string || null,
  };
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
