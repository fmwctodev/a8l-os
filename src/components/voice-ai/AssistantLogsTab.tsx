import { useState, useEffect } from 'react';
import {
  PhoneCall, PhoneOutgoing, PhoneIncoming, Filter,
  Clock, AlertCircle, CheckCircle, ChevronLeft, ChevronRight,
  Play, FileText, X, Loader2, RefreshCw,
} from 'lucide-react';
import { fetchEdge } from '../../lib/edgeFunction';

// Vapi call shape from their API
interface VapiCallLog {
  id: string;
  assistantId: string;
  type: string; // 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall' | 'vapiCall'
  status: string; // 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended'
  endedReason?: string;
  phoneNumber?: { number: string };
  customer?: { number: string; name?: string };
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
  cost?: number;
  costBreakdown?: Record<string, unknown>;
  transcript?: string;
  summary?: string;
  analysis?: Record<string, unknown>;
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  messages?: Array<{ role: string; message: string; time: number }>;
}

const statusIcons: Record<string, typeof CheckCircle> = {
  ended: CheckCircle,
  failed: AlertCircle,
  'in-progress': Play,
  queued: Clock,
  ringing: Clock,
  forwarding: Play,
};

const statusColors: Record<string, string> = {
  ended: 'text-emerald-400',
  failed: 'text-red-400',
  'in-progress': 'text-cyan-400',
  queued: 'text-amber-400',
  ringing: 'text-amber-400',
  forwarding: 'text-cyan-400',
};

function formatDuration(startedAt?: string, endedAt?: string): string {
  if (!startedAt || !endedAt) return '-';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.round(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getDirection(type: string): 'inbound' | 'outbound' | 'web' {
  if (type === 'inboundPhoneCall') return 'inbound';
  if (type === 'outboundPhoneCall') return 'outbound';
  return 'web';
}

interface Props {
  vapiAssistantId: string;
  orgId: string;
}

export function AssistantLogsTab({ vapiAssistantId, orgId }: Props) {
  const [calls, setCalls] = useState<VapiCallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<VapiCallLog | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  async function loadCalls() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEdge('vapi-client', {
        body: {
          action: 'list_calls',
          assistantId: vapiAssistantId,
          limit: 100,
        },
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error?.message || result.error || 'Failed to load calls');
        setCalls([]);
      } else {
        const data = result.data ?? result;
        setCalls(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(String(err));
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCalls();
  }, [vapiAssistantId]);

  // Client-side filtering
  const filteredCalls = calls.filter((call) => {
    if (statusFilter !== 'all' && call.status !== statusFilter) return false;
    if (typeFilter !== 'all') {
      const dir = getDirection(call.type);
      if (typeFilter !== dir) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">All Types</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="web">Web Call</option>
          </select>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="all">All Status</option>
          <option value="ended">Ended</option>
          <option value="in-progress">In Progress</option>
          <option value="queued">Queued</option>
          <option value="ringing">Ringing</option>
        </select>
        <button
          onClick={loadCalls}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <span className="text-xs text-slate-500 ml-auto">{filteredCalls.length} call{filteredCalls.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        </div>
      ) : filteredCalls.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="p-4 bg-slate-700/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <PhoneCall className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No call logs yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Call logs will appear here once this assistant starts receiving or making calls via Vapi.
          </p>
        </div>
      ) : (
        /* Call log table */
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Phone / Customer</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Duration</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Cost</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Date</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredCalls.map((call) => {
                const dir = getDirection(call.type);
                const StatusIcon = statusIcons[call.status] || Clock;
                const statusColor = statusColors[call.status] || 'text-slate-400';

                return (
                  <tr key={call.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {dir === 'inbound' ? (
                          <PhoneIncoming className="w-4 h-4 text-emerald-400" />
                        ) : dir === 'outbound' ? (
                          <PhoneOutgoing className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <PhoneCall className="w-4 h-4 text-violet-400" />
                        )}
                        <span className="text-sm text-slate-300 capitalize">{dir}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white font-mono">{call.phoneNumber?.number || call.customer?.number || '-'}</div>
                      {call.customer?.name && (
                        <div className="text-xs text-slate-500">{call.customer.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
                        <span className={`text-sm capitalize ${statusColor}`}>{call.status}</span>
                      </div>
                      {call.endedReason && (
                        <div className="text-xs text-slate-500 mt-0.5">{call.endedReason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                      {formatDuration(call.startedAt, call.endedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {call.cost != null ? `$${call.cost.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(call.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(call.transcript || call.summary || call.messages?.length) ? (
                        <button
                          onClick={() => setSelectedCall(call)}
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
      )}

      {/* Call detail modal */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCall(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-white">Call Details</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {getDirection(selectedCall.type)} call on {new Date(selectedCall.createdAt).toLocaleString()}
                  {selectedCall.cost != null && ` — $${selectedCall.cost.toFixed(2)}`}
                </p>
              </div>
              <button onClick={() => setSelectedCall(null)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedCall.summary && (
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <p className="text-xs font-medium text-cyan-400 mb-1">Summary</p>
                  <p className="text-sm text-slate-300">{selectedCall.summary}</p>
                </div>
              )}

              {selectedCall.endedReason && (
                <div className="p-3 bg-slate-800 border border-slate-700 rounded-lg">
                  <p className="text-xs font-medium text-slate-400 mb-1">Ended Reason</p>
                  <p className="text-sm text-slate-300">{selectedCall.endedReason}</p>
                </div>
              )}

              {selectedCall.messages && selectedCall.messages.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-2">Conversation</p>
                  <div className="space-y-2">
                    {selectedCall.messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-lg text-sm ${
                          msg.role === 'assistant'
                            ? 'bg-cyan-500/10 border border-cyan-500/20 text-slate-300'
                            : msg.role === 'user'
                            ? 'bg-slate-800 border border-slate-700 text-slate-300'
                            : 'bg-slate-800/50 text-slate-500 text-xs italic'
                        }`}
                      >
                        <span className="text-xs font-medium text-slate-500 uppercase mr-2">{msg.role}</span>
                        {msg.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedCall.transcript && !selectedCall.messages?.length && (
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-2">Transcript</p>
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {selectedCall.transcript}
                  </pre>
                </div>
              )}

              {selectedCall.recordingUrl && (
                <div className="p-3 bg-slate-800 border border-slate-700 rounded-lg">
                  <p className="text-xs font-medium text-slate-400 mb-2">Recording</p>
                  <audio controls className="w-full" src={selectedCall.recordingUrl}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {selectedCall.analysis && Object.keys(selectedCall.analysis).length > 0 && (
                <div className="p-3 bg-slate-800 border border-slate-700 rounded-lg">
                  <p className="text-xs font-medium text-slate-400 mb-2">Analysis</p>
                  <pre className="text-xs text-slate-400 whitespace-pre-wrap">
                    {JSON.stringify(selectedCall.analysis, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
