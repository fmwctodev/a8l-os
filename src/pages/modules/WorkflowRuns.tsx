import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Filter,
  Search,
  Download,
  Square,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Zap
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getWorkflowById, getEnrollments, stopEnrollment } from '../../services/workflows';
import type { Workflow, WorkflowEnrollment, EnrollmentStatus } from '../../types';

const STATUS_CONFIG: Record<EnrollmentStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/30', icon: Play },
  completed: { label: 'Completed', color: 'text-blue-700', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: CheckCircle },
  stopped: { label: 'Stopped', color: 'text-gray-700', bg: 'bg-gray-100 dark:bg-gray-800', icon: Square },
  errored: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30', icon: XCircle }
};

const PAGE_SIZES = [25, 50, 100];

export default function WorkflowRuns() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization } = useAuth();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [enrollments, setEnrollments] = useState<WorkflowEnrollment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus[]>([]);
  const [triggerFilter, setTriggerFilter] = useState<string>('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (!id || !organization) return;

    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [wf, enrollmentResult] = await Promise.all([
        getWorkflowById(id),
        getEnrollments(organization.id, {
          workflowId: id,
          status: statusFilter.length > 0 ? statusFilter : undefined
        }, page, pageSize)
      ]);

      setWorkflow(wf);

      let filtered = enrollmentResult.data;

      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(e => {
          const contact = e.contact as { first_name?: string; last_name?: string; email?: string; phone?: string } | undefined;
          return (
            e.id.toLowerCase().includes(searchLower) ||
            contact?.first_name?.toLowerCase().includes(searchLower) ||
            contact?.last_name?.toLowerCase().includes(searchLower) ||
            contact?.email?.toLowerCase().includes(searchLower) ||
            contact?.phone?.includes(searchLower)
          );
        });
      }

      if (triggerFilter) {
        filtered = filtered.filter(e =>
          (e as WorkflowEnrollment & { trigger_type?: string }).trigger_type === triggerFilter
        );
      }

      if (errorsOnly) {
        filtered = filtered.filter(e => e.status === 'errored');
      }

      setEnrollments(filtered);
      setTotal(enrollmentResult.total);
    } catch (err) {
      console.error('Failed to load workflow runs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, organization, page, pageSize, statusFilter, search, triggerFilter, errorsOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => loadData(true);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(enrollments.map(e => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkStop = async () => {
    if (selectedIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(enrollmentId =>
          stopEnrollment(enrollmentId, 'Bulk stopped by user')
        )
      );
      setSelectedIds(new Set());
      loadData(true);
    } catch (err) {
      console.error('Failed to stop enrollments:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Contact', 'Email', 'Status', 'Started', 'Current Step', 'Duration'];
    const rows = enrollments.map(e => {
      const contact = e.contact as { first_name?: string; last_name?: string; email?: string } | undefined;
      const duration = e.completed_at
        ? Math.round((new Date(e.completed_at).getTime() - new Date(e.started_at).getTime()) / 1000)
        : '-';

      return [
        e.id,
        `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim(),
        contact?.email || '',
        e.status,
        new Date(e.started_at).toISOString(),
        e.current_node_id || '-',
        typeof duration === 'number' ? `${duration}s` : duration
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-runs-${id}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatDuration = (startedAt: string, completedAt?: string | null): string => {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const ms = end - start;

    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
    return `${Math.round(ms / 86400000)}d`;
  };

  const formatDate = (date: string): string => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();

    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;

    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Workflow not found</h2>
        <button
          onClick={() => navigate('/automation')}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          Back to Automation
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate(`/automation/${id}`)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {workflow.name} - Runs
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {total.toLocaleString()} total enrollments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by contact name, email, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${
                showFilters || statusFilter.length > 0 || triggerFilter || errorsOnly
                  ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {(statusFilter.length > 0 || triggerFilter || errorsOnly) && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                  {(statusFilter.length > 0 ? 1 : 0) + (triggerFilter ? 1 : 0) + (errorsOnly ? 1 : 0)}
                </span>
              )}
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(STATUS_CONFIG) as EnrollmentStatus[]).map(status => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(prev =>
                            prev.includes(status)
                              ? prev.filter(s => s !== status)
                              : [...prev, status]
                          );
                        }}
                        className={`px-3 py-1.5 text-sm rounded-lg border ${
                          statusFilter.includes(status)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {STATUS_CONFIG[status].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Trigger Type
                  </label>
                  <select
                    value={triggerFilter}
                    onChange={(e) => setTriggerFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">All triggers</option>
                    <option value="manual">Manual</option>
                    <option value="contact_created">Contact Created</option>
                    <option value="contact_updated">Contact Updated</option>
                    <option value="conversation_message_received">Message Received</option>
                    <option value="appointment_booked">Appointment Booked</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Options
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={errorsOnly}
                      onChange={(e) => setErrorsOnly(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Errors only
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setStatusFilter([]);
                    setTriggerFilter('');
                    setErrorsOnly(false);
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {selectedIds.size} enrollment{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleBulkStop}
                disabled={bulkActionLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <Square className="w-4 h-4" />
                Stop Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear selection
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === enrollments.length && enrollments.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Current Step
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Started
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Version
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {enrollments.map(enrollment => {
              const contact = enrollment.contact as { id?: string; first_name?: string; last_name?: string; email?: string } | undefined;
              const statusConfig = STATUS_CONFIG[enrollment.status];
              const StatusIcon = statusConfig.icon;

              return (
                <tr
                  key={enrollment.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => navigate(`/automation/${id}/runs/${enrollment.id}`)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(enrollment.id)}
                      onChange={(e) => handleSelectOne(enrollment.id, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {contact?.first_name || contact?.last_name
                            ? `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim()
                            : 'Unknown Contact'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {contact?.email || enrollment.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {enrollment.current_node_id ? (
                      <span className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                        <Zap className="w-3.5 h-3.5 text-gray-400" />
                        {enrollment.current_node_id}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(enrollment.started_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(enrollment.started_at, enrollment.completed_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      v{(enrollment as WorkflowEnrollment & { workflow_version_number?: number }).workflow_version_number || '?'}
                    </span>
                  </td>
                </tr>
              );
            })}

            {enrollments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Clock className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No enrollments found</p>
                  {(search || statusFilter.length > 0 || triggerFilter || errorsOnly) && (
                    <button
                      onClick={() => {
                        setSearch('');
                        setStatusFilter([]);
                        setTriggerFilter('');
                        setErrorsOnly(false);
                      }}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {PAGE_SIZES.map(size => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
