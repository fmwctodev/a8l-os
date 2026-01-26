import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PlatformMetrics {
  platform: string;
  postsCount: number;
  avgEngagement: number;
  avgReach: number;
  topMediaType: string;
  bestPostingHour: number;
  trend: 'up' | 'down' | 'stable';
}

interface PlatformComparisonCardProps {
  data: PlatformMetrics;
  onClick?: () => void;
}

const platformColors: Record<string, { bg: string; text: string; border: string }> = {
  instagram: { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-600', border: 'border-pink-200 dark:border-pink-800' },
  facebook: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600', border: 'border-blue-200 dark:border-blue-800' },
  linkedin: { bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-600', border: 'border-sky-200 dark:border-sky-800' },
  twitter: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-600', border: 'border-gray-200 dark:border-gray-700' },
  tiktok: { bg: 'bg-slate-50 dark:bg-slate-900/20', text: 'text-slate-600', border: 'border-slate-200 dark:border-slate-800' },
  youtube: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600', border: 'border-red-200 dark:border-red-800' },
};

export function PlatformComparisonCard({ data, onClick }: PlatformComparisonCardProps) {
  const colors = platformColors[data.platform.toLowerCase()] || platformColors.twitter;

  const formatHour = (hour: number) => {
    if (hour === 0) return '12AM';
    if (hour === 12) return '12PM';
    if (hour > 12) return `${hour - 12}PM`;
    return `${hour}AM`;
  };

  const getTrendIcon = () => {
    switch (data.trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div
      className={`${colors.bg} border ${colors.border} rounded-xl p-5 ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-semibold ${colors.text}`}>
            {data.platform.charAt(0).toUpperCase() + data.platform.slice(1)}
          </span>
          {getTrendIcon()}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-2 py-1 rounded">
          {data.postsCount} posts
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Engagement</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{data.avgEngagement}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Reach</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{data.avgReach}%</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Best:</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">
            {data.topMediaType}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Peak:</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {formatHour(data.bestPostingHour)}
          </span>
        </div>
      </div>
    </div>
  );
}
