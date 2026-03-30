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
  RefreshCw,
  Filter,
  ArrowUpDown,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { useSidebar } from '../../contexts/SidebarContext';
import type {
  Pipeline,
  Opportunity,
  OpportunityFilters,
  OpportunityBoardData,
  OpportunityStats,
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
import { OpportunityFilterPanel } from '../../components/opportunities/OpportunityFilterPanel';
import { PipelineSummaryStrip } from '../../components/opportunities/PipelineSummaryStrip';

type SortOption = 'newest' | 'oldest' | 'highest_value' | 'lowest_value' | 'close_date';

export function Opportunities() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canManagePipelines = usePermission('pipelines.manage');
  const canCreate = usePermission('opportunities.create');
  const canMoveStage = usePermission('opportunities.move_stage');
  const { isMobile } = useSidebar();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [boardData, setBoardData] = useState<OpportunityBoardData | null>(null);
  const [stats, setStats] = useState<OpportunityStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<OpportunityFilters>({});

  const [showPipelineDropdown, setShowPipelineDropdown] = useState(false);
  const [showManagePipelines, setShowManagePipelines] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [selectedStageForNew, setSelectedStageForNew] = useState<string | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showTotals, setShowTotals] = useState(true);

  const [draggedOpp, setDraggedOpp] = useState<Opportunity | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const viewMode = searchParams.get('view') || (isMobile ? 'list' : 'board');

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'highest_value', label: 'Highest Value' },
    { value: 'lowest_value', label: 'Lowest Value' },
    { value: 'close_date', label: 'Close Date' }
  ];

  const activeFilterCount = [
    filters.status?.length,
    filters.assignedUserId !== undefined ? 1 : 0,
    filters.departmentId ? 1 : 0,
    filters.stageId ? 1 : 0,
    filters.minValue !== undefined ? 1 : 0,
    filters.maxValue !== undefined ? 1 : 0,
    filters.createdAfter ? 1 : 0,
    filters.createdBefore ? 1 : 0,
    filters.tagIds?.length,
    filters.search ? 1 : 0
  ].reduce((a, b) => a + (b || 0), 0);

  useEffect(() => {
    if (user?.organization_id) {
      loadInitialData();
    }
  }, [user?.organization_id]);

  useEffect(() => {
    if (selectedPipeline) {
      loadBoardData();
      loadStats();
    }
  }, [selectedPipeline?.id, filters]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPipelineDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadInitialData() {
    if (!user?.organization_id) return;
    try {
      const [pipelinesData, usersData, departmentsData] = await Promise.all([
        pipelinesService.getPipelines(),
        getUsers(),
        getDepartments(user.organization_id)
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
      setBoardData(sortBoardData(data, sortBy));
    } catch (error) {
      console.error('Failed to load board data:', error);
    }
  }

  async function loadStats() {
    if (!selectedPipeline) return;
    try {
      const statsData = await opportunitiesService.getOpportunityStats(selectedPipeline.id);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  function sortBoardData(data: OpportunityBoardData, sort: SortOption): OpportunityBoardData {
    const sortFn = (a: Opportunity, b: Opportunity) => {
      switch (sort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'highest_value':
          return Number(b.value_amount) - Number(a.value_amount);
        case 'lowest_value':
          return Number(a.value_amount) - Number(b.value_amount);
        case 'close_date':
          if (!a.close_date && !b.close_date) return 0;
          if (!a.close_date) return 1;
          if (!b.close_date) return -1;
          return new Date(a.close_date).getTime() - new Date(b.close_date).getTime();
        default:
          return 0;
      }
    };

    return {
      ...data,
      stages: data.stages.map(stage => ({
        ...stage,
        opportunities: [...stage.opportunities].sort(sortFn)
      }))
    };
  }

  function handleSortChange(sort: SortOption) {
    setSortBy(sort);
    if (boardData) {
      setBoardData(sortBoardData(boardData, sort));
    }
    setShowSortDropdown(false);
  }

  function handlePipelineSelect(pipeline: Pipeline) {
    setSelectedPipeline(pipeline);
    setSearchParams({ pipeline: pipeline.id, view: viewMode });
    setShowPipelineDropdown(false);
  }

  function handleViewChange(view: 'board' | 'list') {
    if (view === 'list') {
      navigate(`/opportunities/list${selectedPipeline ? `?pipeline=${selectedPipeline.id}` : ''}`);
    } else {
      setSearchParams({
        pipeline: selectedPipeline?.id || '',
        view
      });
    }
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
    loadStats();
  }

  function handleDragStart(e: React.DragEvent, opportunity: Opportunity) {
    if (opportunity.status !== 'open' || !canMoveStage) {
      e.preventDefault();
      return;
    }
    setDraggedOpp(opportunity);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    if (draggedOpp && draggedOpp.status === 'open') {
      setDragOverStage(stageId);
    }
  }

  function handleDragLeave() {
    setDragOverStage(null);
  }

  async function handleDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedOpp || draggedOpp.stage_id === stageId || !user) return;
    if (draggedOpp.status !== 'open') return;

    const previousStageId = draggedOpp.stage_id;

    if (boardData) {
      const updatedStages = boardData.stages.map(stage => {
        if (stage.id === previousStageId) {
          return {
            ...stage,
            opportunities: stage.opportunities.filter(o => o.id !== draggedOpp.id)
          };
        }
        if (stage.id === stageId) {
          return {
            ...stage,
            opportunities: [...stage.opportunities, { ...draggedOpp, stage_id: stageId }]
          };
        }
        return stage;
      });
      setBoardData({ ...boardData, stages: updatedStages });
    }

    try {
      await opportunitiesService.moveOpportunityToStage(draggedOpp.id, stageId, user.id);
    } catch (error) {
      console.error('Failed to move opportunity:', error);
      loadBoardData();
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
    <div className="h-full min-w-0 flex flex-col">
      <div className="flex-none p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
              onClick={() => setShowFilterPanel(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                activeFilterCount > 0
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 bg-cyan-500 text-white text-xs rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="relative" ref={sortDropdownRef}>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600"
              >
                <ArrowUpDown className="w-4 h-4" />
                Sort
              </button>
              {showSortDropdown && (
                <div className="absolute z-30 top-full left-0 mt-1 w-48 bg-slate-700 border border-slate-600 rounded-lg shadow-xl">
                  {sortOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleSortChange(opt.value)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-600 first:rounded-t-lg last:rounded-b-lg ${
                        sortBy === opt.value ? 'bg-cyan-500/20 text-cyan-400' : 'text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowTotals(!showTotals)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                showTotals
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
              }`}
              title="Toggle pipeline totals"
            >
              <BarChart3 className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                loadBoardData();
                loadStats();
              }}
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
      </div>

      {stats && <PipelineSummaryStrip stats={stats} isVisible={showTotals} />}

      {viewMode === 'board' && boardData && (
        <div className="flex-1 min-h-0 overflow-x-auto p-4">
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
                        draggable={opportunity.status === 'open' && canMoveStage}
                        onDragStart={(e) => handleDragStart(e, opportunity)}
                        onDragEnd={() => setDraggedOpp(null)}
                        className={opportunity.status !== 'open' || !canMoveStage ? 'cursor-not-allowed' : ''}
                      >
                        <OpportunityCard
                          opportunity={opportunity}
                          onClick={() => openOpportunityDetail(opportunity)}
                          isDragging={draggedOpp?.id === opportunity.id}
                          stage={stage}
                          canDrag={canMoveStage}
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

      <OpportunityFilterPanel
        isOpen={showFilterPanel}
        filters={filters}
        users={users}
        departments={departments}
        stages={boardData?.stages || []}
        onFilterChange={(newFilters) => {
          setFilters(newFilters);
          setShowFilterPanel(false);
        }}
        onClose={() => setShowFilterPanel(false)}
      />

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
