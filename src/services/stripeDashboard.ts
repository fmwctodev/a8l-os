import { callEdgeFunction } from '../lib/edgeFunction';
import { supabase } from '../lib/supabase';

export interface StripeBalance {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
}

export interface StripePayout {
  id: string;
  amount: number;
  currency: string;
  arrival_date: number;
  status: string;
  type: string;
  created: number;
}

export interface StripePaymentIntent {
  id: string;
  amount: number;
  amount_received: number;
  currency: string;
  status: string;
  created: number;
  customer: string | null;
  description: string | null;
  receipt_email: string | null;
  metadata: Record<string, string>;
}

export interface StripeMRR {
  amount: number;
  currency: string;
  mixed_currency: boolean;
}

export interface StripeVolume {
  gross: number;
  net: number;
  refunds: number;
  fees: number;
  currency: string;
}

export interface StripeDashboardSnapshot {
  balance: StripeBalance | null;
  payouts: StripePayout[];
  payments: StripePaymentIntent[];
  mrr: StripeMRR | null;
  active_subscriptions: number;
  new_customers: number;
  volume: StripeVolume | null;
  errors: string[];
}

export interface DashboardDateRange {
  start: Date;
  end: Date;
}

async function getOrgId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userRow } = await supabase
    .from('users')
    .select('organization_id, super_admin_active_org_id, role:roles(name)')
    .eq('id', user.id)
    .maybeSingle();
  if (!userRow) throw new Error('User not found');

  const role = userRow.role as { name: string } | { name: string }[] | null;
  const roleName = Array.isArray(role) ? role[0]?.name : role?.name;
  const isSuperAdmin = roleName === 'SuperAdmin';
  return (
    (isSuperAdmin && userRow.super_admin_active_org_id) || userRow.organization_id
  );
}

async function callStripeApi<T>(action: string, extra: Record<string, unknown> = {}): Promise<T | null> {
  const orgId = await getOrgId();
  const response = await callEdgeFunction('stripe-api', { action, org_id: orgId, ...extra });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `stripe-api ${action} failed (${response.status})`);
  }
  const data = await response.json();
  return data as T;
}

export async function fetchStripeBalance(): Promise<StripeBalance | null> {
  const r = await callStripeApi<{ balance: StripeBalance }>('getBalance');
  return r?.balance ?? null;
}

export async function fetchStripePayouts(limit = 10): Promise<StripePayout[]> {
  const r = await callStripeApi<{ payouts: StripePayout[] }>('listPayouts', { limit });
  return r?.payouts ?? [];
}

export async function fetchStripePayments(limit = 20): Promise<StripePaymentIntent[]> {
  const r = await callStripeApi<{ payments: StripePaymentIntent[] }>('listPayments', { limit });
  return r?.payments ?? [];
}

export async function fetchStripeMRR(): Promise<{ mrr: StripeMRR; active_subscriptions: number } | null> {
  const r = await callStripeApi<{ mrr: StripeMRR; active_subscriptions: number }>('getMRR');
  return r;
}

export async function fetchStripeNewCustomerCount(range: DashboardDateRange): Promise<number> {
  const r = await callStripeApi<{ count: number }>('countNewCustomers', {
    created_gte: Math.floor(range.start.getTime() / 1000),
    created_lte: Math.floor(range.end.getTime() / 1000),
  });
  return r?.count ?? 0;
}

export async function fetchStripeVolume(range: DashboardDateRange): Promise<StripeVolume | null> {
  const r = await callStripeApi<{ volume: StripeVolume }>('getVolumeMetrics', {
    created_gte: Math.floor(range.start.getTime() / 1000),
    created_lte: Math.floor(range.end.getTime() / 1000),
  });
  return r?.volume ?? null;
}

/**
 * Fetches all dashboard tiles in parallel. Returns a partial snapshot
 * even if some calls fail — failed-call errors are surfaced in
 * `errors[]` so the UI can show what worked + what didn't.
 */
export async function getStripeDashboardSnapshot(
  range: DashboardDateRange,
): Promise<StripeDashboardSnapshot> {
  const errors: string[] = [];
  const tag = (label: string) => async <T>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };

  const [balance, payouts, payments, mrrResult, newCustomers, volume] = await Promise.all([
    tag('balance')(fetchStripeBalance()),
    tag('payouts')(fetchStripePayouts(10)),
    tag('payments')(fetchStripePayments(20)),
    tag('mrr')(fetchStripeMRR()),
    tag('new_customers')(fetchStripeNewCustomerCount(range)),
    tag('volume')(fetchStripeVolume(range)),
  ]);

  return {
    balance,
    payouts: payouts ?? [],
    payments: payments ?? [],
    mrr: mrrResult?.mrr ?? null,
    active_subscriptions: mrrResult?.active_subscriptions ?? 0,
    new_customers: newCustomers ?? 0,
    volume,
    errors,
  };
}
