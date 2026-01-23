import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface LeadScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showTrend?: boolean;
  previousScore?: number;
}

export function LeadScoreBadge({ score, size = 'md', showTrend = false, previousScore }: LeadScoreBadgeProps) {
  const getScoreColor = (value: number): { bg: string; text: string; border: string } => {
    if (value >= 70) {
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    }
    if (value >= 40) {
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' };
    }
    return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' };
  };

  const colors = getScoreColor(score);

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const getTrend = () => {
    if (!showTrend || previousScore === undefined) return null;
    const diff = score - previousScore;
    if (diff > 0) {
      return <TrendingUp className={`${iconSize[size]} text-emerald-400`} />;
    }
    if (diff < 0) {
      return <TrendingDown className={`${iconSize[size]} text-red-400`} />;
    }
    return <Minus className={`${iconSize[size]} text-slate-400`} />;
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium border ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses[size]}`}
    >
      {score}
      {getTrend()}
    </span>
  );
}

export function getLeadScoreLabel(score: number): string {
  if (score >= 70) return 'Hot';
  if (score >= 40) return 'Warm';
  return 'Cold';
}
