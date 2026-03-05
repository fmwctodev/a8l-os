import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Filter,
  X,
  ChevronDown,
  AlertTriangle,
  DollarSign,
  FolderKanban,
  CheckCircle2,
  Pause,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import type { ProjectPipeline, ProjectBoardData, ProjectFilters, ProjectStats, ProjectStage } from '../../types';
import { getProjectPipelines } from '../../services/projectPipelines';
import { getBoardData, getProjectStats, moveProjectToStage } from '../../services/projects';
import { ProjectCard } from '../../components/projects/ProjectCard';
import { CreateProjectModal } from '../../components/projects/CreateProjectModal';

export function Projects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = usePermission('projects.create');
  const canMoveStage = usePermission('projects.move_stage');

  const [pipelines, setPipelines] = useState<ProjectPipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [boardData, setBoardData] = useState<ProjectBoardData | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ProjectFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadPipelines();
  }, [user]);

  useEffect(() => {
    if (selectedPipelineId && user) {
      loadBoard();
    }
  }, [selectedPipelineId, filters, user]);

  async function loadPipelines() {
    if (!user) return;
    try {
      const data = await getProjectPipelines(user.organization_id);
      setPipelines(data);
      if (data.length > 0) {
        setSelectedPipelineId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadBoard() {
    if (!user || !selectedPipelineId) return;
    try {
      const [board, statsData] = await Promise.all([
        getBoardData(user.organization_id, selectedPipelineId, { ...filters, search: searchText || undefined }),
        getProjectStats(user.organization_id, { pipelineId: selectedPipelineId }),
      ]);
      setBoardData(board);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    }
  }

  const handleDragStart = useCallback((e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('text/plain', projectId);
    setDraggingProjectId(projectId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(stageId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStageId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(null);
    setDraggingProjectId(null);
    const projectId = e.dataTransfer.getData('text/plain');
    if (!projectId || !user) return;

    setBoardData((prev) => {
      if (!prev) return prev;
      let movedProject: ProjectBoardData['stages'][0]['projects'][0] | null = null;
      const updated = prev.stages.map((s) => {
        const without = s.projects.filter((p) => {
          if (p.id === projectId) { movedProject = p; return false; }
          return true;
        });
        return { ...s, projects: without };
      });
      if (movedProject) {
        return {
          ...prev,
          stages: updated.map((s) =>
            s.id === stageId ? { ...s, projects: [...s.projects, { ...movedProject!, stage_id: stageId }] } : s
          ),
        };
      }
      return prev;
    });

    try {
      await moveProjectToStage(projectId, stageId, user.id);
    } catch (err) {
      console.error(err);
      loadBoard();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center">
          <FolderKanban className="w-10 h-10 text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-white">No project pipelines yet</h2>
        <p className="text-slate-400 text-sm text-center max-w-md">
          Create a pipeline first to organize your project workflows into stages.
        </p>
        <button
          onClick={() => navigate('/projects/pipelines')}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm"
        >
          Go to Pipelines
        </button>
      </div>
    );
  }

  return (
    <div className="h-full min-w-0 flex flex-col">
      <div className="flex-none px-6 py-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadBoard()}
              placeholder="Search projects..."
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm w-56 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                showFilters
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            {canCreate && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            )}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-6 gap-3">
            <StatPill icon={Activity} label="Total" value={stats.totalProjects} color="text-white" />
            <StatPill icon={CheckCircle2} label="Active" value={stats.activeProjects} color="text-cyan-400" />
            <StatPill icon={CheckCircle2} label="Completed" value={stats.completedProjects} color="text-emerald-400" />
            <StatPill icon={Pause} label="On Hold" value={stats.onHoldProjects} color="text-amber-400" />
            <StatPill icon={AlertTriangle} label="Overdue" value={stats.overdueProjects} color="text-red-400" />
            <StatPill icon={DollarSign} label="Budget" value={`$${(stats.totalBudget / 1000).toFixed(0)}k`} color="text-emerald-400" />
          </div>
        )}

        {showFilters && (
          <FilterBar filters={filters} setFilters={setFilters} onClose={() => setShowFilters(false)} onApply={loadBoard} />
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto px-6 pb-6">
        <div className="flex gap-4 h-full min-w-max">
          {boardData?.stages.map((stage) => {
            const stageTotal = stage.projects.reduce((s, p) => s + Number(p.budget_amount || 0), 0);
            return (
              <div
                key={stage.id}
                className={`w-80 flex-shrink-0 flex flex-col rounded-xl transition-all ${
                  dragOverStageId === stage.id ? 'ring-2 ring-cyan-400 bg-cyan-500/5' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <div className="flex items-center justify-between px-3 py-2.5 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color || '#64748b' }}
                    />
                    <h3 className="text-sm font-medium text-white">{stage.name}</h3>
                    <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                      {stage.projects.length}
                    </span>
                  </div>
                  {stageTotal > 0 && (
                    <span className="text-xs text-slate-500">${stageTotal.toLocaleString()}</span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 px-1">
                  {stage.projects.map((project) => (
                    <div
                      key={project.id}
                      draggable={canMoveStage && project.status === 'active'}
                      onDragStart={(e) => handleDragStart(e, project.id)}
                    >
                      <ProjectCard
                        project={project}
                        stage={stage}
                        isDragging={draggingProjectId === project.id}
                      />
                    </div>
                  ))}
                  {stage.projects.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-xs text-slate-600">No projects</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => {
            setShowCreateModal(false);
            navigate(`/projects/${id}`);
          }}
        />
      )}
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <Icon className={`w-4 h-4 ${color}`} />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`text-sm font-semibold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function FilterBar({
  filters,
  setFilters,
  onClose,
  onApply,
}: {
  filters: ProjectFilters;
  setFilters: React.Dispatch<React.SetStateAction<ProjectFilters>>;
  onClose: () => void;
  onApply: () => void;
}) {
  const statuses = ['active', 'on_hold', 'completed', 'cancelled'] as const;

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="flex items-center gap-1">
        {statuses.map((s) => {
          const active = filters.status?.includes(s);
          return (
            <button
              key={s}
              onClick={() => {
                const current = filters.status || [];
                const next = active ? current.filter((x) => x !== s) : [...current, s];
                setFilters({ ...filters, status: next.length > 0 ? next : undefined });
              }}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors capitalize ${
                active ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => { onApply(); }}
        className="px-3 py-1 text-xs bg-cyan-600 text-white rounded-md hover:bg-cyan-700"
      >
        Apply
      </button>
      <button
        onClick={() => { setFilters({}); onClose(); }}
        className="p-1 text-slate-400 hover:text-white rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
