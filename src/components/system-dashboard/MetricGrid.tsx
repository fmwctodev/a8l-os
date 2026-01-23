import type { ReactNode } from 'react';

interface MetricItem {
  label: string;
  value: string | number;
  onClick?: () => void;
}

interface MetricGridProps {
  title: string;
  metrics: MetricItem[];
  isLoading?: boolean;
}

export function MetricGrid({ title, metrics, isLoading }: MetricGridProps) {
  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="animate-pulse">
          <div className="h-5 w-24 bg-slate-700 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-28 bg-slate-700 rounded" />
                <div className="h-4 w-12 bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      <div className="space-y-3">
        {metrics.map((metric, idx) => (
          <div key={idx} className="flex items-center justify-between">
            {metric.onClick ? (
              <button
                onClick={metric.onClick}
                className="text-sm text-slate-400 hover:text-cyan-400 transition-colors text-left"
              >
                {metric.label}
              </button>
            ) : (
              <span className="text-sm text-slate-400">{metric.label}</span>
            )}
            <span className="text-sm font-medium text-white">{metric.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
