import { useState, useMemo } from 'react';
import {
  X,
  Upload,
  Plus,
  Minus,
  Edit3,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Zap,
  GitBranch,
  Timer,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Workflow, WorkflowDefinition, WorkflowNode, WorkflowVersion } from '../../types';

interface PublishWorkflowModalProps {
  workflow: Workflow;
  latestVersion: WorkflowVersion | null;
  userId: string;
  onClose: () => void;
  onPublished: (workflow: Workflow, version: WorkflowVersion) => void;
}

interface NodeChange {
  type: 'added' | 'removed' | 'modified';
  nodeId: string;
  nodeName: string;
  nodeType: string;
  details?: string;
}

interface ChangeSummary {
  addedNodes: NodeChange[];
  removedNodes: NodeChange[];
  modifiedNodes: NodeChange[];
  edgeChanges: number;
  triggerChanged: boolean;
}

function getNodeLabel(node: WorkflowNode): string {
  const data = node.data as { label?: string; name?: string };
  return data.label || data.name || node.id;
}

function computeChangeSummary(
  current: WorkflowDefinition,
  previous: WorkflowDefinition | null
): ChangeSummary {
  if (!previous) {
    return {
      addedNodes: current.nodes.map(n => ({
        type: 'added',
        nodeId: n.id,
        nodeName: getNodeLabel(n),
        nodeType: n.type
      })),
      removedNodes: [],
      modifiedNodes: [],
      edgeChanges: current.edges.length,
      triggerChanged: true
    };
  }

  const prevNodeMap = new Map(previous.nodes.map(n => [n.id, n]));
  const currNodeMap = new Map(current.nodes.map(n => [n.id, n]));

  const addedNodes: NodeChange[] = [];
  const removedNodes: NodeChange[] = [];
  const modifiedNodes: NodeChange[] = [];

  current.nodes.forEach(node => {
    if (!prevNodeMap.has(node.id)) {
      addedNodes.push({
        type: 'added',
        nodeId: node.id,
        nodeName: getNodeLabel(node),
        nodeType: node.type
      });
    } else {
      const prevNode = prevNodeMap.get(node.id)!;
      const prevData = JSON.stringify(prevNode.data);
      const currData = JSON.stringify(node.data);

      if (prevData !== currData) {
        modifiedNodes.push({
          type: 'modified',
          nodeId: node.id,
          nodeName: getNodeLabel(node),
          nodeType: node.type,
          details: 'Configuration changed'
        });
      }
    }
  });

  previous.nodes.forEach(node => {
    if (!currNodeMap.has(node.id)) {
      removedNodes.push({
        type: 'removed',
        nodeId: node.id,
        nodeName: getNodeLabel(node),
        nodeType: node.type
      });
    }
  });

  const prevEdgeSet = new Set(previous.edges.map(e => `${e.source}-${e.target}`));
  const currEdgeSet = new Set(current.edges.map(e => `${e.source}-${e.target}`));

  let edgeChanges = 0;
  currEdgeSet.forEach(e => { if (!prevEdgeSet.has(e)) edgeChanges++; });
  prevEdgeSet.forEach(e => { if (!currEdgeSet.has(e)) edgeChanges++; });

  const prevTrigger = previous.nodes.find(n => n.type === 'trigger');
  const currTrigger = current.nodes.find(n => n.type === 'trigger');
  const triggerChanged = JSON.stringify(prevTrigger?.data) !== JSON.stringify(currTrigger?.data);

  return {
    addedNodes,
    removedNodes,
    modifiedNodes,
    edgeChanges,
    triggerChanged
  };
}

