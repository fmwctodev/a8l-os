import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  User,
  Eye,
  GitCompare,
  RotateCcw,
  CheckCircle,
  Archive,
  AlertTriangle,
  Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getWorkflowById, getWorkflowVersions, rollbackWorkflow } from '../../services/workflows';
import { WorkflowVersionViewer } from '../../components/automation/WorkflowVersionViewer';
import { WorkflowVersionDiff } from '../../components/automation/WorkflowVersionDiff';
import type { Workflow, WorkflowVersion, WorkflowDefinition } from '../../types';

interface ExtendedWorkflowVersion extends WorkflowVersion {
  status?: string;
  is_active?: boolean;
  notes?: string;
  enrollment_count?: number;
}

export default function WorkflowVersions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [versions, setVersions] = useState<ExtendedWorkflowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedVersion, setSelectedVersion] = useState<ExtendedWorkflowVersion | null>(null);
  const [diffVersions, setDiffVersions] = useState<{
    left: ExtendedWorkflowVersion;
    right: ExtendedWorkflowVersion;
  } | null>(null);

  const [rollbackTarget, setRollbackTarget] = useState<ExtendedWorkflowVersion | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (!id) return;

    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [wf, vers] = await Promise.all([
        getWorkflowById(id),
        getWorkflowVersions(id)
      ]);

      setWorkflow(wf);

      const versionIds = vers.map(v => v.id);
      let enrollmentCounts = new Map<string, number>();

      if (versionIds.length > 0) {
        const { data: enrollments } = await supabase
          .from('workflow_enrollments')
          .select('version_id')
          .in('version_id', versionIds);

        enrollments?.forEach(e => {
          const count = enrollmentCounts.get(e.version_id) || 0;
          enrollmentCounts.set(e.version_id, count + 1);
        });
      }

      const extendedVersions = vers.map(v => ({
        ...v,
        enrollment_count: enrollmentCounts.get(v.id) || 0
      })) as ExtendedWorkflowVersion[];

      setVersions(extendedVersions);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => loadData(true);

  const handleRollback = async () => {
    if (!rollbackTarget || !id || !user) return;

    setRollbackLoading(true);
    try {
      await rollbackWorkflow(id, rollbackTarget.id, user.id);
      setRollbackTarget(null);
      loadData(true);
    } catch (err) {
      console.error('Failed to rollback:', err);
    } finally {
      setRollbackLoading(false);
    }
  };

  const handleCompareWithDraft = (version: ExtendedWorkflowVersion) => {
    if (!workflow) return;
    setDiffVersions({
      left: version,
      right: {
        ...version,
        id: 'draft',
        version_number: -1,
        definition: workflow.draft_definition
      }
    });
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/automation/${id}`)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {workflow.name} - Version History
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {versions.length} version{versions.length !== 1 ? 's' : ''} published
                </p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {versions.map((version, index) => {
            const createdBy = version.created_by as { name?: string; email?: string } | undefined;
            const isActive = version.is_active;
            const isLatest = index === 0;

            return (
              <div
                key={version.id}
                className={`bg-white dark:bg-gray-900 rounded-xl border ${
                  isActive
                    ? 'border-emerald-300 dark:border-emerald-700'
                    : 'border-gray-200 dark:border-gray-700'
                } overflow-hidden`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isActive
                          ? 'bg-emerald-100 dark:bg-emerald-900/30'
                          : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        <Clock className={`w-5 h-5 ${
                          isActive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            Version {version.version_number}
                          </h3>
                          {isActive && (
                            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          )}
                          {version.status === 'rolled_back' && (
                            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                              <RotateCcw className="w-3 h-3" />
                              Rolled back
                            </span>
                          )}
                          {version.status === 'archived' && (
                            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">
                              <Archive className="w-3 h-3" />
                              Archived
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatDate(version.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedVersion(version)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      {!isLatest && (
                        <button
                          onClick={() => handleCompareWithDraft(version)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                        >
                          <GitCompare className="w-4 h-4" />
                          Compare
                        </button>
                      )}
                      {!isActive && (
                        <button
                          onClick={() => setRollbackTarget(version)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Rollback
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                    {createdBy && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        <span>{createdBy.name || createdBy.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>{version.enrollment_count || 0} enrollments</span>
                    </div>
                  </div>

                  {version.notes && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {version.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {versions.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                No versions published yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Publish your workflow to create the first version
              </p>
            </div>
          )}
        </div>
      </div>

      {selectedVersion && (
        <WorkflowVersionViewer
          version={selectedVersion}
          onClose={() => setSelectedVersion(null)}
          onCompareWithDraft={() => {
            handleCompareWithDraft(selectedVersion);
            setSelectedVersion(null);
          }}
        />
      )}

      {diffVersions && (
        <WorkflowVersionDiff
          leftDefinition={diffVersions.left.definition as WorkflowDefinition}
          rightDefinition={diffVersions.right.definition as WorkflowDefinition}
          leftLabel={`Version ${diffVersions.left.version_number}`}
          rightLabel={diffVersions.right.version_number === -1 ? 'Current Draft' : `Version ${diffVersions.right.version_number}`}
          onClose={() => setDiffVersions(null)}
        />
      )}

      {rollbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Rollback to Version {rollbackTarget.version_number}
                </h3>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This will create a new version based on Version {rollbackTarget.version_number}.
              The current draft will be replaced.
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-6">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Existing enrollments will continue using their original version.
                  Only new enrollments will use the rolled-back version.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRollbackTarget(null)}
                disabled={rollbackLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={rollbackLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {rollbackLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Rolling back...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Confirm Rollback
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
