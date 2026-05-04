import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactFlowProvider, type ReactFlowInstance } from '@xyflow/react';
import { ArrowLeft, Save, Upload, Play, History, Settings, BarChart3, Loader2, AlertCircle, LayoutGrid as Layout, Zap, Plus, BookmarkPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getWorkflowById,
  updateWorkflowDraft,
  updateWorkflow,
  publishWorkflow,
} from '../../services/workflows';
import type { Workflow, WorkflowDefinition } from '../../types';
import type { WorkflowSettings } from '../../types/workflowBuilder';
import { getNodeTypeForAction } from '../../types/workflowBuilder';
import { useBuilderState } from '../../components/automation/builder/useBuilderState';
import { WorkflowCanvas } from '../../components/automation/builder/WorkflowCanvas';
import { TriggerPickerDrawer } from '../../components/automation/builder/drawers/TriggerPickerDrawer';
import { ActionPickerDrawer } from '../../components/automation/builder/drawers/ActionPickerDrawer';
import { NodeConfigDrawer } from '../../components/automation/builder/drawers/NodeConfigDrawer';
import { VersionHistoryPanel } from '../../components/automation/builder/panels/VersionHistoryPanel';
import { WorkflowSettingsPanel } from '../../components/automation/builder/panels/WorkflowSettingsPanel';
import { StatsOverlay } from '../../components/automation/builder/overlays/StatsOverlay';
import { CanvasNodeStatsOverlay } from '../../components/automation/builder/overlays/CanvasNodeStatsOverlay';
import { ValidationOverlay } from '../../components/automation/builder/overlays/ValidationOverlay';
import { SaveAsTemplateModal } from '../../components/automation/SaveAsTemplateModal';
import { TestWorkflowModal } from '../../components/automation/builder/modals/TestWorkflowModal';
import { PublishWorkflowModal } from '../../components/automation/builder/modals/PublishWorkflowModal';

const DEFAULT_SETTINGS: WorkflowSettings = {
  enrollmentRules: {
    allow_re_enrollment: 'after_completion',
    stop_existing_on_re_entry: false,
    max_concurrent_enrollments: 1,
  },
  waitTimeoutDays: 30,
  loggingVerbosity: 'standard',
  failureNotificationUserIds: [],
};

export function WorkflowBuilderV2() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  );
}

function WorkflowBuilderInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('automation.manage');

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings>(DEFAULT_SETTINGS);

  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const builder = useBuilderState();

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const wf = await getWorkflowById(id!);
        if (cancelled) return;
        if (!wf) {
          navigate('/automation');
          return;
        }
        setWorkflow(wf);

        const def = (wf.draft_definition ?? wf.published_definition) as WorkflowDefinition | null;
        if (def) {
          builder.loadDefinition(def);
        }
      } catch {
        if (!cancelled) {
          showToast('warning', 'Failed to load workflow');
          navigate('/automation');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, user]);

  const handleSaveDraft = useCallback(async () => {
    if (!workflow || !canManage || isSaving) return;
    setIsSaving(true);
    try {
      const viewport = rfInstanceRef.current?.getViewport();
      const definition = builder.toWorkflowDefinition(viewport);
      await updateWorkflowDraft(workflow.id, definition);
      builder.clearUnsavedFlag();
      showToast('success', 'Draft saved');
    } catch {
      showToast('warning', 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [workflow, canManage, isSaving, builder, showToast]);

  const handlePublish = useCallback(async (_notes: string) => {
    if (!workflow || !user || !canManage) return;
    setIsPublishing(true);
    try {
      const viewport = rfInstanceRef.current?.getViewport();
      const definition = builder.toWorkflowDefinition(viewport);
      await updateWorkflowDraft(workflow.id, definition);
      const result = await publishWorkflow(workflow.id, user.id);
      setWorkflow(result.workflow);
      builder.clearUnsavedFlag();
      setShowPublishModal(false);
      showToast('success', `Published as v${result.version.version_number}`);
    } catch {
      showToast('warning', 'Failed to publish workflow');
    } finally {
      setIsPublishing(false);
    }
  }, [workflow, user, canManage, builder, showToast]);

  const handleNameChange = useCallback(async (name: string) => {
    if (!workflow) return;
    setWorkflow(prev => prev ? { ...prev, name } : prev);
    try {
      await updateWorkflow(workflow.id, { name });
    } catch {}
  }, [workflow]);

  const handleDescriptionChange = useCallback(async (description: string) => {
    if (!workflow) return;
    setWorkflow(prev => prev ? { ...prev, description } : prev);
    try {
      await updateWorkflow(workflow.id, { description });
    } catch {}
  }, [workflow]);

  const handleNodeClick = useCallback((nodeId: string) => {
    builder.setDrawerMode({ type: 'node-config', nodeId });
  }, [builder]);

  const handleEdgeInsert = useCallback((edgeId: string) => {
    builder.setDrawerMode({ type: 'action-picker', insertionEdgeId: edgeId });
  }, [builder]);

  const handleTriggerSelect = useCallback((triggerType: string) => {
    builder.addTrigger(triggerType);
  }, [builder]);

  const handleActionSelect = useCallback((actionType: string) => {
    const mode = builder.drawerMode;
    if (mode.type !== 'action-picker') return;
    const nodeType = getNodeTypeForAction(actionType);
    builder.addNode(nodeType, actionType, mode.insertionEdgeId);
  }, [builder]);

  const handleVersionRestore = useCallback((definition: WorkflowDefinition) => {
    builder.loadDefinition(definition);
    builder.setDrawerMode({ type: 'closed' });
    showToast('success', 'Version restored to canvas');
  }, [builder, showToast]);

  const handleRfInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
  }, []);

  const selectedNodeId = builder.drawerMode.type === 'node-config'
    ? builder.drawerMode.nodeId
    : null;
  const selectedNode = selectedNodeId
    ? builder.nodes.find(n => n.id === selectedNodeId) ?? null
    : null;

  const drawerOpen = builder.drawerMode.type !== 'closed';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          <span className="text-sm text-gray-500">Loading workflow...</span>
        </div>
      </div>
    );
  }

  if (!workflow) return null;

  const errorCount = builder.validationIssues.filter(i => i.severity === 'error').length;
  const warningCount = builder.validationIssues.filter(i => i.severity === 'warning').length;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center justify-between px-4 h-14 bg-white border-b border-gray-200 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/automation')}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft className="w-4.5 h-4.5 text-gray-500" />
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-gray-900 max-w-[260px] truncate">
              {workflow.name}
            </h1>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              workflow.status === 'published'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {workflow.status}
            </span>
          </div>
          {builder.hasUnsavedChanges && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              Unsaved
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {(errorCount > 0 || warningCount > 0) && (
            <div className="flex items-center gap-1 mr-2">
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3" />
                  {errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3" />
                  {warningCount}
                </span>
              )}
            </div>
          )}

          <button
            onClick={() => builder.setDrawerMode({ type: 'trigger-picker' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
            title="Add Trigger"
          >
            <Zap className="w-3.5 h-3.5" />
            Trigger
          </button>

          <button
            onClick={builder.autoLayout}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Auto Layout"
          >
            <Layout className="w-4 h-4 text-gray-500" />
          </button>

          <button
            onClick={() => builder.setStatsMode(!builder.statsMode)}
            className={`p-2 rounded-lg transition-colors ${
              builder.statsMode ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'
            }`}
            title="Stats View"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowTestModal(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Test Workflow"
          >
            <Play className="w-4 h-4 text-gray-500" />
          </button>

          <button
            onClick={() => builder.setDrawerMode({ type: 'version-history' })}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Version History"
          >
            <History className="w-4 h-4 text-gray-500" />
          </button>

          <button
            onClick={() => builder.setDrawerMode({ type: 'workflow-settings' })}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-gray-500" />
          </button>

          <button
            onClick={() => setShowSaveAsTemplate(true)}
            disabled={!canManage || builder.nodes.length === 0}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Save as Template"
          >
            <BookmarkPlus className="w-4 h-4 text-gray-500" />
          </button>

          <div className="h-5 w-px bg-gray-200 mx-1" />

          <button
            onClick={handleSaveDraft}
            disabled={isSaving || !canManage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Draft
          </button>

          <button
            onClick={() => setShowPublishModal(true)}
            disabled={!canManage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Publish
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className={`flex-1 transition-all duration-200 ${drawerOpen ? 'mr-0' : ''}`}>
          <WorkflowCanvas
            nodes={builder.nodes}
            edges={builder.edges}
            onNodesChange={builder.onNodesChange}
            onEdgesChange={builder.onEdgesChange}
            onConnect={builder.onConnect}
            onNodeClick={handleNodeClick}
            onEdgeInsert={handleEdgeInsert}
            onInit={handleRfInit}
          />

          {builder.statsMode && workflow && (
            <>
              <StatsOverlay
                workflowId={workflow.id}
                nodes={builder.nodes}
              />
              <CanvasNodeStatsOverlay workflowId={workflow.id} />
            </>
          )}

          <ValidationOverlay issues={builder.validationIssues} />

          {builder.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center pointer-events-auto">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Start Building</h3>
                <p className="text-sm text-gray-500 mb-4 max-w-xs">
                  Add a trigger to start your workflow, then connect actions, conditions, and delays.
                </p>
                <button
                  onClick={() => builder.setDrawerMode({ type: 'trigger-picker' })}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add First Trigger
                </button>
              </div>
            </div>
          )}
        </div>

        {builder.drawerMode.type === 'trigger-picker' && (
          <TriggerPickerDrawer
            onSelect={handleTriggerSelect}
            onClose={() => builder.setDrawerMode({ type: 'closed' })}
          />
        )}

        {builder.drawerMode.type === 'action-picker' && (
          <ActionPickerDrawer
            onSelect={handleActionSelect}
            onClose={() => builder.setDrawerMode({ type: 'closed' })}
          />
        )}

        {builder.drawerMode.type === 'node-config' && selectedNode && (
          <NodeConfigDrawer
            node={selectedNode}
            onUpdate={builder.updateNodeData}
            onDelete={builder.deleteNode}
            onClose={() => builder.setDrawerMode({ type: 'closed' })}
          />
        )}

        {builder.drawerMode.type === 'version-history' && workflow && (
          <VersionHistoryPanel
            workflowId={workflow.id}
            onRestore={handleVersionRestore}
            onClose={() => builder.setDrawerMode({ type: 'closed' })}
          />
        )}

        {builder.drawerMode.type === 'workflow-settings' && (
          <WorkflowSettingsPanel
            settings={workflowSettings}
            workflowName={workflow.name}
            workflowDescription={workflow.description ?? ''}
            onChange={setWorkflowSettings}
            onNameChange={handleNameChange}
            onDescriptionChange={handleDescriptionChange}
            onClose={() => builder.setDrawerMode({ type: 'closed' })}
          />
        )}
      </div>

      {showTestModal && (
        <TestWorkflowModal
          nodes={builder.nodes}
          edges={builder.edges}
          onClose={() => setShowTestModal(false)}
        />
      )}

      {showPublishModal && (
        <PublishWorkflowModal
          validationIssues={builder.validationIssues}
          isPublishing={isPublishing}
          onPublish={handlePublish}
          onClose={() => setShowPublishModal(false)}
        />
      )}

      {showSaveAsTemplate && workflow && (
        <SaveAsTemplateModal
          workflowId={workflow.id}
          defaultName={workflow.name}
          defaultDescription={workflow.description}
          onClose={() => setShowSaveAsTemplate(false)}
          onSuccess={(templateId) => {
            showToast('success', 'Saved as template');
            setShowSaveAsTemplate(false);
            navigate(`/automation/templates/${templateId}`);
          }}
        />
      )}
    </div>
  );
}
