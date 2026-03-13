import { useState, useEffect } from 'react';
import {
  PhoneCall, PhoneOutgoing, PhoneIncoming, Search, Filter,
  Clock, AlertCircle, CheckCircle, ChevronLeft, ChevronRight,
  Phone, X, Play,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { listCalls, createOutboundCall } from '../../../services/vapiCalls';
import type { VapiCall, CallFilters } from '../../../services/vapiCalls';
import { listAssistants } from '../../../services/vapiAssistants';
import type { VapiAssistant } from '../../../services/vapiAssistants';
import { listNumbers } from '../../../services/vapiNumbers';
import type { VapiBinding } from '../../../services/vapiNumbers';

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

export function VapiCallsPage() {
  const { user, hasPermission } = useAuth();
  const [calls, setCalls] = useState<VapiCall[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CallFilters>({});
  const [showOutbound, setShowOutbound] = useState(false);
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [numbers, setNumbers] = useState<VapiBinding[]>([]);
  const [selectedTranscript, setSelectedTranscript] = useState<VapiCall | null>(null);

  const canCall = hasPermission('ai_agents.voice.call');

  const [outboundForm, setOutboundForm] = useState({
    assistantId: '',
    numberBindingId: '',
    toNumber: '',
  });
  const [calling, setCalling] = useState(false);

  const loadCalls = async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const result = await listCalls(user.organization_id, filters, page);
      setCalls(result.data);
      setTotal(result.count);
    } catch (e) {
      console.error('Failed to load calls:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalls();
  }, [user?.organization_id, page, filters]);

  const openOutbound = async () => {
    if (!user?.organization_id) return;
    try {
      const [a, n] = await Promise.all([
        listAssistants(user.organization_id, { status: 'published' }),
        listNumbers(user.organization_id),
      ]);
      setAssistants(a);
      setNumbers(n.filter(b => b.status === 'active' && b.binding_type === 'voice_number'));
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    setShowOutbound(true);
  };

  const handleOutbound = async () => {
    if (!user?.organization_id || !outboundForm.assistantId || !outboundForm.numberBindingId || !outboundForm.toNumber) return;
    setCalling(true);
    try {
      await createOutboundCall(
        user.organization_id,
        outboundForm.assistantId,
        outboundForm.numberBindingId,
        outboundForm.toNumber,
      );
      setShowOutbound(false);
      setOutboundForm({ assistantId: '', numberBindingId: '', toNumber: '' });
      loadCalls();
    } catch (e) {
      console.error('Failed to create call:', e);
      alert(e instanceof Error ? e.message : 'Failed to create outbound call');
    } finally {
      setCalling(false);
    }
  };

  const totalPages = Math.ceil(total / 25);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Call Logs</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            View call history and initiate outbound calls
          </p>
        </div>
        {canCall && (
          <button
            onClick={openOutbound}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
          >
            <PhoneOutgoing className="w-4 h-4" />
            Outbound Call
          </button>
        )}
      </div>

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
      </div>

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
        <div className="text-center py-16 bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="p-4 bg-slate-700/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <PhoneCall className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No calls yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Calls will appear here once your assistants start receiving or making calls.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Direction</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">From / To</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Assistant</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Duration</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Date</th>
                  <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Actions</th>
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
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {call.assistant?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
                          <span className={`text-sm ${statusColor}`}>{call.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                        {formatDuration(call.duration_seconds)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(call.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {call.transcript && (
                          <button
                            onClick={() => setSelectedTranscript(call)}
                            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            View Transcript
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-500">{total} total calls</p>
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

      {showOutbound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="text-base font-semibold text-white">New Outbound Call</h3>
              <button onClick={() => setShowOutbound(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Assistant</label>
                <select
                  value={outboundForm.assistantId}
                  onChange={(e) => setOutboundForm({ ...outboundForm, assistantId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Select published assistant...</option>
                  {assistants.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">From Number</label>
                <select
                  value={outboundForm.numberBindingId}
                  onChange={(e) => setOutboundForm({ ...outboundForm, numberBindingId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Select phone number...</option>
                  {numbers.map(n => (
                    <option key={n.id} value={n.id}>{n.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">To Number</label>
                <input
                  value={outboundForm.toNumber}
                  onChange={(e) => setOutboundForm({ ...outboundForm, toNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  placeholder="+1234567890"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-700">
              <button
                onClick={() => setShowOutbound(false)}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleOutbound}
                disabled={!outboundForm.assistantId || !outboundForm.numberBindingId || !outboundForm.toNumber || calling}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Phone className="w-4 h-4" />
                {calling ? 'Calling...' : 'Start Call'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTranscript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div>
                <h3 className="text-base font-semibold text-white">Call Transcript</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedTranscript.from_number} &rarr; {selectedTranscript.to_number}
                </p>
              </div>
              <button onClick={() => setSelectedTranscript(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {selectedTranscript.summary && (
                <div className="mb-4 p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <p className="text-xs font-medium text-slate-400 mb-1">Summary</p>
                  <p className="text-sm text-slate-300">{selectedTranscript.summary}</p>
                </div>
              )}
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                {selectedTranscript.transcript}
              </pre>
            </div>
            <div className="flex justify-end p-5 border-t border-slate-700">
              <button
                onClick={() => setSelectedTranscript(null)}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
