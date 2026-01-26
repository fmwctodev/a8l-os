import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Square,
  Play,
  SkipForward,
  User,
  Mail,
  Phone,
  Tag,
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { getEnrollmentById, stopEnrollment, getExecutionLogs } from '../../services/workflows';
import { useEnrollmentPolling } from '../../hooks/useEnrollmentPolling';
import { ExecutionTimeline } from '../../components/automation/ExecutionTimeline';
import { NodeExecutionModal } from '../../components/automation/NodeExecutionModal';
import type { WorkflowEnrollment, WorkflowExecutionLog, WorkflowDefinition, WorkflowNode } from '../../types';

export default function WorkflowRunDetail() {
  const { id: workflowId, enrollmentId } = useParams<{ id: string; enrollmentId: string }>();
  const navigate = useNavigate();

  const [enrollment, setEnrollment] = useState<WorkflowEnrollment | null>(null);
  const [logs, setLogs] = useState<WorkflowExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [selectedNode, setSelectedNode] = useState<{ node: WorkflowNode; logs: WorkflowExecutionLog[] } | null>(null);

  const {
    state: pollingState,
    isPolling,
    refresh,
    hasRecentChange
  } = useEnrollmentPolling(enrollmentId || null, {
    enabled: enrollment?.status === 'active'
  });

  const loadData = useCallback(async () => {
    if (!enrollmentId) return;

    setLoading(true);
    try {
      const [enrollmentData, logsData] = await Promise.all([
        getEnrollmentById(enrollmentId),
        getExecutionLogs(enrollmentId)
      ]);

      setEnrollment(enrollmentData);
      setLogs(logsData);
    } catch (err) {
      console.error('Failed to load enrollment:', err);
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (pollingState) {
      setLogs(pollingState.logs);
      if (enrollment) {
        setEnrollment({
          ...enrollment,
          status: pollingState.status,
          current_node_id: pollingState.currentNodeId
        });
      }
    }
  }, [pollingState]);

  const handleStop = async () => {
    if (!enrollmentId) return;

    setActionLoading(true);
    try {
      await stopEnrollment(enrollmentId, 'Manually stopped by user');
      await loadData();
    } catch (err) {
      console.error('Failed to stop enrollment:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleNodeClick = (nodeId: string, nodeLogs: WorkflowExecutionLog[]) => {
    const definition = (enrollment?.version?.definition || enrollment?.workflow?.published_definition) as WorkflowDefinition | undefined;
    const node = definition?.nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode({ node, logs: nodeLogs });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Enrollment not found</h2>
        <button
          onClick={() => navigate(`/automation/${workflowId}/runs`)}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          Back to Runs
        </button>
      </div>
    );
  }

  const contact = enrollment.contact as {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    tags?: string[];
    lead_score?: number;
  } | undefined;

  const workflow = enrollment.workflow as {
    id?: string;
    name?: string;
    published_definition?: WorkflowDefinition;
  } | undefined;

  const version = enrollment.version as {
    id?: string;
    version_number?: number;
    definition?: WorkflowDefinition;
  } | undefined;

  const contextData = enrollment.context_data as {
    opportunity_id?: string;
    opportunity_name?: string;
    opportunity_value?: number;
    appointment_id?: string;
    appointment_title?: string;
    appointment_date?: string;
  } | undefined;

  const definition = version?.definition || workflow?.published_definition;

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/automation/${workflowId}/runs`)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Enrollment Details
                  </h1>
                  {isPolling && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                  <Link
                    to={`/automation/${workflowId}`}
                    className="hover:text-blue-600"
                  >
                    {workflow?.name || 'Workflow'}
                  </Link>
                  <ChevronRight className="w-4 h-4" />
                  <span>v{version?.version_number || '?'}</span>
                  <ChevronRight className="w-4 h-4" />
                  <span className="font-mono text-xs">{enrollmentId?.slice(0, 8)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => refresh()}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>

              {enrollment.status === 'active' && (
                <button
                  onClick={handleStop}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <Square className="w-4 h-4" />
                  Stop Enrollment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Execution Timeline
              </h2>

              {definition ? (
                <ExecutionTimeline
                  definition={definition}
                  logs={logs}
                  currentNodeId={enrollment.current_node_id}
                  enrollmentStatus={enrollment.status}
                  onNodeClick={handleNodeClick}
                  hasRecentChange={hasRecentChange}
                />
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                  <p>Workflow definition not available</p>
                </div>
              )}
            </div>

            {enrollment.status === 'stopped' && enrollment.stopped_reason && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start gap-3">
                  <Square className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Enrollment Stopped
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {enrollment.stopped_reason}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Contact
              </h3>

              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {contact?.first_name || contact?.last_name
                      ? `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim()
                      : 'Unknown Contact'}
                  </p>
                  {contact?.lead_score !== undefined && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, contact.lead_score)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{contact.lead_score}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {contact?.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span>{contact.email}</span>
                  </div>
                )}
                {contact?.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact?.tags && contact.tags.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Tag className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {contact?.id && (
                <Link
                  to={`/contacts/${contact.id}`}
                  className="flex items-center gap-1.5 mt-4 text-sm text-blue-600 hover:text-blue-700"
                >
                  View Contact
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {contextData?.opportunity_id && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                  Linked Opportunity
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {contextData.opportunity_name || 'Opportunity'}
                    </p>
                    {contextData.opportunity_value && (
                      <p className="text-sm text-gray-500">
                        ${contextData.opportunity_value.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  to={`/opportunities/${contextData.opportunity_id}`}
                  className="flex items-center gap-1.5 mt-3 text-sm text-blue-600 hover:text-blue-700"
                >
                  View Opportunity
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {contextData?.appointment_id && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                  Linked Appointment
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {contextData.appointment_title || 'Appointment'}
                    </p>
                    {contextData.appointment_date && (
                      <p className="text-sm text-gray-500">
                        {formatDate(contextData.appointment_date)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Enrollment Info
              </h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Status</dt>
                  <dd className={`text-sm font-medium ${
                    enrollment.status === 'active' ? 'text-emerald-600' :
                    enrollment.status === 'completed' ? 'text-blue-600' :
                    enrollment.status === 'errored' ? 'text-red-600' :
                    'text-gray-600 dark:text-gray-300'
                  }`}>
                    {enrollment.status}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Started</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {formatDate(enrollment.started_at)}
                  </dd>
                </div>
                {enrollment.completed_at && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Completed</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {formatDate(enrollment.completed_at)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Version</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    v{version?.version_number || '?'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Trigger</dt>
                  <dd className="text-sm text-gray-900 dark:text-white capitalize">
                    {(enrollment as WorkflowEnrollment & { trigger_type?: string }).trigger_type?.replace(/_/g, ' ') || 'manual'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Steps Executed</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {logs.filter(l => l.event_type === 'node_completed').length}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {selectedNode && (
        <NodeExecutionModal
          node={selectedNode.node}
          logs={selectedNode.logs}
          onClose={() => setSelectedNode(null)}
          onViewInWorkflow={() => {
            navigate(`/automation/${workflowId}`);
          }}
        />
      )}
    </div>
  );
}
