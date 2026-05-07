import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Loader2,
  Receipt,
  RefreshCw,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useStripeDashboard, type StripeDateRangePreset } from '../../hooks/useStripeDashboard';
import type { StripeBalance } from '../../services/stripeDashboard';

function formatMoney(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatMoneyDollars(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

function sumBalance(parts: StripeBalance['available'] | undefined): { amount: number; currency: string } {
  if (!parts || parts.length === 0) return { amount: 0, currency: 'usd' };
  // If multi-currency, sum the dominant one only and let the UI flag it
  const dominant = parts.reduce((acc, p) => (p.amount > acc.amount ? p : acc), parts[0]);
  return dominant;
}

function StatusPill({ status }: { status: string }) {
  const isOk = status === 'paid' || status === 'succeeded' || status === 'in_transit';
  const isPending = status === 'pending' || status === 'in_transit';
  const isErr = status === 'failed' || status === 'canceled';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isErr
          ? 'bg-red-500/10 text-red-400'
          : isPending
          ? 'bg-amber-500/10 text-amber-400'
          : isOk
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-slate-700 text-slate-300'
      }`}
    >
      {status}
    </span>
  );
}

const RANGE_OPTIONS: Array<{ value: StripeDateRangePreset; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export function StripeOverviewTab() {
  const { snapshot, loading, error, preset, setPreset, refetch } = useStripeDashboard();

  const tiles = useMemo(() => {
    if (!snapshot) return null;

    const available = sumBalance(snapshot.balance?.available);
    const pending = sumBalance(snapshot.balance?.pending);

    return {
      available: formatMoney(available.amount, available.currency),
      pending: formatMoney(pending.amount, pending.currency),
      mrr: snapshot.mrr ? formatMoneyDollars(snapshot.mrr.amount, snapshot.mrr.currency) : '$0',
      activeSubs: snapshot.active_subscriptions,
      newCustomers: snapshot.new_customers,
      grossVolume: snapshot.volume ? formatMoneyDollars(snapshot.volume.gross, snapshot.volume.currency) : '$0',
      netVolume: snapshot.volume ? formatMoneyDollars(snapshot.volume.net, snapshot.volume.currency) : '$0',
      refunds: snapshot.volume ? formatMoneyDollars(snapshot.volume.refunds, snapshot.volume.currency) : '$0',
    };
  }, [snapshot]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-white">Stripe Overview</h3>
          <p className="text-sm text-slate-400">Live data from your connected Stripe account.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as StripeDateRangePreset)}
            className="rounded-lg bg-slate-800 border border-slate-700 text-white text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {snapshot && snapshot.errors.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Some tiles failed to load.</p>
            <ul className="list-disc list-inside text-xs opacity-80 mt-1">
              {snapshot.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {loading && !snapshot ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile
              icon={<Wallet className="w-5 h-5" />}
              label="Available Balance"
              value={tiles?.available ?? '—'}
              tone="emerald"
            />
            <Tile
              icon={<Wallet className="w-5 h-5" />}
              label="Pending Balance"
              value={tiles?.pending ?? '—'}
              tone="slate"
            />
            <Tile
              icon={<TrendingUp className="w-5 h-5" />}
              label="MRR"
              value={tiles?.mrr ?? '—'}
              sub={tiles ? `${tiles.activeSubs} active subscriptions` : undefined}
              tone="cyan"
            />
            <Tile
              icon={<UserPlus className="w-5 h-5" />}
              label="New Customers"
              value={String(tiles?.newCustomers ?? '—')}
              sub={`Last ${preset.replace('d', '')} days`}
              tone="cyan"
            />
            <Tile
              icon={<DollarSign className="w-5 h-5" />}
              label="Gross Volume"
              value={tiles?.grossVolume ?? '—'}
              sub={`Last ${preset.replace('d', '')} days`}
              tone="emerald"
            />
            <Tile
              icon={<DollarSign className="w-5 h-5" />}
              label="Net Volume"
              value={tiles?.netVolume ?? '—'}
              sub={`After fees + refunds`}
              tone="emerald"
            />
            <Tile
              icon={<ArrowDownRight className="w-5 h-5" />}
              label="Refunds"
              value={tiles?.refunds ?? '—'}
              tone="amber"
            />
            <Tile
              icon={<Receipt className="w-5 h-5" />}
              label="Recent Payments"
              value={String(snapshot?.payments.length ?? '—')}
              sub={snapshot ? `${snapshot.payments.filter((p) => p.status === 'succeeded').length} succeeded` : undefined}
              tone="slate"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Recent Payouts">
              {!snapshot?.payouts.length ? (
                <p className="text-slate-500 text-sm py-6 text-center">No payouts in this period.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-700">
                  <table className="min-w-full divide-y divide-slate-700 text-sm">
                    <thead className="bg-slate-800/50">
                      <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Arrival</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50 bg-slate-900">
                      {snapshot.payouts.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2 text-white font-medium">{formatMoney(p.amount, p.currency)}</td>
                          <td className="px-3 py-2 text-slate-400">
                            {new Date(p.arrival_date * 1000).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">
                            <StatusPill status={p.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Recent Payments">
              {!snapshot?.payments.length ? (
                <p className="text-slate-500 text-sm py-6 text-center">No payments yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-700">
                  <table className="min-w-full divide-y divide-slate-700 text-sm">
                    <thead className="bg-slate-800/50">
                      <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50 bg-slate-900">
                      {snapshot.payments.slice(0, 10).map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2 text-white font-medium">{formatMoney(p.amount, p.currency)}</td>
                          <td className="px-3 py-2 text-slate-400">
                            {new Date(p.created * 1000).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">
                            <StatusPill status={p.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: 'emerald' | 'cyan' | 'amber' | 'slate';
}) {
  const toneClass = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
    amber: 'bg-amber-500/10 text-amber-400',
    slate: 'bg-slate-700/50 text-slate-300',
  }[tone];
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${toneClass}`}>{icon}</div>
        <p className="text-sm text-slate-400 truncate">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white truncate">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <ArrowUpRight className="w-4 h-4 text-slate-500" />
      </div>
      {children}
    </div>
  );
}
