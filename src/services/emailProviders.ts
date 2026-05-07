import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';

const SLUG = 'email-mailgun-provider';
const PROVIDER_KEY = 'mailgun';

export interface ProviderStatus {
  connected: boolean;
  nickname: string | null;
  domain: string | null;
  region: string | null;
}

export async function getProviderStatus(orgId: string): Promise<ProviderStatus | null> {
  const { data, error } = await supabase
    .from('integration_connections')
    .select('status, account_info, integrations!inner(key)')
    .eq('org_id', orgId)
    .eq('integrations.key', PROVIDER_KEY)
    .maybeSingle();

  if (error || !data) return null;

  const accountInfo = (data.account_info ?? {}) as Record<string, unknown>;
  return {
    connected: data.status === 'connected',
    nickname: (accountInfo.nickname as string) || null,
    domain: (accountInfo.domain as string) || null,
    region: (accountInfo.region as string) || null,
  };
}

export interface ConnectMailgunInput {
  apiKey: string;
  domain: string;
  webhookSigningKey?: string;
  region?: 'us' | 'eu';
  nickname?: string;
}

export async function connectProvider(
  input: ConnectMailgunInput,
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, {
    body: {
      action: 'connect',
      apiKey: input.apiKey,
      domain: input.domain,
      webhookSigningKey: input.webhookSigningKey,
      region: input.region,
      nickname: input.nickname,
    },
  });
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
