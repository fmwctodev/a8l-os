import { useState, useEffect } from 'react';
import {
  MessageCircle, MessageSquare, Globe, Filter, Clock,
  AlertCircle, CheckCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { listSessions } from '../../../services/vapiCalls';
import type { VapiSession, SessionFilters } from '../../../services/vapiCalls';

const channelConfig: Record<string, { icon: typeof Globe; color: string; label: string }> = {
  sms: { icon: MessageSquare, color: 'text-emerald-400', label: 'SMS' },
  webchat: { icon: Globe, color: 'text-cyan-400', label: 'Web Chat' },
};

const statusIcons: Record<string, typeof CheckCircle> = {
  completed: CheckCircle,
  active: Clock,
  failed: AlertCircle,
};

const statusColors: Record<string, string> = {
  completed: 'text-emerald-400',
  active: 'text-cyan-400',
  failed: 'text-red-400',
};

function formatTimestamp(ts: string | null): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

export function VapiSessionsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<VapiSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SessionFilters>({});

  const loadSessions = async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const result = await listSessions(user.organization_id, filters, page);
      setSessions(result.data);
      setTotal(result.count);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [user?.organization_id, page, filters]);

  const totalPages = Math.ceil(total / 25);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Sessions</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            SMS and web chat sessions with your assistants
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filters.channel || 'all'}
            onChange={(e) => { setFilters({ ...filters, channel: e.target.value }); setPage(1); }}
            className="text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">All Channels</option>
            <option value="sms">SMS</option>
            <option value="webchat">Web Chat</option>
          </select>
        </div>
        <select
          value={filters.status || 'all'}
          onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
          className="text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 bg-slate-700 rounded" />
                  <div className="h-3 w-48 bg-slate-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="p-4 bg-slate-700/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No sessions yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            SMS and web chat sessions will appear here once users start interacting with your assistants.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Channel</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">User</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Assistant</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Started</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Ended</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sessions.map((session) => {
                  const ch = channelConfig[session.channel] || channelConfig.webchat;
                  const ChannelIcon = ch.icon;
                  const StatusIcon = statusIcons[session.status] || Clock;
                  const stColor = statusColors[session.status] || 'text-slate-400';

                  return (
                    <tr key={session.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ChannelIcon className={`w-4 h-4 ${ch.color}`} />
                          <span className="text-sm text-slate-300">{ch.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 font-mono">
                        {session.external_user_id || 'Anonymous'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {session.assistant?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={`w-3.5 h-3.5 ${stColor}`} />
                          <span className={`text-sm ${stColor}`}>{session.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatTimestamp(session.started_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatTimestamp(session.ended_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-500">{total} total sessions</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
