import { useState, useEffect } from 'react';
import {
  Plus, Globe, Copy, Trash2, MoreVertical, Code, Eye,
  Check, ExternalLink, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  listWidgets, createWidget, updateWidget, deleteWidget, generateEmbedSnippet,
} from '../../../services/vapiWidgets';
import type { VapiWidget, CreateWidgetInput } from '../../../services/vapiWidgets';
import { listAssistants } from '../../../services/vapiAssistants';
import type { VapiAssistant } from '../../../services/vapiAssistants';

export function VapiWidgetsPage() {
  const { user, hasPermission } = useAuth();
  const [widgets, setWidgets] = useState<VapiWidget[]>([]);
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEmbed, setShowEmbed] = useState<VapiWidget | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canCreate = hasPermission('ai_agents.voice.create');
  const canEdit = hasPermission('ai_agents.voice.edit');

  const [form, setForm] = useState<CreateWidgetInput>({
    name: '',
    assistant_id: '',
    mode: 'hybrid',
    theme_primary_color: '#0ea5e9',
    theme_text_color: '#ffffff',
    position: 'bottom-right',
    welcome_text: 'Hi! How can I help you today?',
  });

  const loadData = async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const [w, a] = await Promise.all([
        listWidgets(user.organization_id),
        listAssistants(user.organization_id, { status: 'published' }),
      ]);
      setWidgets(w);
      setAssistants(a);
    } catch (e) {
      console.error('Failed to load widgets:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.organization_id]);

  const handleCreate = async () => {
    if (!user?.organization_id || !form.name || !form.assistant_id) return;
    try {
      await createWidget(user.organization_id, form, '');
      setShowCreate(false);
      setForm({
        name: '', assistant_id: '', mode: 'hybrid',
        theme_primary_color: '#0ea5e9', theme_text_color: '#ffffff',
        position: 'bottom-right', welcome_text: 'Hi! How can I help you today?',
      });
      loadData();
    } catch (e) {
      console.error('Failed to create widget:', e);
    }
  };

  const handleToggle = async (w: VapiWidget) => {
    try {
      await updateWidget(w.id, { active: w.status !== 'active' });
      loadData();
    } catch (e) {
      console.error('Failed to toggle widget:', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this widget?')) return;
    try {
      await deleteWidget(id);
      loadData();
    } catch (e) {
      console.error('Failed to delete widget:', e);
    }
    setMenuOpen(null);
  };

  const copySnippet = (w: VapiWidget) => {
    navigator.clipboard.writeText(generateEmbedSnippet(w));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Web Widgets</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Deploy voice and chat widgets on your website
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Widget
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5 animate-pulse">
              <div className="h-5 w-32 bg-slate-700 rounded mb-3" />
              <div className="h-4 w-48 bg-slate-700 rounded mb-4" />
              <div className="h-8 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : widgets.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="p-4 bg-slate-700/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Globe className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No widgets yet</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
            Create a web widget to embed a voice or chat assistant on your website.
          </p>
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Widget
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.map((w) => {
            const meta = w.metadata || {};
            return (
              <div key={w.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${meta.theme_primary_color || '#0ea5e9'}20` }}>
                      <Globe className="w-5 h-5" style={{ color: meta.theme_primary_color || '#0ea5e9' }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{w.display_name}</h3>
                      <p className="text-xs text-slate-500">{w.assistant?.name || 'Unlinked'}</p>
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === w.id ? null : w.id)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen === w.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                          <button
                            onClick={() => { setShowEmbed(w); setMenuOpen(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                          >
                            <Code className="w-3.5 h-3.5" /> Embed Code
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleDelete(w.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-slate-700 text-slate-300 rounded">
                    {meta.mode || 'hybrid'}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-slate-700 text-slate-300 rounded">
                    {meta.position || 'bottom-right'}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                    w.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                  }`}>
                    {w.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-700/50">
                  <button
                    onClick={() => setShowEmbed(w)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg transition-colors"
                  >
                    <Code className="w-3.5 h-3.5" /> Embed
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleToggle(w)}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      {w.status === 'active' ? (
                        <><ToggleRight className="w-3.5 h-3.5 text-emerald-400" /> Active</>
                      ) : (
                        <><ToggleLeft className="w-3.5 h-3.5" /> Inactive</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="text-base font-semibold text-white">Create Widget</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white text-lg">&times;</button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Widget Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="My Support Widget"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Published Assistant</label>
                <select
                  value={form.assistant_id}
                  onChange={(e) => setForm({ ...form, assistant_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Select assistant...</option>
                  {assistants.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Mode</label>
                <div className="flex gap-2">
                  {(['chat', 'voice', 'hybrid'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setForm({ ...form, mode })}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        form.mode === mode
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.theme_primary_color}
                      onChange={(e) => setForm({ ...form, theme_primary_color: e.target.value })}
                      className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                    />
                    <input
                      value={form.theme_primary_color}
                      onChange={(e) => setForm({ ...form, theme_primary_color: e.target.value })}
                      className="flex-1 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Position</label>
                  <select
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value as 'bottom-right' | 'bottom-left' })}
                    className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Welcome Text</label>
                <input
                  value={form.welcome_text}
                  onChange={(e) => setForm({ ...form, welcome_text: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Hi! How can I help?"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-slate-700">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.name || !form.assistant_id}
                className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Widget
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmbed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="text-base font-semibold text-white">Embed Code - {showEmbed.display_name}</h3>
              <button onClick={() => setShowEmbed(null)} className="text-slate-400 hover:text-white text-lg">&times;</button>
            </div>

            <div className="p-5">
              <p className="text-sm text-slate-400 mb-3">
                Copy and paste this code snippet into your website's HTML, just before the closing &lt;/body&gt; tag.
              </p>
              <div className="relative">
                <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono">
                  {generateEmbedSnippet(showEmbed)}
                </pre>
                <button
                  onClick={() => copySnippet(showEmbed)}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
                >
                  {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
            </div>

            <div className="flex justify-end p-5 border-t border-slate-700">
              <button
                onClick={() => setShowEmbed(null)}
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
