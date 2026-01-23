import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  GripVertical,
  Trash2,
  Edit2,
  Check,
  ChevronDown,
  ChevronUp,
  Settings,
  Columns,
  Clock,
  AlertCircle,
  Save,
  X,
  Eye
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import type { Pipeline, PipelineStage, PipelineCustomField, Department } from '../../types';
import * as pipelinesService from '../../services/pipelines';
import { getDepartments } from '../../services/departments';

interface DraftStage {
  id: string;
  name: string;
  aging_threshold_days?: number | null;
}

interface DraftPipeline {
  name: string;
  stages: DraftStage[];
}

const DEFAULT_STAGES: DraftStage[] = [
  { id: 'draft-1', name: 'New Lead' },
  { id: 'draft-2', name: 'Qualified' },
  { id: 'draft-3', name: 'Proposal' },
  { id: 'draft-4', name: 'Negotiation' },
  { id: 'draft-5', name: 'Closed Won' },
  { id: 'draft-6', name: 'Closed Lost' }
];

export function PipelinesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = usePermission('pipelines.manage');

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'stages' | 'fields'>('stages');

  const [draftPipeline, setDraftPipeline] = useState<DraftPipeline | null>(null);
  const [showNewPipelineForm, setShowNewPipelineForm] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');

  const [newStageName, setNewStageName] = useState('');
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState('');
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);

  const [newFieldForm, setNewFieldForm] = useState({
    label: '',
    field_key: '',
    field_type: 'text' as PipelineCustomField['field_type'],
    required: false,
    filterable: true,
    options: [] as string[]
  });
  const [showNewFieldForm, setShowNewFieldForm] = useState(false);
  const [newOption, setNewOption] = useState('');

  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'select'; pipeline: Pipeline } | null>(null);

  const isDraftMode = draftPipeline !== null;
  const canSaveDraft = isDraftMode && draftPipeline.name.trim() && draftPipeline.stages.length > 0;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [pipelinesData, departmentsData] = await Promise.all([
        pipelinesService.getPipelines(),
        getDepartments()
      ]);
      setPipelines(pipelinesData);
      setDepartments(departmentsData);
      if (pipelinesData.length > 0 && !selectedPipeline) {
        await selectPipeline(pipelinesData[0]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function selectPipeline(pipeline: Pipeline) {
    if (isDraftMode) {
      setPendingAction({ type: 'select', pipeline });
      setShowUnsavedWarning(true);
      return;
    }
    try {
      const fullPipeline = await pipelinesService.getPipelineById(pipeline.id);
      if (fullPipeline) {
        setSelectedPipeline(fullPipeline);
      }
    } catch (error) {
      console.error('Failed to load pipeline:', error);
    }
  }

  function handleStartNewPipeline() {
    if (isDraftMode) return;
    setShowNewPipelineForm(true);
  }

  function handleCreateDraft() {
    if (!newPipelineName.trim()) return;
    setDraftPipeline({
      name: newPipelineName.trim(),
      stages: DEFAULT_STAGES.map((s, i) => ({ ...s, id: `draft-${i}` }))
    });
    setSelectedPipeline(null);
    setShowNewPipelineForm(false);
    setNewPipelineName('');
  }

  function handleCancelDraft() {
    setDraftPipeline(null);
    setShowNewPipelineForm(false);
    setNewPipelineName('');
    if (pipelines.length > 0) {
      selectPipeline(pipelines[0]);
    }
  }

  async function handleSaveDraft() {
    if (!draftPipeline || !canSaveDraft || !user) return;
    setSaving(true);
    try {
      const pipeline = await pipelinesService.createPipelineWithStages({
        org_id: user.organization_id,
        name: draftPipeline.name,
        stages: draftPipeline.stages.map(s => ({
          name: s.name,
          aging_threshold_days: s.aging_threshold_days
        }))
      });
      setPipelines([...pipelines, pipeline]);
      setDraftPipeline(null);
      setSelectedPipeline(pipeline);
      setShowUnsavedWarning(false);
      setPendingAction(null);
    } catch (error) {
      console.error('Failed to save pipeline:', error);
    } finally {
      setSaving(false);
    }
  }

  function handleAddDraftStage() {
    if (!newStageName.trim() || !draftPipeline) return;
    setDraftPipeline({
      ...draftPipeline,
      stages: [
        ...draftPipeline.stages,
        { id: `draft-${Date.now()}`, name: newStageName.trim() }
      ]
    });
    setNewStageName('');
  }

  function handleUpdateDraftStage(stageId: string, name: string) {
    if (!name.trim() || !draftPipeline) return;
    setDraftPipeline({
      ...draftPipeline,
      stages: draftPipeline.stages.map(s =>
        s.id === stageId ? { ...s, name: name.trim() } : s
      )
    });
    setEditingStageId(null);
    setEditingStageName('');
  }

  function handleDeleteDraftStage(stageId: string) {
    if (!draftPipeline) return;
    setDraftPipeline({
      ...draftPipeline,
      stages: draftPipeline.stages.filter(s => s.id !== stageId)
    });
  }

  function handleMoveDraftStage(stageId: string, direction: 'up' | 'down') {
    if (!draftPipeline) return;
    const stages = [...draftPipeline.stages];
    const idx = stages.findIndex(s => s.id === stageId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === stages.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [stages[idx], stages[swapIdx]] = [stages[swapIdx], stages[idx]];
    setDraftPipeline({ ...draftPipeline, stages });
  }

  function handleUpdateDraftAgingThreshold(stageId: string, days: number | null) {
    if (!draftPipeline) return;
    setDraftPipeline({
      ...draftPipeline,
      stages: draftPipeline.stages.map(s =>
        s.id === stageId ? { ...s, aging_threshold_days: days } : s
      )
    });
  }

  async function handleDeletePipeline(pipelineId: string) {
    if (!confirm('Are you sure? This will delete all stages and opportunities in this pipeline.')) return;
    setSaving(true);
    try {
      await pipelinesService.deletePipeline(pipelineId);
      const remaining = pipelines.filter(p => p.id !== pipelineId);
      setPipelines(remaining);
      if (selectedPipeline?.id === pipelineId) {
        if (remaining.length > 0) {
          await selectPipeline(remaining[0]);
        } else {
          setSelectedPipeline(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete pipeline:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateStage() {
    if (!newStageName.trim() || !selectedPipeline || !user) return;
    setSaving(true);
    try {
      const stage = await pipelinesService.createStage({
        org_id: user.organization_id,
        pipeline_id: selectedPipeline.id,
        name: newStageName.trim()
      });
      setSelectedPipeline({
        ...selectedPipeline,
        stages: [...(selectedPipeline.stages || []), stage]
      });
      setNewStageName('');
    } catch (error) {
      console.error('Failed to create stage:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStage(stageId: string, name: string) {
    if (!name.trim() || !selectedPipeline) return;
    setSaving(true);
    try {
      await pipelinesService.updateStage(stageId, { name: name.trim() });
      setSelectedPipeline({
        ...selectedPipeline,
        stages: (selectedPipeline.stages || []).map(s =>
          s.id === stageId ? { ...s, name: name.trim() } : s
        )
      });
      setEditingStageId(null);
      setEditingStageName('');
    } catch (error) {
      console.error('Failed to update stage:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStage(stageId: string) {
    if (!selectedPipeline) return;
    if (!confirm('Delete this stage? Opportunities in this stage will need to be moved first.')) return;
    setSaving(true);
    try {
      await pipelinesService.deleteStage(stageId);
      setSelectedPipeline({
        ...selectedPipeline,
        stages: (selectedPipeline.stages || []).filter(s => s.id !== stageId)
      });
    } catch (error) {
      console.error('Failed to delete stage:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveStage(stageId: string, direction: 'up' | 'down') {
    if (!selectedPipeline?.stages) return;
    const stages = [...selectedPipeline.stages];
    const idx = stages.findIndex(s => s.id === stageId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === stages.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [stages[idx], stages[swapIdx]] = [stages[swapIdx], stages[idx]];

    setSelectedPipeline({ ...selectedPipeline, stages });

    try {
      await pipelinesService.reorderStages(selectedPipeline.id, stages.map(s => s.id));
    } catch (error) {
      console.error('Failed to reorder stages:', error);
    }
  }

  async function handleUpdateAgingThreshold(stageId: string, days: number | null) {
    if (!selectedPipeline) return;
    setSaving(true);
    try {
      await pipelinesService.updateStage(stageId, { aging_threshold_days: days });
      setSelectedPipeline({
        ...selectedPipeline,
        stages: (selectedPipeline.stages || []).map(s =>
          s.id === stageId ? { ...s, aging_threshold_days: days } : s
        )
      });
    } catch (error) {
      console.error('Failed to update aging threshold:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateField() {
    if (!newFieldForm.label.trim() || !selectedPipeline || !user) return;
    setSaving(true);
    try {
      const field = await pipelinesService.createCustomField({
        org_id: user.organization_id,
        pipeline_id: selectedPipeline.id,
        field_key: newFieldForm.field_key || newFieldForm.label.toLowerCase().replace(/\s+/g, '_'),
        label: newFieldForm.label.trim(),
        field_type: newFieldForm.field_type,
        required: newFieldForm.required,
        filterable: newFieldForm.filterable,
        options: newFieldForm.options
      });
      setSelectedPipeline({
        ...selectedPipeline,
        custom_fields: [...(selectedPipeline.custom_fields || []), field]
      });
      setNewFieldForm({
        label: '',
        field_key: '',
        field_type: 'text',
        required: false,
        filterable: true,
        options: []
      });
      setShowNewFieldForm(false);
    } catch (error) {
      console.error('Failed to create field:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteField(fieldId: string) {
    if (!selectedPipeline) return;
    if (!confirm('Delete this custom field? Existing values will be lost.')) return;
    setSaving(true);
    try {
      await pipelinesService.deleteCustomField(fieldId);
      setSelectedPipeline({
        ...selectedPipeline,
        custom_fields: (selectedPipeline.custom_fields || []).filter(f => f.id !== fieldId)
      });
    } catch (error) {
      console.error('Failed to delete field:', error);
    } finally {
      setSaving(false);
    }
  }

  function addOption() {
    if (!newOption.trim()) return;
    setNewFieldForm({
      ...newFieldForm,
      options: [...newFieldForm.options, newOption.trim()]
    });
    setNewOption('');
  }

  function removeOption(index: number) {
    setNewFieldForm({
      ...newFieldForm,
      options: newFieldForm.options.filter((_, i) => i !== index)
    });
  }

  function handleDiscardDraft() {
    setShowUnsavedWarning(false);
    setDraftPipeline(null);
    if (pendingAction?.type === 'select') {
      pipelinesService.getPipelineById(pendingAction.pipeline.id).then(fullPipeline => {
        if (fullPipeline) {
          setSelectedPipeline(fullPipeline);
        }
      });
    }
    setPendingAction(null);
  }

  function handleViewInBoard(pipelineId: string) {
    navigate(`/opportunities?pipeline=${pipelineId}`);
  }

  const currentStages = isDraftMode ? draftPipeline.stages : (selectedPipeline?.stages || []);
  const currentName = isDraftMode ? draftPipeline.name : selectedPipeline?.name;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Access Restricted</h2>
        <p className="text-slate-400">You don't have permission to manage pipelines.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="w-72 flex-shrink-0 border-r border-slate-700 bg-slate-800/30 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Pipelines</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {pipelines.map(pipeline => (
            <div
              key={pipeline.id}
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer group transition-colors ${
                !isDraftMode && selectedPipeline?.id === pipeline.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'hover:bg-slate-700/50 text-slate-300 border border-transparent'
              }`}
              onClick={() => selectPipeline(pipeline)}
            >
              <div className="flex-1 min-w-0">
                <span className="block truncate font-medium">{pipeline.name}</span>
                <span className="text-xs text-slate-500">
                  {pipeline.stages?.length || 0} stages
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePipeline(pipeline.id);
                }}
                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-600 rounded transition-opacity"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))}

          {isDraftMode && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <div className="flex-1 min-w-0">
                <span className="block truncate font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {draftPipeline.name}
                </span>
                <span className="text-xs text-amber-500">Draft - Not saved</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-700">
          {showNewPipelineForm ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="Pipeline name"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateDraft()}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateDraft}
                  disabled={!newPipelineName.trim()}
                  className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewPipelineForm(false);
                    setNewPipelineName('');
                  }}
                  className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleStartNewPipeline}
              disabled={isDraftMode}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Pipeline
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {(selectedPipeline || isDraftMode) ? (
          <>
            <div className="flex-none p-4 border-b border-slate-700 bg-slate-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-white">{currentName}</h3>
                  {isDraftMode && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full font-medium">
                      Unsaved Draft
                    </span>
                  )}
                </div>
                {!isDraftMode && selectedPipeline && (
                  <button
                    onClick={() => handleViewInBoard(selectedPipeline.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View in Board
                  </button>
                )}
              </div>

              {isDraftMode && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-200">
                      <p className="font-medium">Configure your pipeline stages</p>
                      <p className="text-amber-300/80 mt-1">
                        Default stages have been added. You can add, edit, remove, or reorder stages before saving.
                        At least one stage is required.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setActiveTab('stages')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'stages'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:bg-slate-700 border border-transparent'
                  }`}
                >
                  <Columns className="w-4 h-4" />
                  Stages
                  <span className="text-xs bg-slate-600/50 px-1.5 py-0.5 rounded">
                    {currentStages.length}
                  </span>
                </button>
                {!isDraftMode && (
                  <button
                    onClick={() => setActiveTab('fields')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'fields'
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'text-slate-400 hover:bg-slate-700 border border-transparent'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Custom Fields
                    <span className="text-xs bg-slate-600/50 px-1.5 py-0.5 rounded">
                      {selectedPipeline?.custom_fields?.length || 0}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'stages' && (
                <div className="max-w-2xl space-y-2">
                  {currentStages.map((stage, index) => (
                    <div key={stage.id} className="bg-slate-700/30 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3 p-4 group">
                        <GripVertical className="w-4 h-4 text-slate-500 cursor-grab" />
                        {editingStageId === stage.id ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingStageName}
                              onChange={(e) => setEditingStageName(e.target.value)}
                              className="flex-1 px-3 py-1.5 bg-slate-600 border border-slate-500 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  isDraftMode
                                    ? handleUpdateDraftStage(stage.id, editingStageName)
                                    : handleUpdateStage(stage.id, editingStageName);
                                }
                                if (e.key === 'Escape') {
                                  setEditingStageId(null);
                                  setEditingStageName('');
                                }
                              }}
                            />
                            <button
                              onClick={() => isDraftMode
                                ? handleUpdateDraftStage(stage.id, editingStageName)
                                : handleUpdateStage(stage.id, editingStageName)
                              }
                              className="p-1.5 hover:bg-slate-600 rounded-lg"
                            >
                              <Check className="w-4 h-4 text-emerald-400" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingStageId(null);
                                setEditingStageName('');
                              }}
                              className="p-1.5 hover:bg-slate-600 rounded-lg"
                            >
                              <X className="w-4 h-4 text-slate-400" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <span className="text-white font-medium">{stage.name}</span>
                              {stage.aging_threshold_days && (
                                <span className="ml-3 text-xs text-amber-400 inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {stage.aging_threshold_days}d aging threshold
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setExpandedStageId(expandedStageId === stage.id ? null : stage.id)}
                                className={`p-1.5 hover:bg-slate-600 rounded-lg ${expandedStageId === stage.id ? 'bg-slate-600' : ''}`}
                                title="Stage settings"
                              >
                                <Settings className="w-4 h-4 text-slate-400" />
                              </button>
                              <button
                                onClick={() => isDraftMode
                                  ? handleMoveDraftStage(stage.id, 'up')
                                  : handleMoveStage(stage.id, 'up')
                                }
                                disabled={index === 0}
                                className="p-1.5 hover:bg-slate-600 rounded-lg disabled:opacity-30"
                              >
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                              </button>
                              <button
                                onClick={() => isDraftMode
                                  ? handleMoveDraftStage(stage.id, 'down')
                                  : handleMoveStage(stage.id, 'down')
                                }
                                disabled={index === currentStages.length - 1}
                                className="p-1.5 hover:bg-slate-600 rounded-lg disabled:opacity-30"
                              >
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingStageId(stage.id);
                                  setEditingStageName(stage.name);
                                }}
                                className="p-1.5 hover:bg-slate-600 rounded-lg"
                              >
                                <Edit2 className="w-4 h-4 text-slate-400" />
                              </button>
                              <button
                                onClick={() => isDraftMode
                                  ? handleDeleteDraftStage(stage.id)
                                  : handleDeleteStage(stage.id)
                                }
                                disabled={isDraftMode && draftPipeline.stages.length <= 1}
                                className="p-1.5 hover:bg-slate-600 rounded-lg disabled:opacity-30"
                                title={isDraftMode && draftPipeline.stages.length <= 1 ? 'At least one stage is required' : ''}
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      {expandedStageId === stage.id && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-600">
                          <div className="flex items-center gap-3 mt-3">
                            <label className="text-sm text-slate-400 whitespace-nowrap">
                              Stale after
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={stage.aging_threshold_days || ''}
                              onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                                isDraftMode
                                  ? handleUpdateDraftAgingThreshold(stage.id, val)
                                  : handleUpdateAgingThreshold(stage.id, val);
                              }}
                              placeholder="No limit"
                              className="w-24 px-3 py-1.5 bg-slate-600 border border-slate-500 rounded-lg text-white text-sm"
                            />
                            <span className="text-sm text-slate-400">days</span>
                            {stage.aging_threshold_days && (
                              <button
                                onClick={() => isDraftMode
                                  ? handleUpdateDraftAgingThreshold(stage.id, null)
                                  : handleUpdateAgingThreshold(stage.id, null)
                                }
                                className="text-xs text-slate-500 hover:text-slate-300"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            Opportunities in this stage longer than this threshold will show an aging warning
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="text"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      placeholder="New stage name"
                      className="flex-1 px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          isDraftMode ? handleAddDraftStage() : handleCreateStage();
                        }
                      }}
                    />
                    <button
                      onClick={isDraftMode ? handleAddDraftStage : handleCreateStage}
                      disabled={saving || !newStageName.trim()}
                      className="px-4 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'fields' && !isDraftMode && selectedPipeline && (
                <div className="max-w-2xl space-y-3">
                  {(selectedPipeline.custom_fields || []).length === 0 && !showNewFieldForm && (
                    <div className="text-center py-8 text-slate-400">
                      <Settings className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                      <p>No custom fields configured</p>
                      <p className="text-sm text-slate-500 mt-1">Add custom fields to capture additional data on opportunities</p>
                    </div>
                  )}

                  {(selectedPipeline.custom_fields || []).map(field => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-700"
                    >
                      <div>
                        <div className="text-white font-medium">{field.label}</div>
                        <div className="text-sm text-slate-400 mt-0.5">
                          Type: {field.field_type}
                          {field.required && <span className="ml-2 text-amber-400">(required)</span>}
                          {field.filterable && <span className="ml-2 text-cyan-400">(filterable)</span>}
                        </div>
                        {field.options && field.options.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {field.options.map((opt, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-600 rounded text-xs text-slate-300">
                                {opt}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteField(field.id)}
                        className="p-2 hover:bg-slate-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}

                  {showNewFieldForm ? (
                    <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-700 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Label</label>
                        <input
                          type="text"
                          value={newFieldForm.label}
                          onChange={(e) => setNewFieldForm({ ...newFieldForm, label: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                          placeholder="e.g., Lead Source"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Field Type</label>
                        <select
                          value={newFieldForm.field_type}
                          onChange={(e) => setNewFieldForm({
                            ...newFieldForm,
                            field_type: e.target.value as PipelineCustomField['field_type']
                          })}
                          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="dropdown">Dropdown</option>
                          <option value="multi_select">Multi Select</option>
                          <option value="boolean">Checkbox</option>
                        </select>
                      </div>

                      {(newFieldForm.field_type === 'dropdown' || newFieldForm.field_type === 'multi_select') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1.5">Options</label>
                          <div className="space-y-2">
                            {newFieldForm.options.map((opt, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="flex-1 px-3 py-2 bg-slate-600 rounded-lg text-sm text-white">{opt}</span>
                                <button
                                  onClick={() => removeOption(i)}
                                  className="p-2 hover:bg-slate-600 rounded-lg"
                                >
                                  <X className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newOption}
                                onChange={(e) => setNewOption(e.target.value)}
                                placeholder="Add option"
                                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && addOption()}
                              />
                              <button
                                onClick={addOption}
                                className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-500"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newFieldForm.required}
                            onChange={(e) => setNewFieldForm({ ...newFieldForm, required: e.target.checked })}
                            className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                          />
                          Required
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newFieldForm.filterable}
                            onChange={(e) => setNewFieldForm({ ...newFieldForm, filterable: e.target.checked })}
                            className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                          />
                          Filterable
                        </label>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={handleCreateField}
                          disabled={saving || !newFieldForm.label.trim()}
                          className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 disabled:opacity-50"
                        >
                          Create Field
                        </button>
                        <button
                          onClick={() => {
                            setShowNewFieldForm(false);
                            setNewFieldForm({
                              label: '',
                              field_key: '',
                              field_type: 'text',
                              required: false,
                              filterable: true,
                              options: []
                            });
                          }}
                          className="px-4 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewFieldForm(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Custom Field
                    </button>
                  )}
                </div>
              )}
            </div>

            {isDraftMode && (
              <div className="flex-none p-4 border-t border-slate-700 bg-slate-800/50">
                <div className="flex items-center justify-between max-w-2xl">
                  <div className="text-sm text-slate-400">
                    {draftPipeline.stages.length === 0 ? (
                      <span className="text-red-400">At least one stage is required</span>
                    ) : (
                      <span>{draftPipeline.stages.length} stage{draftPipeline.stages.length !== 1 ? 's' : ''} configured</span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancelDraft}
                      className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveDraft}
                      disabled={!canSaveDraft || saving}
                      className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Pipeline'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Columns className="w-16 h-16 mb-4 text-slate-600" />
            <p className="text-lg font-medium text-white">No Pipeline Selected</p>
            <p className="text-sm mt-1">Create a new pipeline or select one from the sidebar</p>
          </div>
        )}
      </div>

      {showUnsavedWarning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4 border border-slate-700">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-white">Unsaved Changes</h3>
                <p className="text-slate-400 mt-1">
                  You have an unsaved pipeline draft. What would you like to do?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSaveDraft}
                disabled={!canSaveDraft || saving}
                className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Pipeline'}
              </button>
              <button
                onClick={handleDiscardDraft}
                className="w-full px-4 py-2.5 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30"
              >
                Discard Changes
              </button>
              <button
                onClick={() => {
                  setShowUnsavedWarning(false);
                  setPendingAction(null);
                }}
                className="w-full px-4 py-2.5 text-slate-300 hover:bg-slate-700 rounded-lg"
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
