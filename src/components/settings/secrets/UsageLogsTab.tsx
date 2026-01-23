import { useState, useEffect } from 'react';
import { History, Key, User, Server, Workflow, Eye, Pencil, Trash2, RefreshCw, Search, Filter } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as secretsService from '../../../services/secrets';
import type { SecretUsageLog, Secret } from '../../../services/secrets';

export function UsageLogsTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<SecretUsageLog[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedSecretId, setSelectedSecretId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.organization_id) {
      loadData();
    }
  }, [user?.organization_id, page, selectedSecretId]);

  const loadData = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const [logsResult, secretsResult] = await Promise.all([
        secretsService.getUsageLogs(
          user.organization_id,
          selectedSecretId || undefined,
          { page, limit: 50 }
        ),
        secrets.length === 0 ? secretsService.getSecrets(user.organization_id, {}, { limit: 100 }) : Promise.resolve({ data: secrets, pagination: { total: secrets.length } }),
      ]);

      setLogs(logsResult.data);
      setTotalCount(logsResult.pagination.total);
      if (secrets.length === 0) {
        setSecrets(secretsResult.data);
      }
    } catch (err) {
      console.error('Failed to load usage logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'read':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'write':
      case 'create':
        return <Pencil className="h-4 w-4 text-emerald-500" />;
      case 'delete':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'rotate':
        return <RefreshCw className="h-4 w-4 text-purple-500" />;
      case 'scan':
        return <Search className="h-4 w-4 text-amber-500" />;
      default:
        return <History className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActorIcon = (actorType: string) => {
    switch (actorType) {
      case 'user':
        return <User className="h-4 w-4 text-blue-500" />;
      case 'system':
        return <Server className="h-4 w-4 text-gray-500" />;
      case 'edge_function':
        return <Server className="h-4 w-4 text-emerald-500" />;
      case 'workflow':
        return <Workflow className="h-4 w-4 text-purple-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionBadge = (action: string) => {
    const styles: Record<string, string> = {
      read: 'bg-blue-100 text-blue-700',
      write: 'bg-emerald-100 text-emerald-700',
      create: 'bg-emerald-100 text-emerald-700',
      delete: 'bg-red-100 text-red-700',
      rotate: 'bg-purple-100 text-purple-700',
      scan: 'bg-amber-100 text-amber-700',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[action] || 'bg-gray-100 text-gray-700'}`}>
        {getActionIcon(action)}
        {action.charAt(0).toUpperCase() + action.slice(1)}
      </span>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(totalCount / 50);

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Usage Logs</h3>
          <p className="text-sm text-gray-500">Audit trail of all secret access and modifications</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSecretId}
            onChange={(e) => {
              setSelectedSecretId(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Secrets</option>
            {secrets.map(secret => (
              <option key={secret.id} value={secret.id}>{secret.name} ({secret.key})</option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <History className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">No activity logs</h3>
          <p className="mt-1 text-sm text-gray-500">
            {selectedSecretId ? 'No activity recorded for this secret' : 'Secret access and changes will appear here'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Secret
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatTimestamp(log.created_at)}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getActionBadge(log.action)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {log.secret_key ? (
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-gray-400" />
                        <code className="text-sm font-mono text-gray-700">{log.secret_key}</code>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getActorIcon(log.actor_type)}
                      <div>
                        <div className="text-sm text-gray-900">
                          {log.actor_name || log.actor_type}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {log.actor_type.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {log.context && Object.keys(log.context).length > 0 ? (
                      <div className="text-xs text-gray-500 max-w-xs truncate" title={JSON.stringify(log.context)}>
                        {Object.entries(log.context).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, totalCount)} of {totalCount}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
