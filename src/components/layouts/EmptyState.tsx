import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  helpText?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  helpText,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="p-4 rounded-full bg-slate-800/50 border border-slate-700 mb-4">
        <Icon className="w-10 h-10 text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-center max-w-sm mb-6">{description}</p>

      <div className="flex items-center gap-3">
        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg hover:from-cyan-600 hover:to-teal-600 transition-all font-medium text-sm shadow-lg shadow-cyan-500/25"
          >
            {primaryAction.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors font-medium text-sm"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>

      {helpText && (
        <p className="text-xs text-slate-500 mt-6 text-center max-w-sm">{helpText}</p>
      )}
    </div>
  );
}
