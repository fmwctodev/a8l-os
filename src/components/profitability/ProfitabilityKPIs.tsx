import { DollarSign, TrendingUp, ArrowDownRight, Wallet, Receipt, AlertCircle } from 'lucide-react';
import type { ProfitabilitySummary } from '../../types';

interface Props {
  summary: ProfitabilitySummary;
  isLoading: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

function SkeletonCard() {
  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-24 bg-slate-700 rounded" />
        <div className="h-8 w-8 bg-slate-700 rounded-lg" />
      </div>
      <div className="h-7 w-20 bg-slate-700 rounded mb-2" />
      <div className="h-3 w-16 bg-slate-700/60 rounded" />
    </div>
  );
}

const cards = [
  {
    key: 'revenue',
    label: 'Total Revenue',
    getValue: (s: ProfitabilitySummary) => fmt(s.totalRevenue),
    getSub: (s: ProfitabilitySummary) => `${s.projectCount} projects`,
    icon: DollarSign,
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
    border: 'border-cyan-500/20',
  },
  {
    key: 'costs',
    label: 'Total Costs',
    getValue: (s: ProfitabilitySummary) => fmt(s.totalCosts),
    getSub: () => 'All cost entries',
    icon: ArrowDownRight,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  {
    key: 'profit',
    label: 'Gross Profit',
    getValue: (s: ProfitabilitySummary) => fmt(s.grossProfit),
    getSub: (s: ProfitabilitySummary) => s.grossProfit >= 0 ? 'Profitable' : 'Loss',
    icon: TrendingUp,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  {
    key: 'margin',
    label: 'Overall Margin',
    getValue: (s: ProfitabilitySummary) => `${s.overallMargin}%`,
    getSub: (s: ProfitabilitySummary) =>
      s.overallMargin >= 40 ? 'Healthy' : s.overallMargin >= 20 ? 'Moderate' : 'Low',
    icon: Receipt,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  {
    key: 'collected',
    label: 'Collected',
    getValue: (s: ProfitabilitySummary) => fmt(s.totalCollected),
    getSub: (s: ProfitabilitySummary) =>
      s.totalRevenue > 0
        ? `${Math.round((s.totalCollected / s.totalRevenue) * 100)}% collection rate`
        : 'No revenue',
    icon: Wallet,
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-400',
    border: 'border-teal-500/20',
  },
  {
    key: 'outstanding',
    label: 'Outstanding',
    getValue: (s: ProfitabilitySummary) => fmt(s.outstanding),
    getSub: () => 'Invoiced - Collected',
    icon: AlertCircle,
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
    border: 'border-rose-500/20',
  },
];

export function ProfitabilityKPIs({ summary, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className={`bg-slate-800/60 rounded-xl border ${card.border} border-slate-700/50 p-5 transition-colors hover:bg-slate-800`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-400">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.iconBg}`}>
                <Icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
            </div>
            <p className="text-2xl font-semibold text-white tabular-nums">
              {card.getValue(summary)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{card.getSub(summary)}</p>
          </div>
        );
      })}
    </div>
  );
}
