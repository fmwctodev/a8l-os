import { useState, useEffect } from 'react';
import {
  X,
  Bell,
  BellOff,
  Trash2,
  Plus,
  Loader2,
  Clock,
  Search,
} from 'lucide-react';
import {
  getSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  toggleSavedSearchAlert,
  type GovSavedSearch,
  type SamSearchFilters,
} from '../../services/samGov';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: SamSearchFilters;
}

export function SavedSearchPanel({ isOpen, onClose, currentFilters }: Props) {
  const [searches, setSearches] = useState<GovSavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) loadSearches();
  }, [isOpen]);

  async function loadSearches() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSavedSearches();
      setSearches(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load saved searches');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createSavedSearch(newName.trim(), currentFilters, frequency);
      setSearches((prev) => [created, ...prev]);
      setNewName('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save search');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteSavedSearch(id);
      setSearches((prev) => prev.filter((s) => s.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleAlert(id: string, enabled: boolean) {
    try {
      await toggleSavedSearchAlert(id, enabled);
      setSearches((prev) =>
        prev.map((s) => (s.id === id ? { ...s, alert_enabled: enabled } : s))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update alert');
    }
  }

  function summarizeFilters(criteria: SamSearchFilters): string {
    const parts: string[] = [];
    if (criteria.keywords) parts.push(`"${criteria.keywords}"`);
    if (criteria.naicsCode) parts.push(`NAICS: ${criteria.naicsCode}`);
    if (criteria.setAsideType) parts.push(`Set-Aside: ${criteria.setAsideType}`);
    if (criteria.state) parts.push(`State: ${criteria.state}`);
    if (criteria.agencyName) parts.push(`Agency: ${criteria.agencyName}`);
    if (criteria.postedFrom || criteria.postedTo) {
      parts.push(`${criteria.postedFrom || '...'} - ${criteria.postedTo || '...'}`);
    }
    return parts.length > 0 ? parts.join(' | ') : 'No filters';
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-700 shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Saved Searches</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Search Form */}
        <div className="px-5 py-4 border-b border-slate-700 space-y-3">
          <p className="text-sm text-slate-400">Save the current search filters for quick access and alerts.</p>
          <input
            type="text"
            placeholder="Search name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <div className="flex items-center gap-3">
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="daily">Daily alerts</option>
              <option value="weekly">Weekly alerts</option>
            </select>
            <button
              onClick={handleSave}
              disabled={saving || !newName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading...
            </div>
          ) : searches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Search className="w-8 h-8 mb-2" />
              <p className="text-sm">No saved searches yet</p>
            </div>
          ) : (
            searches.map((search) => (
              <div
                key={search.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{search.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {summarizeFilters(search.search_criteria)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(search.id)}
                    disabled={deletingId === search.id}
                    className="ml-2 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    {deletingId === search.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {search.alert_frequency}
                    </span>
                    {search.last_checked_at && (
                      <span>
                        Last: {new Date(search.last_checked_at).toLocaleDateString()}
                      </span>
                    )}
                    {search.results_count > 0 && (
                      <span>{search.results_count} results</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleAlert(search.id, !search.alert_enabled)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      search.alert_enabled
                        ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {search.alert_enabled ? (
                      <Bell className="w-3 h-3" />
                    ) : (
                      <BellOff className="w-3 h-3" />
                    )}
                    {search.alert_enabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
