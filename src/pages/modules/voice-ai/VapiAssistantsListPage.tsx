import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, MoreVertical, Eye, CreditCard as Edit, Copy, Upload, Archive, Phone, MessageSquare, Globe, Mic, Zap } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { listAssistants, archiveAssistant, duplicateAssistant, deleteAssistant } from '../../../services/vapiAssistants';
import type { VapiAssistant } from '../../../services/vapiAssistants';

const statusColors: Record<string, string> = {
  draft: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  archived: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const channelIcons: Record<string, typeof Phone> = {
  voice: Mic,
  sms: MessageSquare,
  webchat: Globe,
};

export function VapiAssistantsListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, hasPermission } = useAuth();
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const canCreate = hasPermission('ai_agents.voice.create');
  const canEdit = hasPermission('ai_agents.voice.edit');

  const loadAssistants = async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const data = await listAssistants(user.organization_id, {
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setAssistants(data);
    } catch (e) {
      console.error('Failed to load assistants:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssistants();
  }, [user?.organization_id, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(loadAssistants, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (searchParams.get('create') === 'true' && canCreate) {
      navigate('/ai-agents/voice/assistants/new');
    }
  }, [searchParams]);

  const handleDuplicate = async (id: string) => {
    if (!user?.id) return;
    try {
      const copy = await duplicateAssistant(id, user.id);
      navigate(`/ai-agents/voice/assistants/${copy.id}`);
    } catch (e) {
      console.error('Failed to duplicate:', e);
    }
    setMenuOpen(null);
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveAssistant(id);
      loadAssistants();
    } catch (e) {
      console.error('Failed to archive:', e);
    }
    setMenuOpen(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assistant? This cannot be undone.')) return;
    try {
      await deleteAssistant(id);
      loadAssistants();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
    setMenuOpen(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Voice Assistants</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Create and manage Vapi-powered assistants for voice, SMS, and web chat
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => navigate('/ai-agents/voice/assistants/new')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Assistant
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assistants..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-slate-700 rounded" />
                  <div className="h-3 w-48 bg-slate-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : assistants.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="p-4 bg-slate-700/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Mic className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No assistants yet</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
            Create your first Vapi assistant to handle voice calls, SMS conversations, or web chat interactions.
          </p>
          {canCreate && (
            <button
              onClick={() => navigate('/ai-agents/voice/assistants/new')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Assistant
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Channels</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Model</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Voice</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Bindings</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Updated</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {assistants.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/ai-agents/voice/assistants/${a.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-cyan-500/10 rounded-lg">
                        <Zap className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{a.name}</div>
                        <div className="text-xs text-slate-500">{a.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {(a.channel_modes || []).map((mode) => {
                        const Icon = channelIcons[mode] || Globe;
                        return (
                          <span
                            key={mode}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-700 text-slate-300 rounded"
                            title={mode}
                          >
                            <Icon className="w-3 h-3" />
                            {mode}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">{a.llm_model}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {a.voice_id ? `${a.voice_provider}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${statusColors[a.status] || statusColors.draft}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{a.bindings_count || 0}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(a.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block">
                      <button
                        onClick={() => setMenuOpen(menuOpen === a.id ? null : a.id)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {menuOpen === a.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                          <div className="absolute right-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                            <button
                              onClick={() => { navigate(`/ai-agents/voice/assistants/${a.id}`); setMenuOpen(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => { navigate(`/ai-agents/voice/assistants/${a.id}`); setMenuOpen(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                              >
                                <Edit className="w-3.5 h-3.5" /> Edit
                              </button>
                            )}
                            {canCreate && (
                              <button
                                onClick={() => handleDuplicate(a.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                              >
                                <Copy className="w-3.5 h-3.5" /> Duplicate
                              </button>
                            )}
                            {canEdit && a.status === 'draft' && (
                              <button
                                onClick={() => { navigate(`/ai-agents/voice/assistants/${a.id}?tab=publish`); setMenuOpen(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-cyan-400 hover:bg-slate-700"
                              >
                                <Upload className="w-3.5 h-3.5" /> Publish
                              </button>
                            )}
                            {canEdit && a.status !== 'archived' && (
                              <button
                                onClick={() => handleArchive(a.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-400 hover:bg-slate-700"
                              >
                                <Archive className="w-3.5 h-3.5" /> Archive
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleDelete(a.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
                              >
                                <Archive className="w-3.5 h-3.5" /> Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
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
