import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';

export interface StripeConnectionStatus {
  connected: boolean;
  account_info?: {
    nickname?: string | null;
    stripe_account_id?: string | null;
    country?: string | null;
    default_currency?: string | null;
  } | null;
  connected_at?: string | null;
  last_sync_at?: string | null;
}

export async function getStripeConnectionStatus(): Promise<StripeConnectionStatus> {
  const response = await callEdgeFunction('stripe-provider', { action: 'status' });
  if (!response.ok) {
    return { connected: false };
  }
  const data = await response.json();
  return {
    connected: !!data.connected,
    account_info: data.account_info ?? null,
    connected_at: data.connected_at ?? null,
    last_sync_at: data.last_sync_at ?? null,
  };
}

export async function isStripeConnected(): Promise<boolean> {
  const status = await getStripeConnectionStatus();
  return status.connected;
}

export async function connectStripe(input: {
  secretKey: string;
  publishableKey?: string;
  webhookSigningSecret?: string;
  nickname?: string;
}): Promise<{ success: boolean; error?: string }> {
  const response = await callEdgeFunction('stripe-provider', {
    action: 'connect',
    ...input,
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    return { success: false, error: errBody.error || 'Failed to connect Stripe' };
  }
  return { success: true };
}

export async function testStripeConnection(): Promise<{ success: boolean; error?: string }> {
  const response = await callEdgeFunction('stripe-provider', { action: 'test' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { success: false, error: data.error || 'Stripe connection test failed' };
  }
  return { success: !!data.success, error: data.error };
}

export async function disconnectStripe(): Promise<{ success: boolean; error?: string }> {
  const response = await callEdgeFunction('stripe-provider', { action: 'disconnect' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { success: false, error: data.error || 'Failed to disconnect Stripe' };
  }
  return { success: true };
}

/**
 * Returns which payments provider the current org has connected,
 * preferring Stripe over QBO if both are present (since Stripe is the
 * newer integration). Used by the invoice service to decide which
 * provider to dispatch invoice creation to.
 */
export async function getActivePaymentsProvider(): Promise<
  'stripe' | 'quickbooks_online' | null
> {
  const { data } = await supabase
    .from('payment_provider_connections')
    .select('provider')
    .order('updated_at', { ascending: false });

  if (!data || data.length === 0) return null;
  if (data.some((r) => r.provider === 'stripe')) return 'stripe';
  if (data.some((r) => r.provider === 'quickbooks_online')) return 'quickbooks_online';
  return null;
}
