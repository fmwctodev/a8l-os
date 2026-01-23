import { DollarSign, TrendingUp, Trophy, XCircle, Target } from 'lucide-react';
import type { OpportunityStats } from '../../types';

interface PipelineSummaryStripProps {
  stats: OpportunityStats;
  isVisible: boolean;
}

export function PipelineSummaryStrip({ stats, isVisible }: PipelineSummaryStripProps) {
  if (!isVisible) return null;

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="flex items-center gap-6 px-4 py-3 bg-slate-800/50 border-b border-slate-700 overflow-x-auto">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <div className="p-1.5 rounded bg-amber-500/20">
          <DollarSign className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <div className="text-xs text-slate-400">Pipeline Value</div>
          <div className="text-lg font-semibold text-amber-400">
            {formatCurrency(stats.totalValue)}
          </div>
        </div>
      </div>

      <div className="w-px h-10 bg-slate-700" />

      <div className="flex items-center gap-2 whitespace-nowrap">
        <div className="p-1.5 rounded bg-cyan-500/20">
          <Target className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <div className="text-xs text-slate-400">Open</div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-white">{stats.openOpportunities}</span>
            <span className="text-sm text-slate-400">
              ({formatCurrency(stats.totalValue - stats.wonValue)})
            </span>
          </div>
        </div>
      </div>

      <div className="w-px h-10 bg-slate-700" />

      <div className="flex items-center gap-2 whitespace-nowrap">
        <div className="p-1.5 rounded bg-emerald-500/20">
          <Trophy className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <div className="text-xs text-slate-400">Won</div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-emerald-400">{stats.wonOpportunities}</span>
            <span className="text-sm text-emerald-400/70">
              ({formatCurrency(stats.wonValue)})
            </span>
          </div>
        </div>
      </div>

      <div className="w-px h-10 bg-slate-700" />

      <div className="flex items-center gap-2 whitespace-nowrap">
        <div className="p-1.5 rounded bg-red-500/20">
          <XCircle className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <div className="text-xs text-slate-400">Lost</div>
          <div className="text-lg font-semibold text-red-400">{stats.lostOpportunities}</div>
        </div>
      </div>

      <div className="w-px h-10 bg-slate-700" />

      <div className="flex items-center gap-2 whitespace-nowrap">
        <div className="p-1.5 rounded bg-slate-600">
          <TrendingUp className="w-4 h-4 text-slate-300" />
        </div>
        <div>
          <div className="text-xs text-slate-400">Win Rate</div>
          <div className="text-lg font-semibold text-white">
            {stats.conversionRate.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
