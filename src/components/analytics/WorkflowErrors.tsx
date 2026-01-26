import { useState } from 'react';
import {
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Zap
} from 'lucide-react';
import type { ErrorAggregate } from '../../services/workflowAnalytics';

interface WorkflowErrorsProps {
  errors: ErrorAggregate[];
  onViewEnrollments?: (nodeId: string) => void;
}

const ERROR_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  provider_error: { label: 'Provider Error', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  validation_error: { label: 'Validation Error', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  permission_error: { label: 'Permission Error', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  timeout: { label: 'Timeout', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  unknown: { label: 'Unknown', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' }
};

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ErrorRow({
  error,
  onViewEnrollments
}: {
  error: ErrorAggregate;
  onViewEnrollments?: (nodeId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = ERROR_TYPE_LABELS[error.errorType] || ERROR_TYPE_LABELS.unknown;

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left"
      >
        <div className="flex-shrink-0">
          <XCircle className="w-5 h-5 text-red-500" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900 dark:text-white truncate">
              {error.nodeName}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {error.errorMessage}
          </p>
        </div>

        <div className="flex-shrink-0 text-right">
          <p className="text-lg font-semibold text-red-600 dark:text-red-400">
            {error.count}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">occurrences</p>
        </div>

        <div className="flex-shrink-0">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 ml-9 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Last Occurred</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                {formatTimeAgo(error.lastOccurred)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Retry Success</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                {(error.retrySuccessRate * 100).toFixed(0)}%
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Error Type</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 capitalize">
                {error.errorType.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Node ID</p>
              <p className="text-sm font-mono text-gray-600 dark:text-gray-400 mt-1 truncate">
                {error.nodeId}
              </p>
            </div>
          </div>

          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
              Error Message
            </p>
            <p className="text-sm text-red-600 dark:text-red-300">
              {error.errorMessage}
            </p>
          </div>

          {onViewEnrollments && (
            <button
              onClick={() => onViewEnrollments(error.nodeId)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="w-4 h-4" />
              View affected enrollments
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkflowErrors({ errors, onViewEnrollments }: WorkflowErrorsProps) {
  const [filter, setFilter] = useState<string>('all');

  const filteredErrors = filter === 'all'
    ? errors
    : errors.filter(e => e.errorType === filter);

  const errorTypes = Array.from(new Set(errors.map(e => e.errorType)));
  const totalErrors = errors.reduce((sum, e) => sum + e.count, 0);

  const topNodes = [...errors]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (errors.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          No errors found
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          All workflow steps are executing successfully
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
            <XCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Total Errors</span>
          </div>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">
            {totalErrors.toLocaleString()}
          </p>
        </div>

        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Failing Actions</span>
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
            {errors.length}
          </p>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
            <RefreshCw className="w-5 h-5" />
            <span className="text-sm font-medium">Avg Retry Success</span>
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {errors.length > 0
              ? ((errors.reduce((sum, e) => sum + e.retrySuccessRate, 0) / errors.length) * 100).toFixed(0)
              : 0}%
          </p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Last Error</span>
          </div>
          <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
            {errors.length > 0 ? formatTimeAgo(errors[0].lastOccurred) : '-'}
          </p>
        </div>
      </div>

      {topNodes.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Top Failing Actions
          </h3>
          <div className="space-y-2">
            {topNodes.map((node, i) => (
              <div key={node.nodeId} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-500 w-6">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {node.nodeName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${Math.min(100, (node.count / totalErrors) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-12 text-right">
                    {node.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Error Details
          </h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <option value="all">All types</option>
            {errorTypes.map(type => (
              <option key={type} value={type}>
                {(ERROR_TYPE_LABELS[type] || ERROR_TYPE_LABELS.unknown).label}
              </option>
            ))}
          </select>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {filteredErrors.map(error => (
            <ErrorRow
              key={`${error.nodeId}-${error.errorType}-${error.errorMessage}`}
              error={error}
              onViewEnrollments={onViewEnrollments}
            />
          ))}

          {filteredErrors.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No errors match the selected filter
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