async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function ChangeSection({
  title,
  changes,
  icon: Icon,
  color
}: {
  title: string;
  changes: NodeChange[];
  icon: React.ElementType;
  color: string;
}) {
  const [expanded, setExpanded] = useState(true);

  if (changes.length === 0) return null;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-3 ${color} hover:opacity-90`}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="font-medium">{title}</span>
          <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs">
            {changes.length}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {changes.map(change => (
            <div
              key={change.nodeId}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900"
            >
              {change.nodeType === 'trigger' && <Zap className="w-4 h-4 text-gray-400" />}
              {change.nodeType === 'condition' && <GitBranch className="w-4 h-4 text-gray-400" />}
              {change.nodeType === 'delay' && <Timer className="w-4 h-4 text-gray-400" />}
              {!['trigger', 'condition', 'delay'].includes(change.nodeType) && (
                <Zap className="w-4 h-4 text-gray-400" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {change.nodeName}
                </p>
                {change.details && (
                  <p className="text-xs text-gray-500">{change.details}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PublishWorkflowModal({
  workflow,
  latestVersion,
  userId,
  onClose,
  onPublished
}: PublishWorkflowModalProps) {
  const [notes, setNotes] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeSummary = useMemo(() => {
    const current = workflow.draft_definition;
    const previous = latestVersion?.definition || null;
    return computeChangeSummary(current, previous);
  }, [workflow.draft_definition, latestVersion?.definition]);

  const hasChanges =
    changeSummary.addedNodes.length > 0 ||
    changeSummary.removedNodes.length > 0 ||
    changeSummary.modifiedNodes.length > 0 ||
    changeSummary.edgeChanges > 0;

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);

    try {
      const nextVersion = (latestVersion?.version_number || 0) + 1;

      const { data: previousActive } = await supabase
        .from('workflow_versions')
        .select('id')
        .eq('workflow_id', workflow.id)
        .eq('is_active', true)
        .maybeSingle();

      if (previousActive) {
        await supabase
          .from('workflow_versions')
          .update({ is_active: false, status: 'archived' })
          .eq('id', previousActive.id);
      }

      const { data: version, error: versionError } = await supabase
        .from('workflow_versions')
        .insert({
          org_id: workflow.org_id,
          workflow_id: workflow.id,
          version_number: nextVersion,
          definition: workflow.draft_definition,
          created_by_user_id: userId,
          status: 'published',
          is_active: true,
          notes: notes || null
        })
        .select()
        .single();

      if (versionError) throw versionError;

      const snapshotJson = JSON.stringify(workflow.draft_definition);
      const hash = await generateHash(snapshotJson);

      await supabase
        .from('workflow_version_snapshots')
        .insert({
          workflow_version_id: version.id,
          snapshot: workflow.draft_definition,
          hash
        });

      const { data: updatedWorkflow, error: updateError } = await supabase
        .from('workflows')
        .update({
          status: 'published',
          published_definition: workflow.draft_definition,
          published_at: new Date().toISOString()
        })
        .eq('id', workflow.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const triggerNodes = (workflow.draft_definition as WorkflowDefinition).nodes.filter(
        n => n.type === 'trigger'
      );

      for (const node of triggerNodes) {
        const triggerData = node.data as { triggerType?: string; filters?: unknown };
        if (triggerData.triggerType) {
          await supabase
            .from('workflow_triggers')
            .upsert({
              org_id: workflow.org_id,
              workflow_id: workflow.id,
              trigger_type: triggerData.triggerType,
              trigger_config: triggerData.filters || {},
              is_active: true
            }, {
              onConflict: 'workflow_id,trigger_type'
            });
        }
      }

      onPublished(updatedWorkflow as Workflow, version as WorkflowVersion);
    } catch (err) {
      console.error('Failed to publish workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to publish workflow');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Publish Workflow
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Version {(latestVersion?.version_number || 0) + 1}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!latestVersion && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                This will be the first published version of this workflow.
              </p>
            </div>
          )}

          {hasChanges && latestVersion && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Changes from v{latestVersion.version_number}
              </h3>

              <ChangeSection
                title="Added Nodes"
                changes={changeSummary.addedNodes}
                icon={Plus}
                color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              />

              <ChangeSection
                title="Removed Nodes"
                changes={changeSummary.removedNodes}
                icon={Minus}
                color="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
              />

              <ChangeSection
                title="Modified Nodes"
                changes={changeSummary.modifiedNodes}
                icon={Edit3}
                color="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
              />

              {changeSummary.edgeChanges > 0 && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                  <GitBranch className="w-4 h-4" />
                  <span>{changeSummary.edgeChanges} connection{changeSummary.edgeChanges !== 1 ? 's' : ''} changed</span>
                </div>
              )}

              {changeSummary.triggerChanged && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                  <Zap className="w-4 h-4" />
                  <span>Trigger configuration changed</span>
                </div>
              )}
            </div>
          )}

          {!hasChanges && latestVersion && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
              <CheckCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No changes detected from the current published version.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Release Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what changed in this version..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 resize-none"
            />
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
              <div className="text-sm text-amber-700 dark:text-amber-400">
                <p className="font-medium">Important</p>
                <p className="mt-1">
                  Changes will only affect new enrollments. Existing enrollments will continue
                  using their original workflow version.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={publishing}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
          >
            {publishing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Publish v{(latestVersion?.version_number || 0) + 1}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
