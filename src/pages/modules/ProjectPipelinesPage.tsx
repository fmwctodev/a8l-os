import { useState, useEffect } from 'react';
import { Plus, GripVertical, Trash2, CreditCard as Edit2, Check, X, Clock, Layers } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import type { ProjectPipeline, ProjectStage } from '../../types';
import * as pipelineService from '../../services/projectPipelines';

const STAGE_COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#f97316', '#64748b'];

export function ProjectPipelinesPage() {
  const { user } = useAuth();
  const canManage = usePermission('project_pipelines.manage');
  const [pipeline, setPipeline] = useState<ProjectPipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [newStageName, setNewStageName] = useState('');
  const [newStageSla, setNewStageSla] = useState(0);
  const [newStageColor, setNewStageColor] = useState(STAGE_COLORS[0]);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [editStageSla, setEditStageSla] = useState(0);
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);

  useEffect(() => {
    loadPipeline();
  }, [user]);

  async function loadPipeline() {
    if (!user) return;
    try {
      const data = await pipelineService.getProjectPipelines(user.organization_id);
      if (data.length > 0) setPipeline(data[0]);
    } catch (err) {
      console.error('Failed to load pipeline:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStage() {
    if (!user || !pipeline || !newStageName.trim()) return;
    try {
      const stage = await pipelineService.createProjectStage(
        user.organization_id,
        pipeline.id,
        newStageName.trim(),
        newStageSla,
        newStageColor
      );
      setPipeline((prev) =>
        prev ? { ...prev, stages: [...(prev.stages || []), stage] } : prev
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
      setPipeline((prev) =>
        prev
          ? { ...prev, stages: (prev.stages || []).map((s) => (s.id === stageId ? updated : s)) }
          : prev
      );
      setEditingStageId(null);
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  }

  async function handleDeleteStage(stageId: string) {
    if (!confirm('Delete this stage?')) return;
    try {
      await pipelineService.deleteProjectStage(stageId);
      setPipeline((prev) =>
        prev
          ? { ...prev, stages: (prev.stages || []).filter((s) => s.id !== stageId) }
          : prev
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

  async function handleDrop(targetStageId: string) {
    if (!pipeline || !draggedStageId || draggedStageId === targetStageId) return;

    const stages = [...(pipeline.stages || [])];
    const dragIdx = stages.findIndex((s) => s.id === draggedStageId);
    const dropIdx = stages.findIndex((s) => s.id === targetStageId);
    if (dragIdx < 0 || dropIdx < 0) return;

    const [moved] = stages.splice(dragIdx, 1);
    stages.splice(dropIdx, 0, moved);

    setPipeline((prev) => (prev ? { ...prev, stages } : prev));

    try {
      await pipelineService.reorderProjectStages(pipeline.id, stages.map((s) => s.id));
    } catch (err) {
      console.error('Failed to reorder:', err);
      loadPipeline();
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

  const stages: ProjectStage[] = pipeline?.stages || [];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Project Pipeline</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage the stages projects move through from kickoff to completion.
          </p>
        </div>

        {!pipeline ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No pipeline configured</h3>
            <p className="text-slate-400 text-sm">Contact your administrator to set up the project pipeline.</p>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div>
                <h3 className="text-white font-medium">{pipeline.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {stages.length} stage{stages.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="p-5 space-y-2">
              {stages.map((stage) => (
                <div
                  key={stage.id}
                  draggable={canManage}
                  onDragStart={() => handleDragStart(stage.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(stage.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 bg-slate-900/50 rounded-lg border border-slate-700/50 group ${
                    draggedStageId === stage.id ? 'opacity-50' : ''
                  }`}
                >
                  {canManage && (
                    <GripVertical className="w-4 h-4 text-slate-600 cursor-grab flex-shrink-0" />
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
                        className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateStage(stage.id)}
                        autoFocus
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
                      <button
                        onClick={() => handleUpdateStage(stage.id)}
                        className="p-1 text-emerald-400 hover:bg-slate-700 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingStageId(null)}
                        className="p-1 text-slate-400 hover:bg-slate-700 rounded"
                      >
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
                            onClick={() => handleDeleteStage(stage.id)}
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
                <div className="flex items-center gap-2 pt-3 border-t border-slate-700/50 mt-3">
                  <input
                    type="text"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder="New stage name"
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
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
                    onClick={handleAddStage}
                    disabled={!newStageName.trim()}
                    className="px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm disabled:opacity-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
