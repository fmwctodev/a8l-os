import { useState, useEffect } from 'react';
import { Plus, Search, FileText, Phone, Mail, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getSnippets, deleteSnippet, toggleSnippetStatus } from '../../../services/snippets';
import { SnippetEditorDrawer } from '../../conversations/SnippetEditorDrawer';
import type { Snippet, SnippetScope, MessageChannel } from '../../../types';

export function SnippetsSettingsTab() {
  const { user, hasPermission } = useAuth();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<SnippetScope | ''>('');
  const [channelFilter, setChannelFilter] = useState<MessageChannel | ''>('');
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const canManage = hasPermission('snippets.manage');
  const canManageSystem = hasPermission('snippets.system.manage');

  useEffect(() => {
    loadSnippets();
  }, [user]);

  async function loadSnippets() {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getSnippets(user.organization_id);
      setSnippets(data);
    } catch (error) {
      console.error('Failed to load snippets:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredSnippets = snippets.filter((s) => {
    if (scopeFilter && s.scope !== scopeFilter) return false;
    if (channelFilter && !s.channel_support.includes(channelFilter)) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      if (!s.name.toLowerCase().includes(searchLower) && !s.content.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    return true;
  });

  const handleToggleStatus = async (snippet: Snippet) => {
    try {
      const updated = await toggleSnippetStatus(snippet.id, !snippet.is_enabled);
      setSnippets(snippets.map((s) => (s.id === updated.id ? updated : s)));
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSnippet(id);
      setSnippets(snippets.filter((s) => s.id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete snippet:', error);
    }
  };

  const handleSave = (snippet: Snippet) => {
    if (editingSnippet) {
      setSnippets(snippets.map((s) => (s.id === snippet.id ? snippet : s)));
    } else {
      setSnippets([snippet, ...snippets]);
    }
    setShowEditor(false);
    setEditingSnippet(null);
  };

  const canEditSnippet = (snippet: Snippet) => {
    if (snippet.scope === 'system') return canManageSystem;
    if (snippet.scope === 'team') return canManage;
    return snippet.created_by_user_id === user?.id || canManage;
  };

  const getScopeBadgeStyle = (scope: SnippetScope) => {
    switch (scope) {
      case 'personal':
        return 'bg-slate-700 text-slate-300';
      case 'team':
        return 'bg-blue-500/10 text-blue-400';
      case 'system':
        return 'bg-purple-500/10 text-purple-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Snippets</h2>
          <p className="text-sm text-slate-400 mt-1">
            Create reusable message templates for quick responses
          </p>
        </div>
        <button
          onClick={() => {
            setEditingSnippet(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-colors"
        >
          <Plus size={18} />
          Create Snippet
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search snippets..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as SnippetScope | '')}
          className="px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">All Scopes</option>
          <option value="personal">Personal</option>
          <option value="team">Team</option>
          <option value="system">System</option>
        </select>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as MessageChannel | '')}
          className="px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">All Channels</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </select>
      </div>

      {filteredSnippets.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 rounded-lg border border-slate-700">
          <FileText size={48} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {search || scopeFilter || channelFilter ? 'No matching snippets' : 'No snippets yet'}
          </h3>
          <p className="text-slate-400 mb-4">
            {search || scopeFilter || channelFilter
              ? 'Try adjusting your filters'
              : 'Create your first snippet to speed up responses'}
          </p>
          {!search && !scopeFilter && !channelFilter && (
            <button
              onClick={() => {
                setEditingSnippet(null);
                setShowEditor(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
            >
              <Plus size={18} />
              Create Snippet
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Channels
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredSnippets.map((snippet) => (
                <tr key={snippet.id} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{snippet.name}</div>
                    <div className="text-xs text-slate-400 truncate max-w-xs">{snippet.content}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${getScopeBadgeStyle(snippet.scope)}`}>
                      {snippet.scope}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {snippet.channel_support.includes('sms') && (
                        <Phone size={14} className="text-slate-400" />
                      )}
                      {snippet.channel_support.includes('email') && (
                        <Mail size={14} className="text-slate-400" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {snippet.created_by_user?.name || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleStatus(snippet)}
                      disabled={!canEditSnippet(snippet)}
                      className="disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {snippet.is_enabled ? (
                        <ToggleRight size={24} className="text-green-500" />
                      ) : (
                        <ToggleLeft size={24} className="text-slate-500" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canEditSnippet(snippet) && (
                        <>
                          <button
                            onClick={() => {
                              setEditingSnippet(snippet);
                              setShowEditor(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white transition-colors"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(snippet.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
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

      {showEditor && (
        <SnippetEditorDrawer
          snippet={editingSnippet}
          onClose={() => {
            setShowEditor(false);
            setEditingSnippet(null);
          }}
          onSave={handleSave}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Snippet</h3>
            <p className="text-slate-400 mb-6">
              Are you sure you want to delete this snippet? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
