import { useState, useEffect } from 'react';
import { Plus, FileText, MoreVertical, Pencil, Trash2, History, X, Info, Lock } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as promptsService from '../../../services/promptTemplates';
import type {
  PromptTemplate,
  PromptTemplateVersion,
  PromptStatus,
  PromptCategory,
} from '../../../types';
import { PROMPT_CATEGORY_LABELS, COMMON_PROMPT_VARIABLES } from '../../../types';

interface PromptsSettingsTabProps {
  isViewOnly?: boolean;
}

export function PromptsSettingsTab({ isViewOnly = false }: PromptsSettingsTabProps) {
  const { user } = useAuth();
  const orgId = user?.organization_id;
  const isAdmin = user?.role?.name === 'SuperAdmin' || user?.role?.name === 'Admin';
  const canEdit = isAdmin && !isViewOnly;

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<PromptTemplateVersion[]>([]);

  useEffect(() => {
    if (orgId) {
      loadTemplates();
    }
  }, [orgId]);

  const loadTemplates = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const data = await promptsService.getTemplates(orgId);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsDrawerOpen(true);
  };

  const handleEdit = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setIsDrawerOpen(true);
    setOpenMenuId(null);
  };

  const handleToggleStatus = async (template: PromptTemplate) => {
    try {
      const newStatus: PromptStatus = template.status === 'active' ? 'inactive' : 'active';
      await promptsService.toggleTemplateStatus(template.id, newStatus);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    }
    setOpenMenuId(null);
  };

  const handleDelete = async (template: PromptTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return;
    try {
      await promptsService.deleteTemplate(template.id);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
    setOpenMenuId(null);
  };

  const handleViewHistory = async (template: PromptTemplate) => {
    try {
      const versionHistory = await promptsService.getVersions(template.id);
      setVersions(versionHistory);
      setSelectedTemplate(template);
      setShowVersionHistory(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version history');
    }
    setOpenMenuId(null);
  };

  const handleSave = async () => {
    setIsDrawerOpen(false);
    setSelectedTemplate(null);
    await loadTemplates();
  };

  const filteredTemplates =
    filterCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === filterCategory);

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
          <h2 className="text-lg font-medium text-white">Prompt Templates</h2>
          <p className="text-sm text-slate-400">
            Create reusable prompt blocks that can be attached to AI agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="all">All Categories</option>
            {Object.entries(PROMPT_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          {canEdit && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          )}
        </div>
      </div>

      {isViewOnly && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center gap-3">
          <Lock className="w-5 h-5 text-slate-400 shrink-0" />
          <p className="text-slate-400 text-sm">
            You have view-only access. Contact an administrator to make changes.
          </p>
        </div>
      )}

      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No prompt templates</h3>
          <p className="text-slate-400 mb-4">
            {canEdit
              ? 'Create reusable prompts that can be attached to AI agents'
              : 'No prompt templates have been created yet'}
          </p>
          {canEdit && (
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Variables</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Agents</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((template) => (
                <tr
                  key={template.id}
                  className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-white">{template.name}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {PROMPT_CATEGORY_LABELS[template.category]}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {template.latest_version?.variables?.length || 0} variables
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        template.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {template.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {template.agent_count || 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenMenuId(openMenuId === template.id ? null : template.id)
                        }
                        className="p-1 text-slate-400 hover:text-white rounded"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {openMenuId === template.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(template)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                            >
                              <Pencil className="w-4 h-4" />
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => handleViewHistory(template)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                          >
                            <History className="w-4 h-4" />
                            Version History
                          </button>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(template)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                              >
                                {template.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDelete(template)}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isDrawerOpen && (
        <PromptEditorDrawer
          template={selectedTemplate}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedTemplate(null);
          }}
          onSave={handleSave}
        />
      )}

      {showVersionHistory && selectedTemplate && (
        <VersionHistoryModal
          template={selectedTemplate}
          versions={versions}
          onClose={() => {
            setShowVersionHistory(false);
            setSelectedTemplate(null);
            setVersions([]);
          }}
        />
      )}
    </div>
  );
}

interface PromptEditorDrawerProps {
  template: PromptTemplate | null;
  onClose: () => void;
  onSave: () => void;
}

function PromptEditorDrawer({ template, onClose, onSave }: PromptEditorDrawerProps) {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [name, setName] = useState(template?.name || '');
  const [category, setCategory] = useState<PromptCategory>(template?.category || 'custom');
  const [body, setBody] = useState('');
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [showVariableHelper, setShowVariableHelper] = useState(false);

  useEffect(() => {
    if (template) {
      loadLatestContent();
    }
  }, [template]);

  useEffect(() => {
    const variables = promptsService.parseVariables(body);
    setDetectedVariables(variables);
  }, [body]);

  const loadLatestContent = async () => {
    if (!template) return;
    try {
      setLoadingContent(true);
      const latest = await promptsService.getLatestVersion(template.id);
      if (latest?.body) {
        setBody(latest.body);
      }
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setLoadingContent(false);
    }
  };

  const insertVariable = (variable: string) => {
    setBody((prev) => prev + `{{${variable}}}`);
    setShowVariableHelper(false);
  };

  const handleSave = async () => {
    if (!orgId || !user) return;
    if (!name.trim() || !body.trim()) {
      setError('Name and body are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (template) {
        await promptsService.updateTemplate(template.id, {
          name: name.trim(),
          category,
        });

        const latestVersion = await promptsService.getLatestVersion(template.id);
        if (body.trim() !== (latestVersion?.body || '').trim()) {
          await promptsService.createVersion(template.id, { body }, user.id);
        }
      } else {
        await promptsService.createTemplate(
          orgId,
          {
            name: name.trim(),
            category,
            body,
          },
          user.id
        );
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
      <div className="w-full max-w-2xl bg-slate-900 h-full overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-white">
            {template ? 'Edit Template' : 'Create Template'}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="e.g., Lead Qualification"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PromptCategory)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {Object.entries(PROMPT_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-300">Prompt Body *</label>
              <div className="relative">
                <button
                  onClick={() => setShowVariableHelper(!showVariableHelper)}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  <Info className="w-3 h-3" />
                  Insert Variable
                </button>

                {showVariableHelper && (
                  <div className="absolute right-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 p-2 max-h-64 overflow-y-auto">
                    {COMMON_PROMPT_VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => insertVariable(v.key)}
                        className="w-full text-left px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700 rounded"
                      >
                        <span className="font-mono text-cyan-400">{`{{${v.key}}}`}</span>
                        <span className="text-slate-500 text-xs block">{v.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Use {'{{variable_name}}'} syntax to define dynamic variables
            </p>
            {loadingContent ? (
              <div className="h-64 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-lg">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
              </div>
            ) : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                placeholder="Enter your prompt template here...

Use {{contact_name}}, {{contact_email}}, etc. for dynamic values."
              />
            )}
          </div>

          {detectedVariables.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Detected Variables ({detectedVariables.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {detectedVariables.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center px-2 py-1 bg-cyan-500/10 text-cyan-400 text-xs font-mono rounded"
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}
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
            {saving ? 'Saving...' : template ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface VersionHistoryModalProps {
  template: PromptTemplate;
  versions: PromptTemplateVersion[];
  onClose: () => void;
}

function VersionHistoryModal({ template, versions, onClose }: VersionHistoryModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<PromptTemplateVersion | null>(
    versions[0] || null
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Version History - {template.name}
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
                {version.variables?.length > 0 && (
                  <div className="text-xs text-cyan-400 mt-1">
                    {version.variables.length} variables
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {selectedVersion ? (
              <div className="space-y-4">
                {selectedVersion.variables?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-700">
                    {selectedVersion.variables.map((v) => (
                      <span
                        key={v}
                        className="inline-flex items-center px-2 py-1 bg-cyan-500/10 text-cyan-400 text-xs font-mono rounded"
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                  {selectedVersion.body}
                </pre>
              </div>
            ) : (
              <p className="text-slate-400">Select a version to view its content</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
