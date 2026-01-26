import { Clock, Image, FileText, TrendingUp, Globe, Lightbulb } from 'lucide-react';

interface AIInsight {
  category: 'timing' | 'content' | 'media' | 'engagement' | 'platform';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  dataPoints: string[];
}

interface InsightCardProps {
  insight: AIInsight;
}

const categoryConfig: Record<string, { icon: typeof Clock; color: string; bgColor: string }> = {
  timing: {
    icon: Clock,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  content: {
    icon: FileText,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  media: {
    icon: Image,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  engagement: {
    icon: TrendingUp,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
  },
  platform: {
    icon: Globe,
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-100 dark:bg-sky-900/30',
  },
};

const confidenceColors: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
  medium: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  low: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' },
};

export function InsightCard({ insight }: InsightCardProps) {
  const config = categoryConfig[insight.category] || {
    icon: Lightbulb,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  };
  const Icon = config.icon;
  const confidenceStyle = confidenceColors[insight.confidence];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {insight.title}
            </h3>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${confidenceStyle.bg} ${confidenceStyle.text}`}
            >
              {insight.confidence}
            </span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            {insight.description}
          </p>

          {insight.dataPoints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {insight.dataPoints.map((point, index) => (
                <span
                  key={index}
                  className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
                >
                  {point}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
