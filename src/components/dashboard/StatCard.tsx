import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type AccentColor = 'cyan' | 'teal' | 'amber' | 'rose' | 'emerald' | 'blue';

interface StatCardProps {
  title: string;
  value: number | string;
  sublabel?: string;
  delta?: number;
  deltaType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  accentColor?: AccentColor;
  onClick?: () => void;
  isLoading?: boolean;
}

const accentColorMap: Record<AccentColor, { icon: string; border: string }> = {
  cyan: { icon: 'text-cyan-400', border: 'border-cyan-500/20' },
  teal: { icon: 'text-teal-400', border: 'border-teal-500/20' },
  amber: { icon: 'text-amber-400', border: 'border-amber-500/20' },
  rose: { icon: 'text-rose-400', border: 'border-rose-500/20' },
  emerald: { icon: 'text-emerald-400', border: 'border-emerald-500/20' },
  blue: { icon: 'text-blue-400', border: 'border-blue-500/20' },
};

export function StatCard({
  title,
  value,
  sublabel,
  delta,
  deltaType = 'neutral',
  icon: Icon,
  accentColor = 'cyan',
  onClick,
  isLoading,
}: StatCardProps) {
  const colors = accentColorMap[accentColor];

  const deltaColors = {
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    neutral: 'text-slate-400',
  };

  if (isLoading) {
    return (
      <div className={`bg-slate-800 rounded-xl border border-slate-700 p-5`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-24 bg-slate-700 rounded" />
            <div className="h-8 w-8 bg-slate-700 rounded" />
          </div>
          <div className="h-8 w-16 bg-slate-700 rounded mb-2" />
          <div className="h-3 w-20 bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-slate-800 rounded-xl border ${colors.border} border-slate-700 p-5 transition-colors hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        <Icon className={`h-5 w-5 ${colors.icon}`} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-white">{value}</span>
        {delta !== undefined && (
          <span className={`text-sm font-medium ${deltaColors[deltaType]}`}>
            {deltaType === 'positive' ? '+' : deltaType === 'negative' ? '' : ''}
            {delta}%
          </span>
        )}
      </div>
      {sublabel && <p className="mt-1 text-sm text-slate-500">{sublabel}</p>}
    </button>
  );
}
