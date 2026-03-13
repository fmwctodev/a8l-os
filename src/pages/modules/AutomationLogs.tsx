import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';

interface LogEntry {
  id: string;
  org_id: string;
  enrollment_id: string;
  node_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
  enrollment?: {
    id: string;
    workflow_id: string;
    status: string;
    contact?: { id: string; first_name: string; last_name: string };
    workflow?: { id: string; name: string };
  };
}

type EventFilter = 'all' | 'node_started' | 'node_completed' | 'node_failed' | 'action_executed';

export default function AutomationLogs() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const orgId = organization?.id || '';

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [search, setSearch] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const perPage = 50;

  const loadLogs = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('workflow_execution_logs')
        .select(`
          *,
          enrollment:workflow_enrollments!enrollment_id(
            id, workflow_id, status,
            contact:contacts!contact_id(id, first_name, last_name),
            workflow:workflows!workflow_id(id, name)
          )
        `, { count: 'exact' })
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (eventFilter !== 'all') {
        query = query.eq('event_type', eventFilter);
      }

      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      setLogs((data ?? []) as LogEntry[]);
      setTotalCount(count ?? 0);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, page, eventFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const totalPages = Math.ceil(totalCount / perPage);

  const eventStyles: Record<string, { icon: typeof Activity; color: string; bg: string }> = {
    node_started: { icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    node_completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    node_failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
    action_executed: { icon: CheckCircle, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    enrollment_started: { icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    enrollment_completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  };

  const filterOptions: { key: EventFilter; label: string }[] = [
    { key: 'all', label: 'All Events' },
    { key: 'node_started', label: 'Node Started' },
    { key: 'node_completed', label: 'Node Completed' },
    { key: 'node_failed', label: 'Node Failed' },
    { key: 'action_executed', label: 'Action Executed' },
  ];

  function getNodeLabel(log: LogEntry): string {
    const payload = log.payload || {};
    const nodeType = payload.node_type as string;
    const actionType = payload.action_type as string;
    if (actionType) return actionType.replace(/_/g, ' ');
    if (nodeType) return nodeType;
    return log.node_id?.substring(0, 8) || 'unknown';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Execution Logs</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time execution logs across all workflows
          </p>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {totalCount.toLocaleString()} total entries
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {filterOptions.find(f => f.key === eventFilter)?.label}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showFilterDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
              <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 py-1">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setEventFilter(opt.key); setShowFilterDropdown(false); setPage(1); }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      eventFilter === opt.key ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Activity className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No logs yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Logs will appear here as workflows execute</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Timestamp</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Event</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Node</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Workflow</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Contact</th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Duration</th>
                    <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {logs.map((log) => {
                    const style = eventStyles[log.event_type] || { icon: Activity, color: 'text-gray-400', bg: 'bg-gray-500/10' };
                    const Icon = style.icon;
                    return (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            {new Date(log.created_at).toLocaleString(undefined, {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.color}`}>
                            <Icon className="w-3 h-3" />
                            {log.event_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                            {getNodeLabel(log)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {log.enrollment?.workflow?.name || '--'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {log.enrollment?.contact
                              ? `${log.enrollment.contact.first_name} ${log.enrollment.contact.last_name}`
                              : '--'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {log.duration_ms != null ? (
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {log.duration_ms < 1000 ? `${log.duration_ms}ms` : `${(log.duration_ms / 1000).toFixed(1)}s`}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">--</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {log.enrollment?.workflow_id && (
                            <button
                              onClick={() => navigate(`/automation/${log.enrollment!.workflow_id}/runs/${log.enrollment_id}`)}
                              className="p-1 text-gray-400 hover:text-blue-500 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="View run detail"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
