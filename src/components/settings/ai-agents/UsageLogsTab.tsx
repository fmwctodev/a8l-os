import { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Search,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as usageLogsService from '../../../services/aiUsageLogs';
import * as agentsService from '../../../services/aiAgents';
import * as usersService from '../../../services/users';
import type {
  AIUsageLog,
  AIUsageMetrics,
  AIUsageLogFilters,
  AIUsageLogStatus,
  ExportFormat,
  AIAgent,
  User,
} from '../../../types';

const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export function UsageLogsTab() {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [metrics, setMetrics] = useState<AIUsageMetrics | null>(null);
  const [logs, setLogs] = useState<AIUsageLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [filters, setFilters] = useState<AIUsageLogFilters>({});
  const [datePreset, setDatePreset] = useState(7);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (orgId) {
      loadReferenceData();
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - datePreset);
      startDate.setHours(0, 0, 0, 0);

      setFilters((prev) => ({
        ...prev,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }));
    }
  }, [orgId, datePreset]);

  useEffect(() => {
    if (orgId && filters.startDate && filters.endDate) {
      loadData();
    }
  }, [orgId, filters, page, pageSize]);

  const loadReferenceData = async () => {
    if (!orgId) return;
    try {
      const [agentsData, usersData] = await Promise.all([
        agentsService.getAgents(orgId),
        usersService.getUsers(orgId),
      ]);
      setAgents(agentsData);
      setUsers(usersData);
    } catch (err) {
      console.error('Failed to load reference data', err);
    }
  };

  const loadData = async () => {
    if (!orgId || !filters.startDate || !filters.endDate) return;
    try {
      setLoading(true);
      const [metricsData, logsData] = await Promise.all([
        usageLogsService.getUsageMetrics(orgId, filters.startDate, filters.endDate),
        usageLogsService.getUsageLogs(orgId, filters, page, pageSize),
      ]);
      setMetrics(metricsData);
      setLogs(logsData.data);
      setTotalLogs(logsData.total);
      setTotalPages(logsData.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!orgId) return;
    try {
      setExporting(true);
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'csv') {
        content = await usageLogsService.exportLogsCSV(orgId, filters);
        filename = `ai-usage-logs-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        content = await usageLogsService.exportLogsJSON(orgId, filters);
        filename = `ai-usage-logs-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {metrics && (
        <section>
          <h2 className="text-lg font-medium text-white mb-4">Usage Overview</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Activity className="w-4 h-4" />
                  Total Runs
                </div>
                {metrics.runs_by_day.length > 1 && (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {metrics.total_runs.toLocaleString()}
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Success Rate
              </div>
              <div
                className={`mt-2 text-2xl font-semibold ${
                  metrics.success_rate >= 95
                    ? 'text-emerald-400'
                    : metrics.success_rate >= 80
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }`}
              >
                {metrics.success_rate.toFixed(1)}%
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <XCircle className="w-4 h-4" />
                Error Rate
              </div>
              <div
                className={`mt-2 text-2xl font-semibold ${
                  metrics.error_rate <= 5
                    ? 'text-emerald-400'
                    : metrics.error_rate <= 15
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }`}
              >
                {metrics.error_rate.toFixed(1)}%
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Clock className="w-4 h-4" />
                Avg Response Time
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {formatDuration(metrics.avg_duration_ms)}
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-medium text-white">Usage Logs</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  onClick={() => {
                    setDatePreset(preset.days);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm rounded ${
                    datePreset === preset.days
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${
                  showFilters || filters.status || filters.agentIds?.length || filters.userIds?.length
                    ? 'bg-cyan-600 border-cyan-600 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>

              {showFilters && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                    <select
                      value={filters.status || ''}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          status: (e.target.value as AIUsageLogStatus) || undefined,
                        }))
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                    >
                      <option value="">All</option>
                      <option value="success">Success</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Agent</label>
                    <select
                      value={filters.agentIds?.[0] || ''}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          agentIds: e.target.value ? [e.target.value] : undefined,
                        }))
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                    >
                      <option value="">All Agents</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">User</label>
                    <select
                      value={filters.userIds?.[0] || ''}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          userIds: e.target.value ? [e.target.value] : undefined,
                        }))
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                    >
                      <option value="">All Users</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={filters.search || ''}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))
                        }
                        placeholder="Search actions..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-700 flex justify-between">
                    <button
                      onClick={() => {
                        setFilters((prev) => ({
                          startDate: prev.startDate,
                          endDate: prev.endDate,
                        }));
                        setPage(1);
                      }}
                      className="text-sm text-slate-400 hover:text-white"
                    >
                      Clear Filters
                    </button>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="px-3 py-1 bg-cyan-600 text-white text-sm rounded hover:bg-cyan-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative group">
              <button
                disabled={exporting}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white text-sm"
              >
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute right-0 mt-1 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-t-lg"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  disabled={exporting}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-b-lg"
                >
                  Export JSON
                </button>
              </div>
            </div>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
            <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No usage logs found for the selected period</p>
          </div>
        ) : (
          <>
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="w-8"></th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">
                      Timestamp
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Agent</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">User</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Action</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Model</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 cursor-pointer"
                      >
                        <td className="pl-4 py-3">
                          {expandedLogId === log.id ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">{formatDate(log.created_at)}</td>
                        <td className="px-4 py-3 text-sm text-white font-medium">{log.agent_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{log.user_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 max-w-xs truncate">
                          {log.action_summary}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              log.status === 'success'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}
                          >
                            {log.status === 'success' ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1" />
                            )}
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">{log.model_key}</td>
                        <td className="px-4 py-3 text-sm text-slate-400 text-right">
                          {formatDuration(log.duration_ms)}
                        </td>
                      </tr>
                      {expandedLogId === log.id && (
                        <tr key={`${log.id}-expanded`} className="bg-slate-900/50">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid gap-4 md:grid-cols-3">
                              <div>
                                <span className="text-xs text-slate-500">Tokens</span>
                                <p className="text-sm text-slate-300">
                                  Input: {log.input_tokens || '-'} / Output: {log.output_tokens || '-'}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Agent ID</span>
                                <p className="text-sm text-slate-300 font-mono">{log.agent_id || '-'}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">User ID</span>
                                <p className="text-sm text-slate-300 font-mono">{log.user_id || '-'}</p>
                              </div>
                              {log.error_message && (
                                <div className="md:col-span-3">
                                  <span className="text-xs text-slate-500">Error Message</span>
                                  <p className="text-sm text-red-400">{log.error_message}</p>
                                </div>
                              )}
                              {Object.keys(log.metadata || {}).length > 0 && (
                                <div className="md:col-span-3">
                                  <span className="text-xs text-slate-500">Metadata</span>
                                  <pre className="mt-1 text-xs text-slate-400 bg-slate-800 p-2 rounded overflow-auto max-h-32">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">
                  Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalLogs)} of{' '}
                  {totalLogs}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-300 hover:text-white disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-300 hover:text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
