import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getWorkflows,
  getWorkflowStats,
  archiveWorkflow,
  duplicateWorkflow,
} from '../../services/workflows';
import { TRIGGER_TYPE_LABELS } from '../../services/workflowEngine';
import type { Workflow, WorkflowStatus, WorkflowFilters } from '../../types';
import {
  Search,
  Plus,
  Filter,
  Loader2,
  AlertCircle,
  Workflow as WorkflowIcon,
  MoreVertical,
  Play,
  Copy,
  Archive,
  Users,
  Zap,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { CreateWorkflowModal } from '../../components/automation/CreateWorkflowModal';

const STATUS_STYLES: Record<WorkflowStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Draft' },
  published: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Published' },
  archived: { bg: 'bg-slate-500/10', text: 'text-slate-400', label: 'Archived' },
};

export function Automation() {
  const { user: currentUser, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0, activeEnrollments: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const canManage = hasPermission('automation.manage');

  const loadData = useCallback(async () => {
    if (!currentUser?.organization_id) return;

    try {
      setIsLoading(true);
      setError(null);

      const filters: WorkflowFilters = {
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? [statusFilter] : undefined,
      };

      const [workflowsData, statsData] = await Promise.all([
        getWorkflows(currentUser.organization_id, filters),
        getWorkflowStats(currentUser.organization_id),
      ]);

      setWorkflows(workflowsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.organization_id, searchQuery, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleArchive = async (id: string) => {
    if (!confirm('Are you sure you want to archive this workflow?')) return;

    try {
      await archiveWorkflow(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive workflow');
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!currentUser) return;

    try {
      const newWorkflow = await duplicateWorkflow(id, currentUser.id);
      navigate(`/automation/${newWorkflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate workflow');
    }
  };

  const getTriggerLabel = (workflow: Workflow): string => {
    const triggers = workflow.triggers || [];
    if (triggers.length === 0) return 'No trigger';
    if (triggers.length === 1) {
      return TRIGGER_TYPE_LABELS[triggers[0].trigger_type] || triggers[0].trigger_type;
    }
    return `${triggers.length} triggers`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">Error loading workflows</p>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Automation</h1>
          <p className="text-slate-400 mt-1">
            Build workflows to automate your business processes
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <WorkflowIcon className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.total}</p>
              <p className="text-sm text-slate-400">Total Workflows</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Play className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.published}</p>
              <p className="text-sm text-slate-400">Published</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.draft}</p>
              <p className="text-sm text-slate-400">Drafts</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.activeEnrollments}</p>
              <p className="text-sm text-slate-400">Active Enrollments</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Filter className="w-4 h-4" />
                {statusFilter === 'all' ? 'All Status' : STATUS_STYLES[statusFilter].label}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showStatusDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowStatusDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                    <button
                      onClick={() => {
                        setStatusFilter('all');
                        setShowStatusDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700"
                    >
                      All Status
                    </button>
                    <button
                      onClick={() => {
                        setStatusFilter('published');
                        setShowStatusDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-emerald-400 hover:bg-slate-700"
                    >
                      Published
                    </button>
                    <button
                      onClick={() => {
                        setStatusFilter('draft');
                        setShowStatusDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-amber-400 hover:bg-slate-700"
                    >
                      Draft
                    </button>
                    <button
                      onClick={() => {
                        setStatusFilter('archived');
                        setShowStatusDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-400 hover:bg-slate-700"
                    >
                      Archived
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="p-4 hover:bg-slate-800/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/automation/${workflow.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white">{workflow.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[workflow.status].bg} ${STATUS_STYLES[workflow.status].text}`}
                      >
                        {STATUS_STYLES[workflow.status].label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {getTriggerLabel(workflow)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      {workflow.active_enrollment_count || 0}
                    </p>
                    <p className="text-xs text-slate-400">Active</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      {workflow.enrollment_count || 0}
                    </p>
                    <p className="text-xs text-slate-400">Total</p>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-xs text-slate-400">
                      {workflow.published_at
                        ? `Published ${new Date(workflow.published_at).toLocaleDateString()}`
                        : 'Not published'}
                    </p>
                  </div>

                  {canManage && (
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() =>
                          setActiveDropdown(activeDropdown === workflow.id ? null : workflow.id)
                        }
                        className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                      {activeDropdown === workflow.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActiveDropdown(null)}
                          />
                          <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                            <button
                              onClick={() => {
                                navigate(`/automation/${workflow.id}`);
                                setActiveDropdown(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                            >
                              <WorkflowIcon className="w-4 h-4" />
                              Edit Workflow
                            </button>
                            <button
                              onClick={() => {
                                navigate(`/automation/${workflow.id}/enrollments`);
                                setActiveDropdown(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Users className="w-4 h-4" />
                              View Enrollments
                            </button>
                            <button
                              onClick={() => {
                                handleDuplicate(workflow.id);
                                setActiveDropdown(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Copy className="w-4 h-4" />
                              Duplicate
                            </button>
                            {workflow.status !== 'archived' && (
                              <button
                                onClick={() => {
                                  handleArchive(workflow.id);
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Archive className="w-4 h-4" />
                                Archive
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {workflows.length === 0 && (
            <div className="p-12 text-center">
              <WorkflowIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No workflows found</p>
              <p className="text-slate-400 text-sm mb-6">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first automation workflow'}
              </p>
              {canManage && !searchQuery && statusFilter === 'all' && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Workflow
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateWorkflowModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(workflowId) => {
            setIsCreateModalOpen(false);
            navigate(`/automation/${workflowId}`);
          }}
        />
      )}
    </div>
  );
}
