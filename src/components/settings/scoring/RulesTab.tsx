import { useState, useEffect } from 'react';
import { Plus, MoreVertical, Check, X, Trash2, Pencil, Zap } from 'lucide-react';
import { getModels, getRules, deleteRule, toggleRule, type ScoringModel, type ScoringRule, getTriggerTypeLabel, formatScoreChange } from '../../../services/scoring';
import { RuleFormModal } from './RuleFormModal';

export function RulesTab() {
  const [models, setModels] = useState<ScoringModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    if (selectedModelId) {
      loadRules(selectedModelId);
    } else {
      setRules([]);
    }
  }, [selectedModelId]);

  async function loadModels() {
    try {
      const data = await getModels();
      setModels(data);
      if (data.length > 0) {
        const primary = data.find(m => m.is_primary) || data[0];
        setSelectedModelId(primary.id);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadRules(modelId: string) {
    try {
      setLoading(true);
      const data = await getRules(modelId);
      setRules(data);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(rule: ScoringRule) {
    await toggleRule(rule.id, !rule.active);
    await loadRules(selectedModelId);
    setActionMenuId(null);
  }

  async function handleDelete(rule: ScoringRule) {
    if (!confirm(`Are you sure you want to delete "${rule.name}"?`)) {
      return;
    }
    await deleteRule(rule.id);
    await loadRules(selectedModelId);
    setActionMenuId(null);
  }

  function getFrequencyLabel(rule: ScoringRule): string {
    if (rule.frequency_type === 'once') return 'Once per entity';
    if (rule.frequency_type === 'unlimited') return 'Unlimited';
    if (rule.frequency_type === 'interval' && rule.cooldown_interval && rule.cooldown_unit) {
      return `Once per ${rule.cooldown_interval} ${rule.cooldown_unit}`;
    }
    return rule.frequency_type;
  }

  function getScoreColor(delta: number): string {
    if (delta > 0) return 'text-emerald-400';
    if (delta < 0) return 'text-red-400';
    return 'text-slate-400';
  }

  if (loading && models.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-400">Model:</label>
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
          >
            <option value="">Select a model</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.scope})
              </option>
            ))}
          </select>
        </div>
        {selectedModelId && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:brightness-110 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Rule
          </button>
        )}
      </div>

      {!selectedModelId ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-dashed border-slate-700">
          <p className="text-slate-400">Select a scoring model to view and manage its rules.</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-dashed border-slate-700">
          <Zap className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No rules yet</h3>
          <p className="text-slate-400 mb-4">Create rules to define how scores change based on actions.</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:brightness-110 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Rule
          </button>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Rule Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Trigger
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Frequency
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
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-white">{rule.name}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-slate-300">{getTriggerTypeLabel(rule.trigger_type)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${getScoreColor(rule.points)}`}>
                      {formatScoreChange(rule.points)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-slate-400">{getFrequencyLabel(rule)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {rule.active ? (
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
                        onClick={() => setActionMenuId(actionMenuId === rule.id ? null : rule.id)}
                        className="p-1 rounded hover:bg-slate-700"
                      >
                        <MoreVertical className="h-5 w-5 text-slate-400" />
                      </button>
                      {actionMenuId === rule.id && (
                        <div className="absolute right-0 mt-2 w-40 rounded-lg shadow-xl bg-slate-800 border border-slate-700 z-50">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setEditingRule(rule);
                                setActionMenuId(null);
                              }}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggle(rule)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                            >
                              {rule.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                              {rule.active ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => handleDelete(rule)}
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

      {(showModal || editingRule) && (
        <RuleFormModal
          modelId={selectedModelId}
          rule={editingRule}
          onClose={() => {
            setShowModal(false);
            setEditingRule(null);
          }}
          onSaved={() => {
            loadRules(selectedModelId);
            setShowModal(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}
