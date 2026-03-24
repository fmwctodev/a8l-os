import { useState, useEffect } from 'react';
import { sanitizeHtml } from '../../../utils/sanitizeHtml';
import {
  Plus,
  BookOpen,
  MoreVertical,
  Pencil,
  Trash2,
  Globe,
  History,
  X,
  AlertTriangle,
  Lock,
  HelpCircle,
  Table,
  FileText,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { GlobalKnowledgeSourceModal } from './GlobalKnowledgeSourceModal';
import * as knowledgeService from '../../../services/knowledgeCollections';
import type {
  KnowledgeCollection,
  KnowledgeVersion,
  KnowledgeStatus,
  AgentKnowledgeSourceType,
  FAQSourceConfig,
  RichTextSourceConfig,
  TableSourceConfig,
  FileUploadSourceConfig,
  WebCrawlerSourceConfig,
} from '../../../types';

interface KnowledgeSettingsTabProps {
  isSuperAdmin?: boolean;
  isViewOnly?: boolean;
}

const SOURCE_TYPE_CONFIG: Record<
  AgentKnowledgeSourceType,
  { icon: typeof Globe; label: string; color: string }
> = {
  website: { icon: Globe, label: 'Website', color: 'text-blue-400' },
  faq: { icon: HelpCircle, label: 'FAQ', color: 'text-cyan-400' },
  table: { icon: Table, label: 'Table', color: 'text-emerald-400' },
  rich_text: { icon: FileText, label: 'Rich Text', color: 'text-amber-400' },
  file_upload: { icon: Upload, label: 'Files', color: 'text-rose-400' },
};

export function KnowledgeSettingsTab({ isSuperAdmin = false, isViewOnly = false }: KnowledgeSettingsTabProps) {
  const { user } = useAuth();
  const orgId = user?.organization_id;
  const canEdit = isSuperAdmin && !isViewOnly;

  const [collections, setCollections] = useState<KnowledgeCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
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
    setIsModalOpen(true);
  };

  const handleEdit = (collection: KnowledgeCollection) => {
    setSelectedCollection(collection);
    setIsModalOpen(true);
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
    setIsModalOpen(false);
    setSelectedCollection(null);
    await loadCollections();
  };

  const getSourceTypeInfo = (collection: KnowledgeCollection) => {
    const sourceType = collection.source_type || 'rich_text';
    return SOURCE_TYPE_CONFIG[sourceType] || SOURCE_TYPE_CONFIG.rich_text;
  };

  const getContentPreview = (collection: KnowledgeCollection) => {
    const sourceType = collection.source_type || 'rich_text';
    const config = collection.source_config || collection.latest_version?.source_config || {};

    switch (sourceType) {
      case 'faq': {
        const faqConfig = config as FAQSourceConfig;
        const count = faqConfig.faqs?.length || 0;
        return `${count} Q&A pair${count !== 1 ? 's' : ''}`;
      }
      case 'website': {
        const webConfig = config as WebCrawlerSourceConfig;
        return webConfig.url ? `Crawled: ${webConfig.url}` : 'No URL configured';
      }
      case 'table': {
        const tableConfig = config as TableSourceConfig;
        return tableConfig.fileName
          ? `${tableConfig.fileName} (${tableConfig.rowCount || 0} rows)`
          : 'No table uploaded';
      }
      case 'file_upload': {
        const fileConfig = config as FileUploadSourceConfig;
        const count = fileConfig.files?.length || 0;
        return `${count} file${count !== 1 ? 's' : ''} uploaded`;
      }
      case 'rich_text':
      default: {
        const richConfig = config as RichTextSourceConfig;
        const plainText = richConfig.plainText || collection.latest_version?.body_text || '';
        if (!plainText) return 'No content';
        return plainText.length > 80 ? plainText.substring(0, 80) + '...' : plainText;
      }
    }
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

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
        <p className="text-amber-400 text-sm">
          This knowledge is shared by all agents unless overridden at the agent level.
        </p>
      </div>

      {!canEdit && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center gap-3">
          <Lock className="w-5 h-5 text-slate-400 shrink-0" />
          <p className="text-slate-400 text-sm">
            Only SuperAdmin users can modify global knowledge. You have read-only access.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white">Global Knowledge Collections</h2>
          <p className="text-sm text-slate-400">
            Create knowledge bases that AI agents can reference during conversations
          </p>
        </div>
        {canEdit && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Collection
          </button>
        )}
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No knowledge collections</h3>
          <p className="text-slate-400 mb-4">
            {canEdit
              ? 'Create your first knowledge collection to give AI agents context'
              : 'No knowledge collections have been created yet'}
          </p>
          {canEdit && (
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
            >
              <Plus className="w-4 h-4" />
              Create Collection
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => {
            const sourceTypeInfo = getSourceTypeInfo(collection);
            const SourceIcon = sourceTypeInfo.icon;

            return (
              <div
                key={collection.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <SourceIcon className={`w-4 h-4 ${sourceTypeInfo.color}`} />
                    <h3 className="font-medium text-white">{collection.name}</h3>
                    {collection.apply_to_all_agents && (
                      <span className="px-1.5 py-0.5 text-xs bg-cyan-500/10 text-cyan-400 rounded" title="Applied to all agents">
                        Global
                      </span>
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
                        {canEdit && (
                          <button
                            onClick={() => handleEdit(collection)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => handleViewHistory(collection)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                          <History className="w-4 h-4" />
                          Version History
                        </button>
                        {canEdit && (
                          <>
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
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                  {collection.description || getContentPreview(collection)}
                </p>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full ${
                        collection.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {collection.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-slate-700/50 text-slate-400">
                      {sourceTypeInfo.label}
                    </span>
                  </div>
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
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <GlobalKnowledgeSourceModal
          collection={selectedCollection}
          onClose={() => {
            setIsModalOpen(false);
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

interface VersionHistoryModalProps {
  collection: KnowledgeCollection;
  versions: KnowledgeVersion[];
  onClose: () => void;
}

function VersionHistoryModal({ collection, versions, onClose }: VersionHistoryModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<KnowledgeVersion | null>(
    versions[0] || null
  );

  const renderVersionContent = (version: KnowledgeVersion) => {
    const sourceType = collection.source_type || 'rich_text';
    const config = version.source_config || {};

    switch (sourceType) {
      case 'faq': {
        const faqConfig = config as FAQSourceConfig;
        if (!faqConfig.faqs?.length) return <p className="text-slate-400">(No FAQs)</p>;
        return (
          <div className="space-y-4">
            {faqConfig.faqs.map((faq, idx) => (
              <div key={idx} className="bg-slate-800 rounded-lg p-4">
                <div className="flex items-start gap-2 mb-2">
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-cyan-500/10 text-cyan-400 rounded-full text-sm font-medium">
                    Q
                  </span>
                  <p className="text-white">{faq.question}</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-emerald-500/10 text-emerald-400 rounded-full text-sm font-medium">
                    A
                  </span>
                  <p className="text-slate-300">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        );
      }
      case 'rich_text': {
        const richConfig = config as RichTextSourceConfig;
        if (richConfig.content) {
          return (
            <div
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(richConfig.content) }}
            />
          );
        }
        return (
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
            {version.body_text || '(No content)'}
          </pre>
        );
      }
      case 'website': {
        const webConfig = config as WebCrawlerSourceConfig;
        return (
          <div className="space-y-2">
            <p className="text-slate-300">
              <span className="text-slate-500">URL:</span> {webConfig.url || 'N/A'}
            </p>
            <p className="text-slate-300">
              <span className="text-slate-500">Crawl Type:</span> {webConfig.crawlType || 'exact'}
            </p>
            <p className="text-slate-300">
              <span className="text-slate-500">Depth:</span> {webConfig.depth || 1}
            </p>
          </div>
        );
      }
      case 'table': {
        const tableConfig = config as TableSourceConfig;
        return (
          <div className="space-y-2">
            <p className="text-slate-300">
              <span className="text-slate-500">File:</span> {tableConfig.fileName || 'N/A'}
            </p>
            <p className="text-slate-300">
              <span className="text-slate-500">Rows:</span> {tableConfig.rowCount || 0}
            </p>
            <p className="text-slate-300">
              <span className="text-slate-500">Columns:</span>{' '}
              {tableConfig.selectedColumns?.join(', ') || 'N/A'}
            </p>
          </div>
        );
      }
      case 'file_upload': {
        const fileConfig = config as FileUploadSourceConfig;
        if (!fileConfig.files?.length) return <p className="text-slate-400">(No files)</p>;
        return (
          <div className="space-y-2">
            {fileConfig.files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 text-slate-300">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>{file.name}</span>
                <span className="text-slate-500 text-sm">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ))}
          </div>
        );
      }
      default:
        return (
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
            {version.body_text || '(No content)'}
          </pre>
        );
    }
  };

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
              renderVersionContent(selectedVersion)
            ) : (
              <p className="text-slate-400">Select a version to view its content</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
