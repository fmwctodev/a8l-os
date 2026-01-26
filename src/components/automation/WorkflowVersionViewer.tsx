import { useMemo } from 'react';
import {
  X,
  Clock,
  User,
  AlertTriangle,
  Zap,
  GitBranch,
  Timer,
  Mail,
  MessageSquare,
  Calendar,
  Bot,
  ArrowRight
} from 'lucide-react';
import type { WorkflowVersion, WorkflowDefinition, WorkflowNode } from '../../types';

interface WorkflowVersionViewerProps {
  version: WorkflowVersion;
  onClose: () => void;
  onCompareWithDraft?: () => void;
}

function getNodeIcon(node: WorkflowNode): React.ElementType {
  if (node.type === 'trigger') return Zap;
  if (node.type === 'condition') return GitBranch;
  if (node.type === 'delay') return Timer;

  const actionType = (node.data as { actionType?: string })?.actionType;
  switch (actionType) {
    case 'send_email':
      return Mail;
    case 'send_sms':
      return MessageSquare;
    case 'book_appointment':
      return Calendar;
    case 'ai_generate_response':
    case 'ai_classify_intent':
      return Bot;
    default:
      return Zap;
  }
}

function getNodeLabel(node: WorkflowNode): string {
  const data = node.data as { label?: string; name?: string };
  return data.label || data.name || node.id;
}

function getNodeTypeLabel(type: string): string {
  switch (type) {
    case 'trigger':
      return 'Trigger';
    case 'condition':
      return 'Condition';
    case 'delay':
      return 'Delay';
    case 'action':
      return 'Action';
    case 'end':
      return 'End';
    default:
      return type;
  }
}

interface VisualNode {
  id: string;
  node: WorkflowNode;
  children: VisualNode[];
  branchLabel?: string;
}

function buildVisualTree(definition: WorkflowDefinition): VisualNode[] {
  const { nodes, edges } = definition;
  const nodeMap = new Map<string, WorkflowNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const edgesBySource = new Map<string, typeof edges>();
  edges.forEach(e => {
    const existing = edgesBySource.get(e.source) || [];
    existing.push(e);
    edgesBySource.set(e.source, existing);
  });

  const triggerNode = nodes.find(n => n.type === 'trigger');
  if (!triggerNode) return [];

  const visited = new Set<string>();

  function buildNode(nodeId: string, branchLabel?: string): VisualNode | null {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return null;

    const outEdges = edgesBySource.get(nodeId) || [];
    const children: VisualNode[] = [];

    if (node.type === 'condition') {
      outEdges.forEach(edge => {
        const label = edge.sourceHandle === 'true' ? 'Yes' : edge.sourceHandle === 'false' ? 'No' : edge.sourceHandle;
        const child = buildNode(edge.target, label || undefined);
        if (child) children.push(child);
      });
    } else {
      outEdges.forEach(edge => {
        const child = buildNode(edge.target);
        if (child) children.push(child);
      });
    }

    return {
      id: nodeId,
      node,
      children,
      branchLabel
    };
  }

  const root = buildNode(triggerNode.id);
  return root ? [root] : [];
}

function VisualNodeItem({ item, depth = 0 }: { item: VisualNode; depth?: number }) {
  const Icon = getNodeIcon(item.node);

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}>
      {item.branchLabel && (
        <div className="flex items-center gap-2 mb-1 text-xs text-gray-500 dark:text-gray-400">
          <GitBranch className="w-3 h-3" />
          <span>{item.branchLabel}</span>
        </div>
      )}

      <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-2 bg-white dark:bg-gray-900 rounded-lg">
          <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {getNodeLabel(item.node)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {getNodeTypeLabel(item.node.type)}
            {(item.node.data as { actionType?: string })?.actionType && (
              <span className="ml-1 text-gray-400">
                - {(item.node.data as { actionType?: string }).actionType}
              </span>
            )}
          </p>
        </div>
      </div>

      {item.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {item.children.map(child => (
            <VisualNodeItem key={child.id} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkflowVersionViewer({
  version,
  onClose,
  onCompareWithDraft
}: WorkflowVersionViewerProps) {
  const definition = version.definition as WorkflowDefinition;
  const visualTree = useMemo(() => buildVisualTree(definition), [definition]);

  const createdBy = version.created_by as { name?: string; email?: string } | undefined;

  const stats = useMemo(() => {
    const nodes = definition.nodes;
    return {
      total: nodes.length,
      triggers: nodes.filter(n => n.type === 'trigger').length,
      conditions: nodes.filter(n => n.type === 'condition').length,
      actions: nodes.filter(n => n.type === 'action').length,
      delays: nodes.filter(n => n.type === 'delay').length
    };
  }, [definition]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Version {version.version_number}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Published {new Date(version.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
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

        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">This is a historical version (read-only)</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Nodes</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                {stats.total}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Actions</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                {stats.actions}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Conditions</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                {stats.conditions}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Delays</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                {stats.delays}
              </p>
            </div>
          </div>

          {createdBy && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <User className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Published by <span className="font-medium text-gray-900 dark:text-white">{createdBy.name || createdBy.email}</span>
              </span>
            </div>
          )}

          {(version as WorkflowVersion & { notes?: string }).notes && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Release Notes
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(version as WorkflowVersion & { notes?: string }).notes}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Workflow Structure
            </h3>
            <div className="space-y-2">
              {visualTree.map(item => (
                <VisualNodeItem key={item.id} item={item} />
              ))}

              {visualTree.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No nodes in this workflow version</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          {onCompareWithDraft && (
            <button
              onClick={onCompareWithDraft}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <ArrowRight className="w-4 h-4" />
              Compare with Draft
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
