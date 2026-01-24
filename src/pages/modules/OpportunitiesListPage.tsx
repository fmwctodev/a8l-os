import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Target,
  Plus,
  Settings,
  List,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Filter,
  MoreHorizontal,
  ArrowUpDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import type {
  Pipeline,
  Opportunity,
  OpportunityFilters,
  OpportunityStats,
  PipelineStage,
  User,
  Department
} from '../../types';
import * as pipelinesService from '../../services/pipelines';
import * as opportunitiesService from '../../services/opportunities';
import { getUsers } from '../../services/users';
import { getDepartments } from '../../services/departments';
import { PipelineManageModal } from '../../components/opportunities/PipelineManageModal';
import { OpportunityModal } from '../../components/opportunities/OpportunityModal';
import { OpportunityFilterPanel } from '../../components/opportunities/OpportunityFilterPanel';
import { PipelineSummaryStrip } from '../../components/opportunities/PipelineSummaryStrip';
import { BulkActionsToolbar } from '../../components/opportunities/BulkActionsToolbar';
import { CloseLostModal } from '../../components/opportunities/CloseLostModal';

type SortField = 'contact' | 'pipeline' | 'stage' | 'value' | 'status' | 'assigned' | 'created' | 'updated';
type SortDirection = 'asc' | 'desc';

