import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Target,
  Plus,
  Settings,
  List,
  LayoutGrid,
  ChevronDown,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import type {
  Pipeline,
  Opportunity,
  OpportunityFilters,
  OpportunityBoardData,
  User,
  Department
} from '../../types';
import * as pipelinesService from '../../services/pipelines';
import * as opportunitiesService from '../../services/opportunities';
import { getUsers } from '../../services/users';
import { getDepartments } from '../../services/departments';
import { PipelineManageModal } from '../../components/opportunities/PipelineManageModal';
import { OpportunityModal } from '../../components/opportunities/OpportunityModal';
import { OpportunityCard } from '../../components/opportunities/OpportunityCard';
import { BoardFilters } from '../../components/opportunities/BoardFilters';

export function Opportunities() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canManagePipelines = usePermission('pipelines.manage');
  const canCreate = usePermission('opportunities.create');

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [boardData, setBoardData] = useState<OpportunityBoardData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<OpportunityFilters>({});

  const [showPipelineDropdown, setShowPipelineDropdown] = useState(false);
  const [showManagePipelines, setShowManagePipelines] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [selectedStageForNew, setSelectedStageForNew] = useState<string | null>(null);

  const [draggedOpp, setDraggedOpp] = useState<Opportunity | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const viewMode = searchParams.get('view') || 'board';

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedPipeline) {
      loadBoardData();
    }
  }, [selectedPipeline?.id, filters]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPipelineDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadInitialData() {
    try {
      const [pipelinesData, usersData, departmentsData] = await Promise.all([
        pipelinesService.getPipelines(),
        getUsers(),
        getDepartments()
      ]);
      setPipelines(pipelinesData);
      setUsers(usersData);
      setDepartments(departmentsData);

      if (pipelinesData.length > 0) {
        const pipelineId = searchParams.get('pipeline');
        const pipeline = pipelineId
          ? pipelinesData.find(p => p.id === pipelineId)
          : pipelinesData[0];
        if (pipeline) {
          setSelectedPipeline(pipeline);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadBoardData() {
    if (!selectedPipeline) return;
    try {
      const data = await opportunitiesService.getBoardData(selectedPipeline.id, filters);
      setBoardData(data);
    } catch (error) {
      console.error('Failed to load board data:', error);
    }
  }

  function handlePipelineSelect(pipeline: Pipeline) {
    setSelectedPipeline(pipeline);
    setSearchParams({ pipeline: pipeline.id, view: viewMode });
    setShowPipelineDropdown(false);
  }

  function handleViewChange(view: 'board' | 'list') {
    setSearchParams({
      pipeline: selectedPipeline?.id || '',
      view
    });
  }

  function openNewOpportunityModal(stageId?: string) {
    setSelectedStageForNew(stageId || null);
    setShowOpportunityModal(true);
  }

  function openOpportunityDetail(opportunity: Opportunity) {
    navigate(`/opportunities/${opportunity.id}`);
  }

  function handleOpportunitySaved() {
    setShowOpportunityModal(false);
    setSelectedStageForNew(null);
    loadBoardData();
  }

  function handleDragStart(e: React.DragEvent, opportunity: Opportunity) {
    setDraggedOpp(opportunity);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    setDragOverStage(stageId);
  }

  function handleDragLeave() {
    setDragOverStage(null);
  }

  async function handleDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedOpp || draggedOpp.stage_id === stageId || !user) return;

    try {
      await opportunitiesService.moveOpportunityToStage(draggedOpp.id, stageId, user.id);
      loadBoardData();
    } catch (error) {
      console.error('Failed to move opportunity:', error);
    } finally {
      setDraggedOpp(null);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
          <Target className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">No Pipelines Yet</h2>
        <p className="text-slate-400 mb-6 max-w-md">
          Create your first pipeline to start tracking opportunities and managing your sales process.
        </p>
        {canManagePipelines && (
          <button
            onClick={() => setShowManagePipelines(true)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
          >
            Create Pipeline
          </button>
        )}
        {showManagePipelines && user && (
          <PipelineManageModal
            orgId={user.organization_id}
            onClose={() => {
              setShowManagePipelines(false);
              loadInitialData();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none p-4 border-b border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowPipelineDropdown(!showPipelineDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg text-white hover:bg-slate-600"
              >
                <Target className="w-4 h-4 text-cyan-400" />
                <span className="font-medium">{selectedPipeline?.name || 'Select Pipeline'}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showPipelineDropdown && (
                <div className="absolute z-30 top-full left-0 mt-1 w-64 bg-slate-700 border border-slate-600 rounded-lg shadow-xl">
                  {pipelines.map(pipeline => (
                    <button
                      key={pipeline.id}
                      onClick={() => handlePipelineSelect(pipeline)}
                      className={`w-full px-4 py-2 text-left hover:bg-slate-600 first:rounded-t-lg last:rounded-b-lg ${
                        selectedPipeline?.id === pipeline.id ? 'bg-cyan-500/20 text-cyan-400' : 'text-white'
                      }`}
                    >
                      {pipeline.name}
                    </button>
                  ))}
                  {canManagePipelines && (
                    <>
                      <div className="border-t border-slate-600" />
                      <button
                        onClick={() => {
                          setShowPipelineDropdown(false);
                          setShowManagePipelines(true);
                        }}
                        className="w-full px-4 py-2 text-left text-slate-400 hover:bg-slate-600 hover:text-white rounded-b-lg flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Manage Pipelines
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => handleViewChange('board')}
                className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm ${
                  viewMode === 'board'
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Board
              </button>
              <button
                onClick={() => handleViewChange('list')}
                className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm ${
                  viewMode === 'list'
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
            </div>

            <button
              onClick={() => loadBoardData()}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {canManagePipelines && (
              <button
                onClick={() => setShowManagePipelines(true)}
                className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700 rounded-lg"
              >
                <Settings className="w-4 h-4" />
                Manage
              </button>
            )}
            {canCreate && (
              <button
                onClick={() => openNewOpportunityModal()}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
              >
                <Plus className="w-4 h-4" />
                New Opportunity
              </button>
            )}
          </div>
        </div>

        <BoardFilters
          filters={filters}
          users={users}
          departments={departments}
          onFilterChange={setFilters}
        />
      </div>

      {viewMode === 'board' && boardData && (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full min-w-max">
            {boardData.stages.map(stage => {
              const stageValue = stage.opportunities.reduce(
                (sum, o) => sum + Number(o.value_amount),
                0
              );
              return (
                <div
                  key={stage.id}
                  className={`w-80 flex-shrink-0 flex flex-col bg-slate-800/50 rounded-lg transition-colors ${
                    dragOverStage === stage.id ? 'ring-2 ring-cyan-400' : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  <div className="flex-none p-3 border-b border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-white">{stage.name}</h3>
                      <span className="text-sm text-slate-400">
                        {stage.opportunities.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-emerald-400">
                      <DollarSign className="w-3.5 h-3.5" />
                      {formatCurrency(stageValue)}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
                    {stage.opportunities.map(opportunity => (
                      <div
                        key={opportunity.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, opportunity)}
                        onDragEnd={() => setDraggedOpp(null)}
                      >
                        <OpportunityCard
                          opportunity={opportunity}
                          onClick={() => openOpportunityDetail(opportunity)}
                          isDragging={draggedOpp?.id === opportunity.id}
                        />
                      </div>
                    ))}
                  </div>

                  {canCreate && (
                    <div className="flex-none p-2 border-t border-slate-700">
                      <button
                        onClick={() => openNewOpportunityModal(stage.id)}
                        className="w-full flex items-center justify-center gap-2 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <OpportunitiesList
          pipelineId={selectedPipeline?.id}
          filters={filters}
          onOpportunityClick={openOpportunityDetail}
        />
      )}

      {showManagePipelines && user && (
        <PipelineManageModal
          orgId={user.organization_id}
          onClose={() => {
            setShowManagePipelines(false);
            loadInitialData();
          }}
          onPipelineSelect={(pipeline) => {
            handlePipelineSelect(pipeline);
          }}
        />
      )}

      {showOpportunityModal && user && selectedPipeline && (
        <OpportunityModal
          pipeline={selectedPipeline}
          preselectedStageId={selectedStageForNew}
          orgId={user.organization_id}
          currentUser={user}
          onClose={() => {
            setShowOpportunityModal(false);
            setSelectedStageForNew(null);
          }}
          onSave={handleOpportunitySaved}
        />
      )}
    </div>
  );
}

function OpportunitiesList({
  pipelineId,
  filters,
  onOpportunityClick
}: {
  pipelineId?: string;
  filters: OpportunityFilters;
  onOpportunityClick: (opp: Opportunity) => void;
}) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    loadOpportunities();
  }, [pipelineId, filters, page]);

  async function loadOpportunities() {
    try {
      setLoading(true);
      const result = await opportunitiesService.getOpportunities(
        { ...filters, pipelineId },
        page,
        pageSize
      );
      setOpportunities(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load opportunities:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number, currency: string = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(amount);
  }

  function getStatusBadge(status: string) {
    const styles = {
      open: 'bg-cyan-500/20 text-cyan-400',
      won: 'bg-emerald-500/20 text-emerald-400',
      lost: 'bg-red-500/20 text-red-400'
    };
    return styles[status as keyof typeof styles] || styles.open;
  }

  if (loading && opportunities.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-700/50">
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Contact</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Pipeline</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Stage</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-slate-300">Value</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Assigned</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Created</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map(opp => (
              <tr
                key={opp.id}
                onClick={() => onOpportunityClick(opp)}
                className="border-t border-slate-700 hover:bg-slate-700/50 cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="text-white font-medium">
                    {opp.contact?.first_name} {opp.contact?.last_name}
                  </div>
                  <div className="text-sm text-slate-400">{opp.contact?.email}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">{opp.pipeline?.name}</td>
                <td className="px-4 py-3 text-slate-300">{opp.stage?.name}</td>
                <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                  {formatCurrency(Number(opp.value_amount), opp.currency)}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(opp.status)}`}>
                    {opp.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">{opp.assigned_user?.name || '-'}</td>
                <td className="px-4 py-3 text-slate-400 text-sm">
                  {new Date(opp.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {opportunities.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            No opportunities found
          </div>
        )}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-slate-400">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * pageSize >= total}
              className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
