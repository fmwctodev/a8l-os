import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, CheckCircle } from 'lucide-react';
import type { SystemError } from '../../hooks/useSystemDashboardData';
import { SeverityBadge } from './SeverityBadge';

interface ErrorStreamRowProps {
  error: SystemError;
  onAcknowledge: (id: string) => void;
  onViewLogs?: () => void;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ErrorStreamRow({ error, onAcknowledge, onViewLogs }: ErrorStreamRowProps) {
  const [expanded, setExpanded] = useState(false);

  const rowBorderColor = {
    info: 'border-l-blue-400',
    warning: 'border-l-amber-400',
    error: 'border-l-red-400',
    critical: 'border-l-red-500',
  }[error.severity];

  return (
    <div
      className={`bg-slate-800/50 border-l-2 ${rowBorderColor} rounded-r-lg ${
        error.acknowledged ? 'opacity-60' : ''
      }`}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-slate-700 rounded transition-colors mt-0.5"
            disabled={!error.stackTrace}
          >
            {error.stackTrace ? (
              expanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={error.severity} />
              <span className="text-xs text-slate-500 font-medium">{error.service}</span>
              <span className="text-xs text-slate-600">|</span>
              <span className="text-xs text-slate-500">{formatTimestamp(error.timestamp)}</span>
              {error.affectedCount > 0 && (
                <>
                  <span className="text-xs text-slate-600">|</span>
                  <span className="text-xs text-slate-400">
                    {error.affectedCount} affected
                  </span>
                </>
              )}
            </div>
            <p className="text-sm text-white truncate">{error.summary}</p>
          </div>

          <div className="flex items-center gap-1">
            {onViewLogs && (
              <button
                onClick={onViewLogs}
                className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                title="View logs"
              >
                <Eye className="h-4 w-4 text-slate-400" />
              </button>
            )}
            {!error.acknowledged && (
              <button
                onClick={() => onAcknowledge(error.id)}
                className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                title="Acknowledge"
              >
                <CheckCircle className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && error.stackTrace && (
        <div className="px-3 pb-3 pt-0">
          <pre className="bg-slate-900 rounded p-3 text-xs text-slate-300 font-mono overflow-x-auto">
            {error.stackTrace}
          </pre>
        </div>
      )}
    </div>
  );
}