export function OpportunitiesListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const canManagePipelines = usePermission('pipelines.manage');
  const canCreate = usePermission('opportunities.create');
  const canClose = usePermission('opportunities.close');
  const canMoveStage = usePermission('opportunities.move_stage');

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<OpportunityStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<OpportunityFilters>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  const [showPipelineDropdown, setShowPipelineDropdown] = useState(false);
  const [showManagePipelines, setShowManagePipelines] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showTotals, setShowTotals] = useState(true);

  const [sortField, setSortField] = useState<SortField>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionsMenuId, setActionsMenuId] = useState<string | null>(null);
  const [closeLostOpp, setCloseLostOpp] = useState<Opportunity | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

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
      loadOpportunities();
      loadStats();
    }
  }, [selectedPipeline?.id, filters, page, sortField, sortDirection]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPipelineDropdown(false);
      }
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setActionsMenuId(null);
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
          setStages(pipeline.stages || []);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOpportunities() {
    if (!selectedPipeline) return;
    try {
      const result = await opportunitiesService.getOpportunities(
        { ...filters, pipelineId: selectedPipeline.id },
        page,
        pageSize
      );

      const sorted = sortOpportunities(result.data, sortField, sortDirection);
      setOpportunities(sorted);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load opportunities:', error);
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

  function sortOpportunities(data: Opportunity[], field: SortField, direction: SortDirection): Opportunity[] {
    return [...data].sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case 'contact':
          const aName = a.contact ? `${a.contact.first_name} ${a.contact.last_name}` : '';
          const bName = b.contact ? `${b.contact.first_name} ${b.contact.last_name}` : '';
          comparison = aName.localeCompare(bName);
          break;
        case 'pipeline':
          comparison = (a.pipeline?.name || '').localeCompare(b.pipeline?.name || '');
          break;
        case 'stage':
          comparison = (a.stage?.name || '').localeCompare(b.stage?.name || '');
          break;
        case 'value':
          comparison = Number(a.value_amount) - Number(b.value_amount);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'assigned':
          comparison = (a.assigned_user?.name || '').localeCompare(b.assigned_user?.name || '');
          break;
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'updated':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function handlePipelineSelect(pipeline: Pipeline) {
    setSelectedPipeline(pipeline);
    setStages(pipeline.stages || []);
    setShowPipelineDropdown(false);
    setPage(1);
    setSelectedIds(new Set());
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(opportunities.map(o => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleSelectOne(id: string, checked: boolean) {
    const newIds = new Set(selectedIds);
    if (checked) {
      newIds.add(id);
    } else {
      newIds.delete(id);
    }
    setSelectedIds(newIds);
  }

  async function handleBulkAssignOwner(userId: string | null) {
    if (!user || selectedIds.size === 0) return;
    try {
      await opportunitiesService.bulkAssignOwner(Array.from(selectedIds), userId, user.id);
      loadOpportunities();
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to bulk assign:', error);
    }
  }

  async function handleBulkChangeStage(stageId: string) {
    if (!user || selectedIds.size === 0) return;
    try {
      await opportunitiesService.bulkChangeStage(Array.from(selectedIds), stageId, user.id);
      loadOpportunities();
      loadStats();
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to bulk change stage:', error);
    }
  }

  async function handleBulkMarkWon() {
    if (!user || selectedIds.size === 0) return;
    try {
      await opportunitiesService.bulkClose(Array.from(selectedIds), 'won', user.id);
      loadOpportunities();
      loadStats();
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to bulk mark won:', error);
    }
  }

  function handleBulkMarkLost() {
    const selected = opportunities.filter(o => selectedIds.has(o.id) && o.status === 'open');
    if (selected.length > 0) {
      setCloseLostOpp(selected[0]);
    }
  }

  async function handleBulkExport() {
    try {
      const csv = await opportunitiesService.exportOpportunitiesToCSV({
        ...filters,
        pipelineId: selectedPipeline?.id
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opportunities-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  }

  async function handleCloseLostConfirm(lostReasonId: string, lostReasonText: string) {
    if (!user || !closeLostOpp) return;
    try {
      if (selectedIds.size > 1) {
        await opportunitiesService.bulkClose(
          Array.from(selectedIds),
          'lost',
          user.id,
          lostReasonId,
          lostReasonText
        );
        setSelectedIds(new Set());
      } else {
        await opportunitiesService.closeOpportunity(
          closeLostOpp.id,
          'lost',
          user.id,
          lostReasonId,
          lostReasonText
        );
      }
      loadOpportunities();
      loadStats();
      setCloseLostOpp(null);
    } catch (error) {
      console.error('Failed to close as lost:', error);
    }
  }

  async function handleSingleAction(opp: Opportunity, action: string) {
    if (!user) return;
    setActionsMenuId(null);

    switch (action) {
      case 'view':
        navigate(`/opportunities/${opp.id}`);
        break;
      case 'won':
        await opportunitiesService.closeOpportunity(opp.id, 'won', user.id);
        loadOpportunities();
        loadStats();
        break;
      case 'lost':
        setCloseLostOpp(opp);
        break;
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

  function SortableHeader({ field, label }: { field: SortField; label: string }) {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className="text-left px-4 py-3 text-sm font-medium text-slate-300 cursor-pointer hover:text-white"
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive ? (
            sortDirection === 'asc' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-50" />
          )}
        </div>
      </th>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
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
                onClick={() => navigate(`/opportunities${selectedPipeline ? `?pipeline=${selectedPipeline.id}` : ''}`)}
                className="px-3 py-1.5 rounded flex items-center gap-2 text-sm text-slate-400 hover:text-white"
              >
                <LayoutGrid className="w-4 h-4" />
                Board
              </button>
              <button
                className="px-3 py-1.5 rounded flex items-center gap-2 text-sm bg-slate-600 text-white"
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

            <button
              onClick={() => {
                loadOpportunities();
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
                onClick={() => setShowOpportunityModal(true)}
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

      <div className="flex-1 overflow-auto p-4">
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-700/95 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === opportunities.length && opportunities.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded bg-slate-600 border-slate-500"
                  />
                </th>
                <SortableHeader field="contact" label="Contact" />
                <SortableHeader field="pipeline" label="Pipeline" />
                <SortableHeader field="stage" label="Stage" />
                <SortableHeader field="value" label="Value" />
                <SortableHeader field="status" label="Status" />
                <SortableHeader field="assigned" label="Assigned" />
                <SortableHeader field="updated" label="Last Updated" />
                <th className="w-12 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map(opp => (
                <tr
                  key={opp.id}
                  className="border-t border-slate-700 hover:bg-slate-700/50"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(opp.id)}
                      onChange={(e) => handleSelectOne(opp.id, e.target.checked)}
                      className="rounded bg-slate-600 border-slate-500"
                    />
                  </td>
                  <td
                    className="px-4 py-3 cursor-pointer"
                    onClick={() => navigate(`/opportunities/${opp.id}`)}
                  >
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
                    <span className={`px-2 py-1 rounded text-xs capitalize ${getStatusBadge(opp.status)}`}>
                      {opp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{opp.assigned_user?.name || '-'}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {new Date(opp.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionsMenuId(actionsMenuId === opp.id ? null : opp.id);
                      }}
                      className="p-1 hover:bg-slate-600 rounded"
                    >
                      <MoreHorizontal className="w-4 h-4 text-slate-400" />
                    </button>
                    {actionsMenuId === opp.id && (
                      <div
                        ref={actionsMenuRef}
                        className="absolute right-0 top-full mt-1 w-40 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-20"
                      >
                        <button
                          onClick={() => handleSingleAction(opp, 'view')}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-slate-600 rounded-t-lg"
                        >
                          View Details
                        </button>
                        {canClose && opp.status === 'open' && (
                          <>
                            <button
                              onClick={() => handleSingleAction(opp, 'won')}
                              className="w-full px-3 py-2 text-left text-sm text-emerald-400 hover:bg-slate-600"
                            >
                              Mark Won
                            </button>
                            <button
                              onClick={() => handleSingleAction(opp, 'lost')}
                              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-600 rounded-b-lg"
                            >
                              Mark Lost
                            </button>
                          </>
                        )}
                      </div>
                    )}
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

      <BulkActionsToolbar
        selectedCount={selectedIds.size}
        users={users}
        stages={stages}
        onClearSelection={() => setSelectedIds(new Set())}
        onAssignOwner={handleBulkAssignOwner}
        onChangeStage={handleBulkChangeStage}
        onMarkWon={handleBulkMarkWon}
        onMarkLost={handleBulkMarkLost}
        onExport={handleBulkExport}
        canClose={canClose}
        canMove={canMoveStage}
      />

      <OpportunityFilterPanel
        isOpen={showFilterPanel}
        filters={filters}
        users={users}
        departments={departments}
        stages={stages}
        onFilterChange={(newFilters) => {
          setFilters(newFilters);
          setShowFilterPanel(false);
          setPage(1);
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
          orgId={user.organization_id}
          currentUser={user}
          onClose={() => setShowOpportunityModal(false)}
          onSave={() => {
            setShowOpportunityModal(false);
            loadOpportunities();
            loadStats();
          }}
        />
      )}

      {closeLostOpp && (
        <CloseLostModal
          opportunity={closeLostOpp}
          onClose={() => setCloseLostOpp(null)}
          onConfirm={handleCloseLostConfirm}
        />
      )}
    </div>
  );
}
