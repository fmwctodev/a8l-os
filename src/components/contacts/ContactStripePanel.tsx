import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  Undo2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { callEdgeFunction } from '../../lib/edgeFunction';
import { getActivePaymentsProvider } from '../../services/stripeAuth';

interface ContactStripePanelProps {
  contactId: string;
}

interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  description: string | null;
}

export function ContactStripePanel({ contactId }: ContactStripePanelProps) {
  const [provider, setProvider] = useState<'stripe' | 'quickbooks_online' | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [payments, setPayments] = useState<StripePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getActivePaymentsProvider();
        if (cancelled) return;
        setProvider(p);
        if (p !== 'stripe') {
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: userRow } = await supabase
          .from('users')
          .select('organization_id, super_admin_active_org_id, role:roles(name)')
          .eq('id', user.id)
          .maybeSingle();
        if (!userRow) return;
        const role = userRow.role as { name: string } | { name: string }[] | null;
        const roleName = Array.isArray(role) ? role[0]?.name : role?.name;
        const isSuperAdmin = roleName === 'SuperAdmin';
        const activeOrg = (isSuperAdmin && userRow.super_admin_active_org_id) || userRow.organization_id;
        if (cancelled) return;
        setOrgId(activeOrg);

        const { data: contact } = await supabase
          .from('contacts')
          .select('stripe_customer_id')
          .eq('id', contactId)
          .maybeSingle();
        if (cancelled) return;
        const sid = contact?.stripe_customer_id ?? null;
        setStripeCustomerId(sid);

        if (sid) {
          await loadPayments(activeOrg, sid);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const loadPayments = async (org: string, customerId: string) => {
    const response = await callEdgeFunction('stripe-api', {
      action: 'listPayments',
      org_id: org,
      customer: customerId,
      limit: 20,
    });
    if (!response.ok) {
      setError('Failed to load Stripe payments');
      return;
    }
    const data = await response.json();
    setPayments(data.payments ?? []);
  };

  const handleLink = async () => {
    if (!orgId) return;
    setLinking(true);
    setError(null);
    try {
      const response = await callEdgeFunction('stripe-api', {
        action: 'findOrCreateCustomerByContact',
        org_id: orgId,
        contact_id: contactId,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to link Stripe customer');
        return;
      }
      setStripeCustomerId(data.customer.id);
      await loadPayments(orgId, data.customer.id);
    } finally {
      setLinking(false);
    }
  };

  const handleRefund = async (paymentIntentId: string, amount: number) => {
    if (!orgId) return;
    if (!confirm(`Refund this $${(amount / 100).toFixed(2)} payment?`)) return;
    setRefundingId(paymentIntentId);
    setError(null);
    try {
      // PaymentIntents have a charge attached — refund accepts payment_intent OR charge
      const response = await callEdgeFunction('stripe-api', {
        action: 'refundCharge',
        org_id: orgId,
        charge_id: paymentIntentId,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Refund failed');
        return;
      }
      // Reload payments to show updated status
      if (stripeCustomerId) await loadPayments(orgId, stripeCustomerId);
    } finally {
      setRefundingId(null);
    }
  };

  if (provider !== 'stripe') return null;
  if (loading) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Stripe Customer</h4>
            {stripeCustomerId ? (
              <p className="text-xs font-mono text-slate-500 truncate max-w-xs">{stripeCustomerId}</p>
            ) : (
              <p className="text-xs text-slate-500">Not yet linked to a Stripe customer.</p>
            )}
          </div>
        </div>
        {stripeCustomerId ? (
          <a
            href={`https://dashboard.stripe.com/customers/${stripeCustomerId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            View in Stripe <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <button
            onClick={handleLink}
            disabled={linking}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 text-xs font-medium disabled:opacity-50"
          >
            {linking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Sync to Stripe
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {stripeCustomerId && (
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Stripe Payments</p>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500 py-3">No Stripe payments for this contact yet.</p>
          ) : (
            <div className="overflow-hidden rounded border border-slate-700">
              <table className="min-w-full divide-y divide-slate-700 text-sm">
                <thead className="bg-slate-800/50">
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 bg-slate-900">
                  {payments.map((p) => {
                    const isSuccess = p.status === 'succeeded';
                    return (
                      <tr key={p.id}>
                        <td className="px-3 py-2 text-white font-medium">
                          ${(p.amount / 100).toFixed(2)} {p.currency.toUpperCase()}
                        </td>
                        <td className="px-3 py-2 text-slate-400">
                          {new Date(p.created * 1000).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              isSuccess
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : p.status === 'requires_action'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isSuccess && (
                            <button
                              onClick={() => handleRefund(p.id, p.amount)}
                              disabled={refundingId === p.id}
                              className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              {refundingId === p.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Undo2 className="w-3 h-3" />
                              )}
                              Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
