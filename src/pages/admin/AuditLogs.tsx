import { useState, useEffect } from 'react';
import { getAuditLogs } from '../../services/audit';
import type { AuditLog } from '../../types';
import {
  Shield,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Filter,
  Calendar,
} from 'lucide-react';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    startDate: '',
    endDate: '',
  });
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data, count } = await getAuditLogs({
        limit,
        offset: page * limit,
        entityType: filters.entityType || undefined,
        action: filters.action || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-emerald-500/10 text-emerald-400';
      case 'update':
        return 'bg-cyan-500/10 text-cyan-400';
      case 'delete':
        return 'bg-red-500/10 text-red-400';
      case 'login':
        return 'bg-teal-500/10 text-teal-400';
      case 'logout':
        return 'bg-slate-500/10 text-slate-400';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  const uniqueEntityTypes = [...new Set(logs.map((l) => l.entity_type))];
  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  const totalPages = Math.ceil(totalCount / limit);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">Error loading audit logs</p>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-cyan-400" />
          Audit Logs
        </h1>
        <p className="text-slate-400 mt-1">
          Complete record of all system activities (SuperAdmin only)
        </p>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filters.entityType}
                onChange={(e) => {
                  setFilters({ ...filters, entityType: e.target.value });
                  setPage(0);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">All entities</option>
                {uniqueEntityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={filters.action}
              onChange={(e) => {
                setFilters({ ...filters, action: e.target.value });
                setPage(0);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  setFilters({ ...filters, startDate: e.target.value });
                  setPage(0);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  setFilters({ ...filters, endDate: e.target.value });
                  setPage(0);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {(filters.entityType || filters.action || filters.startDate || filters.endDate) && (
              <button
                onClick={() => {
                  setFilters({ entityType: '', action: '', startDate: '', endDate: '' });
                  setPage(0);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-sm transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No audit logs found</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-800">
              {logs.map((log) => (
                <div key={log.id} className="hover:bg-slate-800/30 transition-colors">
                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="w-full px-4 py-3 flex items-center gap-4 text-left"
                  >
                    {expandedId === log.id ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}

                    <span className="text-xs text-slate-500 w-40 flex-shrink-0">
                      {formatTimestamp(log.timestamp)}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getActionBadge(
                        log.action
                      )}`}
                    >
                      {log.action}
                    </span>

                    <span className="text-sm text-slate-300 flex-shrink-0">{log.entity_type}</span>

                    <span className="text-sm text-white flex-1 truncate">
                      {log.user?.name || log.user?.email || 'System'}
                    </span>

                    {log.entity_id && (
                      <span className="text-xs text-slate-500 font-mono truncate max-w-32">
                        {log.entity_id}
                      </span>
                    )}
                  </button>

                  {expandedId === log.id && (
                    <div className="px-4 pb-4 pl-12 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        {log.before_state && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Before</p>
                            <pre className="p-3 rounded-lg bg-slate-800 text-xs text-slate-300 overflow-auto max-h-48">
                              {JSON.stringify(log.before_state, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.after_state && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">After</p>
                            <pre className="p-3 rounded-lg bg-slate-800 text-xs text-slate-300 overflow-auto max-h-48">
                              {JSON.stringify(log.after_state, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                      {log.ip_address && (
                        <p className="text-xs text-slate-500">IP: {log.ip_address}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Showing {page * limit + 1} - {Math.min((page + 1) * limit, totalCount)} of{' '}
                  {totalCount}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                    className="px-3 py-1 rounded bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1 rounded bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
