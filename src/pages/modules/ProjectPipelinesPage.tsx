import { useState, useEffect } from 'react';
import {
  Plus,
  GripVertical,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Palette,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import type { ProjectPipeline, ProjectStage } from '../../types';
import * as pipelineService from '../../services/projectPipelines';

interface DraftStage {
  id: string;
  name: string;
  sla_days: number;
  color: string;
}

const DEFAULT_STAGES: DraftStage[] = [
  { id: 'draft-1', name: 'Kickoff', sla_days: 3, color: '#3b82f6' },
  { id: 'draft-2', name: 'In Progress', sla_days: 14, color: '#06b6d4' },
  { id: 'draft-3', name: 'Review', sla_days: 5, color: '#f59e0b' },
  { id: 'draft-4', name: 'QA', sla_days: 3, color: '#8b5cf6' },
  { id: 'draft-5', name: 'Delivered', sla_days: 0, color: '#10b981' },
];

const STAGE_COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export function ProjectPipelinesPage() {
  const { user } = useAuth();
  const canManage = usePermission('project_pipelines.manage');
  const [pipelines, setPipelines] = useState<ProjectPipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<ProjectPipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newStageName, setNewStageName] = useState('');
  const [newStageSla, setNewStageSla] = useState(0);
  const [newStageColor, setNewStageColor] = useState(STAGE_COLORS[0]);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [editStageSla, setEditStageSla] = useState(0);
  const [expandedPipelineId, setExpandedPipelineId] = useState<string | null>(null);
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);

  useEffect(() => {
    loadPipelines();
  }, [user]);

  async function loadPipelines() {
    if (!user) return;
    try {
      const data = await pipelineService.getProjectPipelines(user.organization_id);
      setPipelines(data);
      if (data.length > 0 && !selectedPipeline) {
        setSelectedPipeline(data[0]);
        setExpandedPipelineId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load pipelines:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePipeline() {
    if (!user || !newPipelineName.trim()) return;
    setSaving(true);
    try {
      const created = await pipelineService.createProjectPipelineWithStages(
        user.organization_id,
        newPipelineName.trim(),
        DEFAULT_STAGES.map((s) => ({ name: s.name, sla_days: s.sla_days, color: s.color }))
      );
      setPipelines((prev) => [...prev, created]);
      setSelectedPipeline(created);
      setExpandedPipelineId(created.id);
      setNewPipelineName('');
      setShowNewForm(false);
    } catch (err) {
      console.error('Failed to create pipeline:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePipeline(id: string) {
    if (!confirm('Delete this pipeline? All projects in it must be moved first.')) return;
    try {
      await pipelineService.deleteProjectPipeline(id);
      setPipelines((prev) => prev.filter((p) => p.id !== id));
      if (selectedPipeline?.id === id) setSelectedPipeline(null);
    } catch (err) {
      console.error('Failed to delete pipeline:', err);
    }
  }

  async function handleAddStage(pipelineId: string) {
    if (!user || !newStageName.trim()) return;
    try {
      const stage = await pipelineService.createProjectStage(
        user.organization_id,
        pipelineId,
        newStageName.trim(),
        newStageSla,
        newStageColor
      );
      setPipelines((prev) =>
        prev.map((p) =>
          p.id === pipelineId
            ? { ...p, stages: [...(p.stages || []), stage] }
            : p
        )
      );
      setNewStageName('');
      setNewStageSla(0);
      setNewStageColor(STAGE_COLORS[0]);
    } catch (err) {
      console.error('Failed to add stage:', err);
    }
  }

  async function handleUpdateStage(stageId: string) {
    if (!editStageName.trim()) return;
    try {
      const updated = await pipelineService.updateProjectStage(stageId, {
        name: editStageName.trim(),
        sla_days: editStageSla,
      });
      setPipelines((prev) =>
        prev.map((p) => ({
          ...p,
          stages: (p.stages || []).map((s) => (s.id === stageId ? updated : s)),
        }))
      );
      setEditingStageId(null);
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  }

  async function handleDeleteStage(stageId: string, pipelineId: string) {
    if (!confirm('Delete this stage?')) return;
    try {
      await pipelineService.deleteProjectStage(stageId);
      setPipelines((prev) =>
        prev.map((p) =>
          p.id === pipelineId
            ? { ...p, stages: (p.stages || []).filter((s) => s.id !== stageId) }
            : p
        )
      );
    } catch (err) {
      console.error('Failed to delete stage:', err);
    }
  }

  function handleDragStart(stageId: string) {
    setDraggedStageId(stageId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(targetStageId: string, pipelineId: string) {
    if (!draggedStageId || draggedStageId === targetStageId) return;
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    if (!pipeline?.stages) return;

    const stages = [...pipeline.stages];
    const dragIdx = stages.findIndex((s) => s.id === draggedStageId);
    const dropIdx = stages.findIndex((s) => s.id === targetStageId);
    if (dragIdx < 0 || dropIdx < 0) return;

    const [moved] = stages.splice(dragIdx, 1);
    stages.splice(dropIdx, 0, moved);

    setPipelines((prev) =>
      prev.map((p) => (p.id === pipelineId ? { ...p, stages } : p))
    );

    try {
      await pipelineService.reorderProjectStages(pipelineId, stages.map((s) => s.id));
    } catch (err) {
      console.error('Failed to reorder:', err);
      loadPipelines();
    }
    setDraggedStageId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Project Pipelines</h2>
            <p className="text-sm text-slate-400 mt-1">
              Define workflows and stages for your projects
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New Pipeline
            </button>
          )}
        </div>

        {showNewForm && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Create Pipeline</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="Pipeline name"
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePipeline()}
              />
              <button
                onClick={handleCreatePipeline}
                disabled={saving || !newPipelineName.trim()}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewPipelineName(''); }}
                className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Default stages will be created: {DEFAULT_STAGES.map((s) => s.name).join(', ')}
            </p>
          </div>
        )}

        {pipelines.length === 0 && !showNewForm && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Palette className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No pipelines yet</h3>
            <p className="text-slate-400 text-sm mb-4">Create your first project pipeline to organize project workflows.</p>
            {canManage && (
              <button
                onClick={() => setShowNewForm(true)}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm"
              >
                Create Pipeline
              </button>
            )}
          </div>
        )}

        {pipelines.map((pipeline) => {
          const isExpanded = expandedPipelineId === pipeline.id;
          const stages = pipeline.stages || [];

          return (
            <div
              key={pipeline.id}
              className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-750"
                onClick={() => setExpandedPipelineId(isExpanded ? null : pipeline.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                  <div>
                    <h3 className="text-white font-medium">{pipeline.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {stages.length} stage{stages.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePipeline(pipeline.id); }}
                    className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="border-t border-slate-700 p-5 space-y-3">
                  {stages.map((stage) => (
                    <div
                      key={stage.id}
                      draggable={canManage}
                      onDragStart={() => handleDragStart(stage.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(stage.id, pipeline.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 bg-slate-900/50 rounded-lg border border-slate-700/50 group ${
                        draggedStageId === stage.id ? 'opacity-50' : ''
                      }`}
                    >
                      {canManage && (
                        <GripVertical className="w-4 h-4 text-slate-600 cursor-grab" />
                      )}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.color || '#64748b' }}
                      />
                      {editingStageId === stage.id ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editStageName}
                            onChange={(e) => setEditStageName(e.target.value)}
                            className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateStage(stage.id)}
                          />
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <input
                              type="number"
                              value={editStageSla}
                              onChange={(e) => setEditStageSla(Number(e.target.value))}
                              className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                              min={0}
                            />
                            <span className="text-xs text-slate-500">days</span>
                          </div>
                          <button onClick={() => handleUpdateStage(stage.id)} className="p-1 text-emerald-400 hover:bg-slate-700 rounded">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingStageId(null)} className="p-1 text-slate-400 hover:bg-slate-700 rounded">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-white">{stage.name}</span>
                          {stage.sla_days > 0 && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              {stage.sla_days}d SLA
                            </span>
                          )}
                          {canManage && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingStageId(stage.id);
                                  setEditStageName(stage.name);
                                  setEditStageSla(stage.sla_days);
                                }}
                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStage(stage.id, pipeline.id)}
                                className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}

                  {canManage && (
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        placeholder="New stage name"
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddStage(pipeline.id)}
                      />
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <input
                          type="number"
                          value={newStageSla}
                          onChange={(e) => setNewStageSla(Number(e.target.value))}
                          className="w-16 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm"
                          placeholder="SLA"
                          min={0}
                        />
                      </div>
                      <div className="flex gap-1">
                        {STAGE_COLORS.slice(0, 4).map((c) => (
                          <button
                            key={c}
                            onClick={() => setNewStageColor(c)}
                            className={`w-6 h-6 rounded-full border-2 transition-colors ${
                              newStageColor === c ? 'border-white' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => handleAddStage(pipeline.id)}
                        disabled={!newStageName.trim()}
                        className="px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
