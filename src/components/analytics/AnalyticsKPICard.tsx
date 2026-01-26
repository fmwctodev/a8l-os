import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

interface DeltaResult {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface AnalyticsKPICardProps {
  title: string;
  value: string | number;
  delta?: DeltaResult;
  icon?: LucideIcon;
  iconColor?: string;
  sublabel?: string;
  invertTrend?: boolean;
  onClick?: () => void;
}

export function AnalyticsKPICard({
  title,
  value,
  delta,
  icon: Icon,
  iconColor = 'text-blue-600',
  sublabel,
  invertTrend = false,
  onClick,
}: AnalyticsKPICardProps) {
  const getTrendIcon = () => {
    if (!delta) return null;

    const trend = delta.trend;
    if (trend === 'up') {
      return <TrendingUp className="w-4 h-4" />;
    } else if (trend === 'down') {
      return <TrendingDown className="w-4 h-4" />;
    }
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (!delta) return 'text-gray-500';

    const trend = delta.trend;
    const isPositive = invertTrend ? trend === 'down' : trend === 'up';
    const isNegative = invertTrend ? trend === 'up' : trend === 'down';

    if (isPositive) return 'text-emerald-600';
    if (isNegative) return 'text-red-600';
    return 'text-gray-500';
  };

  const formatDelta = () => {
    if (!delta) return '';
    const sign = delta.deltaPercent > 0 ? '+' : '';
    return `${sign}${delta.deltaPercent}%`;
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 ${
        onClick ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {title}
        </span>
        {Icon && (
          <div className={`p-2 rounded-lg bg-gray-50 dark:bg-gray-700 ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="flex items-end gap-3">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>

        {delta && (
          <div className={`flex items-center gap-1 text-sm font-medium ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>{formatDelta()}</span>
          </div>
        )}
      </div>

      {sublabel && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{sublabel}</p>
      )}
    </div>
  );
}
