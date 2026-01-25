import { useState, useEffect } from 'react';
import { MoreVertical, Check, X, Star, Trash2, Pencil, Target } from 'lucide-react';
import { getModels, createModel, updateModel, deleteModel, toggleModel, setPrimaryModel, type ScoringModel } from '../../../services/scoring';
import { ModelFormModal } from './ModelFormModal';

interface ModelsTabProps {
  showCreateModal: boolean;
  onCloseCreateModal: () => void;
}

export function ModelsTab({ showCreateModal, onCloseCreateModal }: ModelsTabProps) {
  const [models, setModels] = useState<ScoringModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<ScoringModel | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    try {
      setLoading(true);
      const data = await getModels();
      setModels(data);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateModel(data: Parameters<typeof createModel>[0]) {
    await createModel(data);
    await loadModels();
    onCloseCreateModal();
  }

  async function handleUpdateModel(data: Parameters<typeof createModel>[0]) {
    if (!editingModel) return;
    await updateModel(editingModel.id, data);
    await loadModels();
    setEditingModel(null);
  }

  async function handleToggle(model: ScoringModel) {
    await toggleModel(model.id, !model.active);
    await loadModels();
    setActionMenuId(null);
  }

  async function handleSetPrimary(model: ScoringModel) {
    await setPrimaryModel(model.id);
    await loadModels();
    setActionMenuId(null);
  }

  async function handleDelete(model: ScoringModel) {
    if (!confirm(`Are you sure you want to delete "${model.name}"? This will remove all associated rules and scores.`)) {
      return;
    }
    await deleteModel(model.id);
    await loadModels();
    setActionMenuId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Scoring models define how points are tracked for contacts and opportunities.
      </p>

      {models.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-dashed border-slate-700">
          <Target className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No scoring models</h3>
          <p className="text-slate-400 mb-4">Create your first scoring model to start tracking engagement.</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Starting Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Max Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {models.map((model) => (
                <tr key={model.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{model.name}</span>
                      {model.is_primary && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Star className="h-3 w-3" />
                          Primary
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300 capitalize">
                      {model.scope}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {model.starting_score}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {model.max_score ?? 'No limit'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {model.active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Check className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
                        <X className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative">
                      <button
                        onClick={() => setActionMenuId(actionMenuId === model.id ? null : model.id)}
                        className="p-1 rounded hover:bg-slate-700"
                      >
                        <MoreVertical className="h-5 w-5 text-slate-400" />
                      </button>
                      {actionMenuId === model.id && (
                        <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-xl bg-slate-800 border border-slate-700 z-50">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setEditingModel(model);
                                setActionMenuId(null);
                              }}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggle(model)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                            >
                              {model.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                              {model.active ? 'Disable' : 'Enable'}
                            </button>
                            {!model.is_primary && (
                              <button
                                onClick={() => handleSetPrimary(model)}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                              >
                                <Star className="h-4 w-4" />
                                Set as Primary
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(model)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
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

      {(showCreateModal || editingModel) && (
        <ModelFormModal
          model={editingModel}
          onClose={() => {
            onCloseCreateModal();
            setEditingModel(null);
          }}
          onSubmit={editingModel ? handleUpdateModel : handleCreateModel}
        />
      )}
    </div>
  );
}
