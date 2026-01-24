import { useState, useEffect } from 'react';
import { Plus, BookOpen, MoreVertical, Pencil, Trash2, Globe, History, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as knowledgeService from '../../../services/knowledgeCollections';
import type { KnowledgeCollection, KnowledgeVersion, KnowledgeStatus } from '../../../types';

export function KnowledgeSettingsTab() {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [collections, setCollections] = useState<KnowledgeCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<KnowledgeCollection | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);

  useEffect(() => {
    if (orgId) {
      loadCollections();
    }
  }, [orgId]);

  const loadCollections = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const data = await knowledgeService.getCollections(orgId);
      setCollections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedCollection(null);
    setIsDrawerOpen(true);
  };

  const handleEdit = (collection: KnowledgeCollection) => {
    setSelectedCollection(collection);
    setIsDrawerOpen(true);
    setOpenMenuId(null);
  };

  const handleToggleStatus = async (collection: KnowledgeCollection) => {
    try {
      const newStatus: KnowledgeStatus = collection.status === 'active' ? 'inactive' : 'active';
      await knowledgeService.toggleCollectionStatus(collection.id, newStatus);
      await loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update collection');
    }
    setOpenMenuId(null);
  };

  const handleDelete = async (collection: KnowledgeCollection) => {
    if (!confirm(`Are you sure you want to delete "${collection.name}"?`)) return;
    try {
      await knowledgeService.deleteCollection(collection.id);
      await loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete collection');
    }
    setOpenMenuId(null);
  };

  const handleViewHistory = async (collection: KnowledgeCollection) => {
    try {
      const versionHistory = await knowledgeService.getVersions(collection.id);
      setVersions(versionHistory);
      setSelectedCollection(collection);
      setShowVersionHistory(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version history');
    }
    setOpenMenuId(null);
  };

  const handleSave = async () => {
    setIsDrawerOpen(false);
    setSelectedCollection(null);
    await loadCollections();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white">Knowledge Collections</h2>
          <p className="text-sm text-slate-400">
            Create knowledge bases that AI agents can reference during conversations
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Collection
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No knowledge collections</h3>
          <p className="text-slate-400 mb-4">
            Create your first knowledge collection to give AI agents context
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
          >
            <Plus className="w-4 h-4" />
            Create Collection
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="bg-slate-800 border border-slate-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white">{collection.name}</h3>
                  {collection.apply_to_all_agents && (
                    <Globe className="w-4 h-4 text-cyan-400" title="Applied to all agents" />
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === collection.id ? null : collection.id)}
                    className="p-1 text-slate-400 hover:text-white rounded"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {openMenuId === collection.id && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                      <button
                        onClick={() => handleEdit(collection)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleViewHistory(collection)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                      >
                        <History className="w-4 h-4" />
                        Version History
                      </button>
                      <button
                        onClick={() => handleToggleStatus(collection)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                      >
                        {collection.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(collection)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {collection.description && (
                <p className="text-sm text-slate-400 mb-3 line-clamp-2">{collection.description}</p>
              )}

              <div className="flex items-center justify-between text-xs">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full ${
                    collection.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-slate-500/10 text-slate-400'
                  }`}
                >
                  {collection.status === 'active' ? 'Active' : 'Inactive'}
                </span>
                <span className="text-slate-500">
                  {collection.agent_count || 0} agents
                </span>
              </div>

              {collection.latest_version && (
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                  v{collection.latest_version.version_number} - Updated{' '}
                  {new Date(collection.latest_version.created_at).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isDrawerOpen && (
        <KnowledgeEditorDrawer
          collection={selectedCollection}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedCollection(null);
          }}
          onSave={handleSave}
        />
      )}

      {showVersionHistory && selectedCollection && (
        <VersionHistoryModal
          collection={selectedCollection}
          versions={versions}
          onClose={() => {
            setShowVersionHistory(false);
            setSelectedCollection(null);
            setVersions([]);
          }}
        />
      )}
    </div>
  );
}

interface KnowledgeEditorDrawerProps {
  collection: KnowledgeCollection | null;
  onClose: () => void;
  onSave: () => void;
}

function KnowledgeEditorDrawer({ collection, onClose, onSave }: KnowledgeEditorDrawerProps) {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [name, setName] = useState(collection?.name || '');
  const [description, setDescription] = useState(collection?.description || '');
  const [applyToAll, setApplyToAll] = useState(collection?.apply_to_all_agents ?? false);
  const [bodyText, setBodyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (collection) {
      loadLatestContent();
    }
  }, [collection]);

  const loadLatestContent = async () => {
    if (!collection) return;
    try {
      setLoadingContent(true);
      const latest = await knowledgeService.getLatestVersion(collection.id);
      if (latest?.body_text) {
        setBodyText(latest.body_text);
      }
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleSave = async () => {
    if (!orgId || !user) return;
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (collection) {
        await knowledgeService.updateCollection(collection.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          apply_to_all_agents: applyToAll,
        });

        const latestVersion = await knowledgeService.getLatestVersion(collection.id);
        if (bodyText.trim() !== (latestVersion?.body_text || '').trim()) {
          await knowledgeService.createVersion(collection.id, { body_text: bodyText }, user.id);
        }
      } else {
        await knowledgeService.createCollection(
          orgId,
          {
            name: name.trim(),
            description: description.trim() || undefined,
            apply_to_all_agents: applyToAll,
            body_text: bodyText || undefined,
          },
          user.id
        );
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save collection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
      <div className="w-full max-w-2xl bg-slate-900 h-full overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-white">
            {collection ? 'Edit Collection' : 'Create Collection'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="e.g., Company Overview"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Brief description of this knowledge collection"
            />
          </div>

          <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
            />
            <div>
              <span className="text-slate-300">Apply to all agents</span>
              <p className="text-xs text-slate-400">
                This knowledge will be automatically included in all AI agent runs
              </p>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Knowledge Content
            </label>
            <p className="text-xs text-slate-400 mb-2">
              Enter the knowledge text that AI agents will reference
            </p>
            {loadingContent ? (
              <div className="h-64 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-lg">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
              </div>
            ) : (
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                placeholder="Enter your knowledge content here...

You can include:
- Company information
- Product details
- FAQs
- Policies
- Sales processes
- Best practices"
              />
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : collection ? 'Save Changes' : 'Create Collection'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface VersionHistoryModalProps {
  collection: KnowledgeCollection;
  versions: KnowledgeVersion[];
  onClose: () => void;
}

function VersionHistoryModal({ collection, versions, onClose }: VersionHistoryModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<KnowledgeVersion | null>(
    versions[0] || null
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Version History - {collection.name}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 border-r border-slate-700 overflow-y-auto">
            {versions.map((version) => (
              <button
                key={version.id}
                onClick={() => setSelectedVersion(version)}
                className={`w-full text-left px-4 py-3 border-b border-slate-700/50 ${
                  selectedVersion?.id === version.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <div className="font-medium">Version {version.version_number}</div>
                <div className="text-xs text-slate-500">
                  {new Date(version.created_at).toLocaleString()}
                </div>
                {version.created_by_user && (
                  <div className="text-xs text-slate-500">
                    by {version.created_by_user.name}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {selectedVersion ? (
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                {selectedVersion.body_text || '(No content)'}
              </pre>
            ) : (
              <p className="text-slate-400">Select a version to view its content</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
