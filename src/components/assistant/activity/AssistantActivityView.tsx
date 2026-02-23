import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Filter,
  Mail,
  Calendar,
  Users,
  BarChart3,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getActionLogs } from '../../../services/assistantActions';
import type { AssistantActionLog, ActionExecutionStatus } from '../../../types/assistant';

const MODULE_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  calendar: Calendar,
  contacts: Users,
  opportunities: BarChart3,
  proposals: FileText,
};

const STATUS_CONFIG: Record<ActionExecutionStatus, { icon: typeof CheckCircle; color: string; label: string }> = {
  success: { icon: CheckCircle, color: 'text-emerald-400', label: 'Success' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
  running: { icon: Loader2, color: 'text-cyan-400', label: 'Running' },
  queued: { icon: Clock, color: 'text-amber-400', label: 'Queued' },
  canceled: { icon: XCircle, color: 'text-slate-500', label: 'Canceled' },
};

export function AssistantActivityView() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AssistantActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getActionLogs(user.id, { targetModule: moduleFilter, limit: 50 })
      .then(({ data }) => setLogs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, moduleFilter]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/40">
        <span className="text-[11px] text-slate-400 font-medium">
          {logs.length} action{logs.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-1 rounded text-slate-500 hover:text-slate-300 transition-colors ${showFilters ? 'bg-slate-800 text-slate-300' : ''}`}
        >
          <Filter className="w-3.5 h-3.5" />
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-1.5 px-3 py-2 border-b border-slate-700/40 flex-wrap">
          {['all', 'email', 'calendar', 'contacts', 'opportunities', 'proposals'].map((mod) => (
            <button
              key={mod}
              onClick={() => setModuleFilter(mod)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                moduleFilter === mod
                  ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'
              }`}
            >
              {mod === 'all' ? 'All' : mod.charAt(0).toUpperCase() + mod.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <Clock className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs text-slate-500">No actions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {logs.map((log) => (
              <ActionLogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionLogRow({ log }: { log: AssistantActionLog }) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[log.execution_status] || STATUS_CONFIG.success;
  const StatusIcon = config.icon;
  const ModIcon = MODULE_ICONS[log.target_module] || FileText;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 text-left"
      >
        <div className="mt-0.5 flex-shrink-0">
          <StatusIcon
            className={`w-3.5 h-3.5 ${config.color} ${log.execution_status === 'running' ? 'animate-spin' : ''}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <ModIcon className="w-3 h-3 text-slate-500 flex-shrink-0" />
            <span className="text-[11px] text-slate-300 font-medium truncate">
              {log.action_type}
            </span>
          </div>
          {log.input_summary && (
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{log.input_summary}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[9px] text-slate-600">{formatTime(log.created_at)}</span>
          {expanded ? (
            <ChevronUp className="w-3 h-3 text-slate-600" />
          ) : (
            <ChevronDown className="w-3 h-3 text-slate-600" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-2 ml-5.5 space-y-1.5">
          {log.output_summary && (
            <div className="px-2 py-1.5 bg-slate-800/50 rounded text-[10px] text-slate-400">
              {log.output_summary}
            </div>
          )}
          {log.error_message && (
            <div className="px-2 py-1.5 bg-red-500/5 border border-red-500/10 rounded text-[10px] text-red-400">
              {log.error_message}
            </div>
          )}
          <div className="flex items-center gap-3 text-[9px] text-slate-600">
            {log.execution_time_ms != null && (
              <span>{log.execution_time_ms}ms</span>
            )}
            <span className={config.color}>{config.label}</span>
            {log.confirmed_by_user != null && (
              <span>{log.confirmed_by_user ? 'User approved' : 'User rejected'}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
