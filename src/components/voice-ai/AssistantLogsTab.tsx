import { useState, useEffect } from 'react';
import {
  PhoneCall, PhoneOutgoing, PhoneIncoming, Filter,
  Clock, AlertCircle, CheckCircle, ChevronLeft, ChevronRight,
  Play, FileText, X,
} from 'lucide-react';
import { listCalls } from '../../services/vapiCalls';
import type { VapiCall, CallFilters } from '../../services/vapiCalls';

const statusIcons: Record<string, typeof CheckCircle> = {
  completed: CheckCircle,
  failed: AlertCircle,
  'in-progress': Play,
  queued: Clock,
};

const statusColors: Record<string, string> = {
  completed: 'text-emerald-400',
  failed: 'text-red-400',
  'in-progress': 'text-cyan-400',
  queued: 'text-amber-400',
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  assistantId: string;
  orgId: string;
}

export function AssistantLogsTab({ assistantId, orgId }: Props) {
  const [calls, setCalls] = useState<VapiCall[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CallFilters>({});
  const [selectedTranscript, setSelectedTranscript] = useState<VapiCall | null>(null);
  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCalls(orgId, { ...filters, assistant_id: assistantId }, page, pageSize)
      .then(({ data, count }) => {
        if (!cancelled) {
          setCalls(data);
          setTotal(count);
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId, assistantId, page, filters]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filters.direction || 'all'}
            onChange={(e) => { setFilters({ ...filters, direction: e.target.value }); setPage(1); }}
            className="text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </div>
        <select
          value={filters.status || 'all'}
          onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
          className="text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="in-progress">In Progress</option>
          <option value="queued">Queued</option>
          <option value="failed">Failed</option>
        </select>
        <span className="text-xs text-slate-500 ml-auto">{total} call{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-slate-700 rounded" />
                  <div className="h-3 w-56 bg-slate-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : calls.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="p-4 bg-slate-700/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <PhoneCall className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No call logs yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Call logs will appear here once this assistant starts receiving or making calls.
          </p>
        </div>
      ) : (
        /* Call log table */
        <>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Direction</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">From / To</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Duration</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Date</th>
                  <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Transcript</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {calls.map((call) => {
                  const StatusIcon = statusIcons[call.status] || Clock;
                  const statusColor = statusColors[call.status] || 'text-slate-400';

                  return (
                    <tr key={call.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {call.direction === 'inbound' ? (
                            <PhoneIncoming className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <PhoneOutgoing className="w-4 h-4 text-cyan-400" />
                          )}
                          <span className="text-sm text-slate-300 capitalize">{call.direction}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-white font-mono">{call.from_number || '-'}</div>
                        <div className="text-xs text-slate-500 font-mono">{call.to_number || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
                          <span className={`text-sm capitalize ${statusColor}`}>{call.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                        {formatDuration(call.duration_seconds)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(call.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {call.transcript ? (
                          <button
                            onClick={() => setSelectedTranscript(call)}
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            <FileText className="w-4 h-4 inline-block" />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-slate-400">
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-400"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-400"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Transcript modal */}
      {selectedTranscript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTranscript(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-white">Call Transcript</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedTranscript.direction} call on {new Date(selectedTranscript.created_at).toLocaleString()}
                  {selectedTranscript.duration_seconds ? ` — ${formatDuration(selectedTranscript.duration_seconds)}` : ''}
                </p>
              </div>
              <button onClick={() => setSelectedTranscript(null)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {selectedTranscript.summary && (
                <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <p className="text-xs font-medium text-cyan-400 mb-1">Summary</p>
                  <p className="text-sm text-slate-300">{selectedTranscript.summary}</p>
                </div>
              )}
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                {selectedTranscript.transcript}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
