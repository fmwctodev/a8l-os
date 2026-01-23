import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Filter,
  Users,
  Play,
  CheckCircle,
  XCircle,
  Pause,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  StopCircle,
  AlertCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getWorkflowById,
  getEnrollments,
  stopEnrollment,
  getExecutionLogs,
} from '../../services/workflows';
import type {
  Workflow,
  WorkflowEnrollment,
  WorkflowExecutionLog,
  EnrollmentStatus,
} from '../../types';

const STATUS_CONFIG: Record<EnrollmentStatus, { label: string; color: string; icon: typeof Play }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800', icon: Play },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: XCircle },
  stopped: { label: 'Stopped', color: 'bg-gray-100 text-gray-800', icon: Pause },
  waiting: { label: 'Waiting', color: 'bg-amber-100 text-amber-800', icon: Clock },
};

export function WorkflowEnrollments() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [enrollments, setEnrollments] = useState<WorkflowEnrollment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedEnrollment, setSelectedEnrollment] = useState<WorkflowEnrollment | null>(null);
  const [executionLogs, setExecutionLogs] = useState<WorkflowExecutionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [stopModalEnrollment, setStopModalEnrollment] = useState<WorkflowEnrollment | null>(null);
  const [stopReason, setStopReason] = useState('');
  const [stopping, setStopping] = useState(false);

  const pageSize = 25;

  const loadWorkflow = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getWorkflowById(id);
      setWorkflow(data);
    } catch (err) {
      console.error('Failed to load workflow:', err);
    }
  }, [id]);

  const loadEnrollments = useCallback(async () => {
    if (!id || !user?.organization_id) return;
    setLoading(true);
    try {
      const result = await getEnrollments(
        user.organization_id,
        {
          workflowId: id,
          status: statusFilter.length > 0 ? statusFilter : undefined,
        },
        page,
        pageSize
      );
      setEnrollments(result.data);
      setTotalCount(result.total);
    } catch (err) {
      console.error('Failed to load enrollments:', err);
    } finally {
      setLoading(false);
    }
  }, [id, user?.organization_id, statusFilter, page]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  const loadExecutionLogs = async (enrollment: WorkflowEnrollment) => {
    setSelectedEnrollment(enrollment);
    setLogsLoading(true);
    try {
      const logs = await getExecutionLogs(enrollment.id);
      setExecutionLogs(logs);
    } catch (err) {
      console.error('Failed to load execution logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleStopEnrollment = async () => {
    if (!stopModalEnrollment) return;
    setStopping(true);
    try {
      await stopEnrollment(stopModalEnrollment.id, stopReason || 'Manually stopped');
      setStopModalEnrollment(null);
      setStopReason('');
      loadEnrollments();
      if (selectedEnrollment?.id === stopModalEnrollment.id) {
        setSelectedEnrollment(null);
      }
    } catch (err) {
      console.error('Failed to stop enrollment:', err);
    } finally {
      setStopping(false);
    }
  };

  const toggleStatusFilter = (status: EnrollmentStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
    setPage(1);
  };

  const filteredEnrollments = enrollments.filter((e) => {
    if (!search) return true;
    const contact = e.contact as { first_name?: string; last_name?: string; email?: string } | undefined;
    const searchLower = search.toLowerCase();
    return (
      contact?.first_name?.toLowerCase().includes(searchLower) ||
      contact?.last_name?.toLowerCase().includes(searchLower) ||
      contact?.email?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: string, end?: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
    return `${diffMins}m`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/automation/${id}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="text-sm text-gray-500">Enrollments for</div>
            <h1 className="text-xl font-semibold text-gray-900">
              {workflow?.name || 'Loading...'}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-white">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by contact name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                  statusFilter.length > 0 ? 'border-slate-500 bg-slate-50' : 'hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {statusFilter.length > 0 && (
                  <span className="bg-slate-600 text-white text-xs px-1.5 rounded">
                    {statusFilter.length}
                  </span>
                )}
              </button>
              <button
                onClick={loadEnrollments}
                className="p-2 border rounded-lg hover:bg-gray-50 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {showFilters && (
              <div className="mt-3 pt-3 border-t">
                <div className="text-sm font-medium text-gray-700 mb-2">Status</div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STATUS_CONFIG) as EnrollmentStatus[]).map((status) => {
                    const config = STATUS_CONFIG[status];
                    const isActive = statusFilter.includes(status);
                    return (
                      <button
                        key={status}
                        onClick={() => toggleStatusFilter(status)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          isActive
                            ? config.color
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600" />
              </div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Users className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-lg font-medium">No enrollments found</p>
                <p className="text-sm">
                  {statusFilter.length > 0 || search
                    ? 'Try adjusting your filters'
                    : 'Contacts will appear here when they trigger this workflow'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Step
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEnrollments.map((enrollment) => {
                    const contact = enrollment.contact as {
                      id: string;
                      first_name?: string;
                      last_name?: string;
                      email?: string;
                    } | undefined;
                    const statusConfig = STATUS_CONFIG[enrollment.status];
                    const StatusIcon = statusConfig.icon;

                    return (
                      <tr
                        key={enrollment.id}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          selectedEnrollment?.id === enrollment.id ? 'bg-slate-50' : ''
                        }`}
                        onClick={() => loadExecutionLogs(enrollment)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <Link
                              to={`/contacts/${contact?.id}`}
                              className="font-medium text-gray-900 hover:text-slate-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {contact?.first_name} {contact?.last_name}
                            </Link>
                            <div className="text-sm text-gray-500">{contact?.email}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(enrollment.started_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDuration(enrollment.started_at, enrollment.completed_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">
                            {enrollment.current_node_id ? (
                              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                                {enrollment.current_node_id.slice(0, 8)}...
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                loadExecutionLogs(enrollment);
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                              title="View logs"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {enrollment.status === 'active' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStopModalEnrollment(enrollment);
                                }}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                title="Stop enrollment"
                              >
                                <StopCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="border-t bg-white px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {(page - 1) * pageSize + 1} to{' '}
                {Math.min(page * pageSize, totalCount)} of {totalCount} enrollments
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {selectedEnrollment && (
          <div className="w-96 border-l bg-white flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Execution Log</h3>
              <button
                onClick={() => setSelectedEnrollment(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600" />
                </div>
              ) : executionLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No execution logs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {executionLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border ${
                        log.status === 'success'
                          ? 'border-emerald-200 bg-emerald-50'
                          : log.status === 'failed'
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {log.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        ) : log.status === 'failed' ? (
                          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {log.node_type}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatDate(log.created_at)}
                          </div>
                          {log.error_message && (
                            <div className="mt-2 text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                              {log.error_message}
                            </div>
                          )}
                          {log.output_data && Object.keys(log.output_data).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                View output
                              </summary>
                              <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                                {JSON.stringify(log.output_data, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedEnrollment.status === 'active' && (
              <div className="p-4 border-t">
                <button
                  onClick={() => setStopModalEnrollment(selectedEnrollment)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <StopCircle className="w-4 h-4" />
                  Stop Enrollment
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {stopModalEnrollment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <StopCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Stop Enrollment</h3>
                  <p className="text-sm text-gray-500">
                    This will stop all pending actions for this contact
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  placeholder="e.g., Customer requested to stop"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setStopModalEnrollment(null);
                    setStopReason('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStopEnrollment}
                  disabled={stopping}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {stopping ? 'Stopping...' : 'Stop Enrollment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
