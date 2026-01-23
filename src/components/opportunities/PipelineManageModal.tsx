import { useState, useEffect } from 'react';
import {
  X,
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
  Save
} from 'lucide-react';
import type { Pipeline, PipelineStage, PipelineCustomField, Department } from '../../types';
import * as pipelinesService from '../../services/pipelines';
import { getDepartments } from '../../services/departments';

interface PipelineManageModalProps {
  orgId: string;
  onClose: () => void;
  onPipelineSelect?: (pipeline: Pipeline) => void;
}

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

export function PipelineManageModal({ orgId, onClose, onPipelineSelect }: PipelineManageModalProps) {
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
    if (!draftPipeline || !canSaveDraft) return;
    setSaving(true);
    try {
      const pipeline = await pipelinesService.createPipelineWithStages({
        org_id: orgId,
        name: draftPipeline.name,
        stages: draftPipeline.stages.map(s => ({
          name: s.name,
          aging_threshold_days: s.aging_threshold_days
        }))
      });
      setPipelines([...pipelines, pipeline]);
      setDraftPipeline(null);
      setSelectedPipeline(pipeline);
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
    if (!newStageName.trim() || !selectedPipeline) return;
    setSaving(true);
    try {
      const stage = await pipelinesService.createStage({
        org_id: orgId,
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
    if (!newFieldForm.label.trim() || !selectedPipeline) return;
    setSaving(true);
    try {
      const field = await pipelinesService.createCustomField({
        org_id: orgId,
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

  function handleCloseAttempt() {
    if (isDraftMode) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }

  function handleDiscardAndClose() {
    setShowUnsavedWarning(false);
    setDraftPipeline(null);
    onClose();
  }

  function handleDiscardAndSelect(pipeline: Pipeline) {
    setShowUnsavedWarning(false);
    setDraftPipeline(null);
    pipelinesService.getPipelineById(pipeline.id).then(fullPipeline => {
      if (fullPipeline) {
        setSelectedPipeline(fullPipeline);
      }
    });
  }

  const currentStages = isDraftMode ? draftPipeline.stages : (selectedPipeline?.stages || []);
  const currentName = isDraftMode ? draftPipeline.name : selectedPipeline?.name;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-xl p-8">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Manage Pipelines</h2>
          <button onClick={handleCloseAttempt} className="p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-slate-700 p-4 overflow-y-auto">
            <div className="space-y-2">
              {pipelines.map(pipeline => (
                <div
                  key={pipeline.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer group ${
                    !isDraftMode && selectedPipeline?.id === pipeline.id
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'hover:bg-slate-700 text-slate-300'
                  }`}
                  onClick={() => isDraftMode ? setShowUnsavedWarning(true) : selectPipeline(pipeline)}
                >
                  <span className="truncate">{pipeline.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePipeline(pipeline.id);
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-600 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}

              {isDraftMode && (
                <div className="flex items-center justify-between p-2 rounded bg-amber-500/20 text-amber-400">
                  <span className="truncate flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {draftPipeline.name}
                    <span className="text-xs bg-amber-500/30 px-1.5 py-0.5 rounded">Draft</span>
                  </span>
                </div>
              )}
            </div>

            {showNewPipelineForm ? (
              <div className="mt-4 space-y-2">
                <input
                  type="text"
                  value={newPipelineName}
                  onChange={(e) => setNewPipelineName(e.target.value)}
                  placeholder="Pipeline name"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateDraft()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateDraft}
                    disabled={!newPipelineName.trim()}
                    className="flex-1 px-3 py-1.5 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 disabled:opacity-50"
                  >
                    Continue
                  </button>
                  <button
                    onClick={() => {
                      setShowNewPipelineForm(false);
                      setNewPipelineName('');
                    }}
                    className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleStartNewPipeline}
                disabled={isDraftMode}
                className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                New Pipeline
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {(selectedPipeline || isDraftMode) ? (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-white">{currentName}</h3>
                      {isDraftMode && (
                        <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">
                          Unsaved Draft
                        </span>
                      )}
                    </div>
                    {!isDraftMode && onPipelineSelect && selectedPipeline && (
                      <button
                        onClick={() => {
                          onPipelineSelect(selectedPipeline);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700"
                      >
                        Select Pipeline
                      </button>
                    )}
                  </div>

                  {isDraftMode && (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
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

                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setActiveTab('stages')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
                        activeTab === 'stages'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <Columns className="w-4 h-4" />
                      Stages
                      {isDraftMode && (
                        <span className="text-xs bg-slate-600 px-1.5 py-0.5 rounded">
                          {draftPipeline.stages.length}
                        </span>
                      )}
                    </button>
                    {!isDraftMode && (
                      <button
                        onClick={() => setActiveTab('fields')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
                          activeTab === 'fields'
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        <Settings className="w-4 h-4" />
                        Custom Fields
                      </button>
                    )}
                  </div>

                  {activeTab === 'stages' && (
                    <div className="space-y-2">
                      {currentStages.map((stage, index) => (
                        <div key={stage.id} className="bg-slate-700/50 rounded">
                          <div className="flex items-center gap-2 p-3 group">
                            <GripVertical className="w-4 h-4 text-slate-500" />
                            {editingStageId === stage.id ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingStageName}
                                  onChange={(e) => setEditingStageName(e.target.value)}
                                  className="flex-1 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      isDraftMode
                                        ? handleUpdateDraftStage(stage.id, editingStageName)
                                        : handleUpdateStage(stage.id, editingStageName);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => isDraftMode
                                    ? handleUpdateDraftStage(stage.id, editingStageName)
                                    : handleUpdateStage(stage.id, editingStageName)
                                  }
                                  className="p-1 hover:bg-slate-600 rounded"
                                >
                                  <Check className="w-4 h-4 text-emerald-400" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingStageId(null);
                                    setEditingStageName('');
                                  }}
                                  className="p-1 hover:bg-slate-600 rounded"
                                >
                                  <X className="w-4 h-4 text-slate-400" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1">
                                  <span className="text-white">{stage.name}</span>
                                  {stage.aging_threshold_days && (
                                    <span className="ml-2 text-xs text-amber-400">
                                      <Clock className="w-3 h-3 inline mr-1" />
                                      {stage.aging_threshold_days}d
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                  <button
                                    onClick={() => setExpandedStageId(expandedStageId === stage.id ? null : stage.id)}
                                    className={`p-1 hover:bg-slate-600 rounded ${expandedStageId === stage.id ? 'bg-slate-600' : ''}`}
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
                                    className="p-1 hover:bg-slate-600 rounded disabled:opacity-30"
                                  >
                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                  </button>
                                  <button
                                    onClick={() => isDraftMode
                                      ? handleMoveDraftStage(stage.id, 'down')
                                      : handleMoveStage(stage.id, 'down')
                                    }
                                    disabled={index === currentStages.length - 1}
                                    className="p-1 hover:bg-slate-600 rounded disabled:opacity-30"
                                  >
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingStageId(stage.id);
                                      setEditingStageName(stage.name);
                                    }}
                                    className="p-1 hover:bg-slate-600 rounded"
                                  >
                                    <Edit2 className="w-4 h-4 text-slate-400" />
                                  </button>
                                  <button
                                    onClick={() => isDraftMode
                                      ? handleDeleteDraftStage(stage.id)
                                      : handleDeleteStage(stage.id)
                                    }
                                    disabled={isDraftMode && draftPipeline.stages.length <= 1}
                                    className="p-1 hover:bg-slate-600 rounded disabled:opacity-30"
                                    title={isDraftMode && draftPipeline.stages.length <= 1 ? 'At least one stage is required' : ''}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          {expandedStageId === stage.id && (
                            <div className="px-3 pb-3 pt-1 border-t border-slate-600">
                              <div className="flex items-center gap-3">
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
                                  className="w-24 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
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
                              <p className="text-xs text-slate-500 mt-1">
                                Opportunities in this stage longer than this will show an aging warning
                              </p>
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="flex items-center gap-2 mt-4">
                        <input
                          type="text"
                          value={newStageName}
                          onChange={(e) => setNewStageName(e.target.value)}
                          placeholder="New stage name"
                          className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              isDraftMode ? handleAddDraftStage() : handleCreateStage();
                            }
                          }}
                        />
                        <button
                          onClick={isDraftMode ? handleAddDraftStage : handleCreateStage}
                          disabled={saving || !newStageName.trim()}
                          className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'fields' && !isDraftMode && selectedPipeline && (
                    <div className="space-y-3">
                      {(selectedPipeline.custom_fields || []).map(field => (
                        <div
                          key={field.id}
                          className="flex items-center justify-between p-3 bg-slate-700/50 rounded"
                        >
                          <div>
                            <div className="text-white font-medium">{field.label}</div>
                            <div className="text-sm text-slate-400">
                              {field.field_type} {field.required && '(required)'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteField(field.id)}
                            className="p-1 hover:bg-slate-600 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      ))}

                      {showNewFieldForm ? (
                        <div className="p-4 bg-slate-700/50 rounded space-y-3">
                          <div>
                            <label className="block text-sm text-slate-400 mb-1">Label</label>
                            <input
                              type="text"
                              value={newFieldForm.label}
                              onChange={(e) => setNewFieldForm({ ...newFieldForm, label: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-400 mb-1">Type</label>
                            <select
                              value={newFieldForm.field_type}
                              onChange={(e) => setNewFieldForm({
                                ...newFieldForm,
                                field_type: e.target.value as PipelineCustomField['field_type']
                              })}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
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
                              <label className="block text-sm text-slate-400 mb-1">Options</label>
                              <div className="space-y-2">
                                {newFieldForm.options.map((opt, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className="flex-1 px-3 py-1.5 bg-slate-600 rounded text-sm text-white">{opt}</span>
                                    <button
                                      onClick={() => removeOption(i)}
                                      className="p-1 hover:bg-slate-600 rounded"
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
                                    className="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && addOption()}
                                  />
                                  <button
                                    onClick={addOption}
                                    className="px-3 py-1.5 bg-slate-600 text-white rounded text-sm"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-slate-300">
                              <input
                                type="checkbox"
                                checked={newFieldForm.required}
                                onChange={(e) => setNewFieldForm({ ...newFieldForm, required: e.target.checked })}
                                className="rounded bg-slate-700 border-slate-600"
                              />
                              Required
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-300">
                              <input
                                type="checkbox"
                                checked={newFieldForm.filterable}
                                onChange={(e) => setNewFieldForm({ ...newFieldForm, filterable: e.target.checked })}
                                className="rounded bg-slate-700 border-slate-600"
                              />
                              Filterable
                            </label>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={handleCreateField}
                              disabled={saving || !newFieldForm.label.trim()}
                              className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50"
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
                              className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowNewFieldForm(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
                        >
                          <Plus className="w-4 h-4" />
                          Add Custom Field
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isDraftMode && (
                  <div className="flex-none p-4 border-t border-slate-700 bg-slate-800/80">
                    <div className="flex items-center justify-between">
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
                          className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveDraft}
                          disabled={!canSaveDraft || saving}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <p>No pipeline selected</p>
                <p className="text-sm">Create a pipeline to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showUnsavedWarning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
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
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Pipeline'}
              </button>
              <button
                onClick={handleDiscardAndClose}
                className="w-full px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded hover:bg-red-600/30"
              >
                Discard Changes
              </button>
              <button
                onClick={() => setShowUnsavedWarning(false)}
                className="w-full px-4 py-2 text-slate-300 hover:bg-slate-700 rounded"
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
