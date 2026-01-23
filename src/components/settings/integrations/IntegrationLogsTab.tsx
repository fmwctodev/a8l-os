import { useState, useEffect } from 'react';
import { Calendar, Filter, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { getIntegrationLogs } from '../../../services/integrations';
import type { IntegrationLog, IntegrationLogAction } from '../../../types';

const actionOptions: { value: IntegrationLogAction | ''; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'connect', label: 'Connect' },
  { value: 'disconnect', label: 'Disconnect' },
  { value: 'enable', label: 'Enable' },
  { value: 'disable', label: 'Disable' },
  { value: 'test', label: 'Test' },
  { value: 'sync', label: 'Sync' },
  { value: 'error', label: 'Error' },
  { value: 'token_refresh', label: 'Token Refresh' },
];

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
];

export function IntegrationLogsTab() {
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<IntegrationLogAction | ''>('');
  const [statusFilter, setStatusFilter] = useState<'success' | 'failure' | ''>('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [actionFilter, statusFilter, dateFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await getIntegrationLogs({
        action: actionFilter ? [actionFilter] : undefined,
        status: statusFilter ? [statusFilter] : undefined,
        startDate: dateFilter || undefined,
      });
      setLogs(data);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'connect':
        return 'bg-green-50 text-green-700';
      case 'disconnect':
        return 'bg-red-50 text-red-700';
      case 'enable':
        return 'bg-blue-50 text-blue-700';
      case 'disable':
        return 'bg-gray-100 text-gray-700';
      case 'test':
        return 'bg-purple-50 text-purple-700';
      case 'sync':
        return 'bg-cyan-50 text-cyan-700';
      case 'error':
        return 'bg-red-50 text-red-700';
      case 'token_refresh':
        return 'bg-amber-50 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as IntegrationLogAction | '')}
            className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {actionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'success' | 'failure' | '')}
          className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={loadLogs}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No activity logs found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Integration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {(log.integration as any)?.name || 'Unknown'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${getActionBadgeColor(
                        log.action
                      )}`}
                    >
                      {log.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {log.status === 'success' ? (
                      <span className="inline-flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-red-600">
                        <XCircle className="h-4 w-4" />
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {(log.user as any)?.name || (log.user as any)?.email || 'System'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.error_message && (
                      <span className="text-red-600">{log.error_message}</span>
                    )}
                    {log.request_meta && !log.error_message && (
                      <span className="truncate max-w-xs block">
                        {JSON.stringify(log.request_meta).slice(0, 50)}...
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
