import { useMemo, useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Edit3,
  ChevronDown,
  ChevronRight,
  Zap,
  GitBranch,
  Timer,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import type { WorkflowDefinition, WorkflowNode } from '../../types';

interface WorkflowVersionDiffProps {
  leftDefinition: WorkflowDefinition;
  rightDefinition: WorkflowDefinition;
  leftLabel: string;
  rightLabel: string;
  onClose: () => void;
}

interface DiffNode {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  leftNode?: WorkflowNode;
  rightNode?: WorkflowNode;
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

interface EdgeDiff {
  changeType: 'added' | 'removed';
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
}

function getNodeLabel(node: WorkflowNode): string {
  const data = node.data as { label?: string; name?: string };
  return data.label || data.name || node.id;
}

function computeDiff(left: WorkflowDefinition, right: WorkflowDefinition): {
  nodes: DiffNode[];
  edges: EdgeDiff[];
} {
  const leftNodeMap = new Map(left.nodes.map(n => [n.id, n]));
  const rightNodeMap = new Map(right.nodes.map(n => [n.id, n]));

  const nodes: DiffNode[] = [];

  right.nodes.forEach(rightNode => {
    const leftNode = leftNodeMap.get(rightNode.id);

    if (!leftNode) {
      nodes.push({
        nodeId: rightNode.id,
        nodeName: getNodeLabel(rightNode),
        nodeType: rightNode.type,
        changeType: 'added',
        rightNode
      });
    } else {
      const leftDataStr = JSON.stringify(leftNode.data);
      const rightDataStr = JSON.stringify(rightNode.data);

      if (leftDataStr !== rightDataStr) {
        const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
        const leftData = leftNode.data as Record<string, unknown>;
        const rightData = rightNode.data as Record<string, unknown>;

        const allKeys = new Set([...Object.keys(leftData), ...Object.keys(rightData)]);
        allKeys.forEach(key => {
          const oldVal = leftData[key];
          const newVal = rightData[key];
          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changes.push({ field: key, oldValue: oldVal, newValue: newVal });
          }
        });

        nodes.push({
          nodeId: rightNode.id,
          nodeName: getNodeLabel(rightNode),
          nodeType: rightNode.type,
          changeType: 'modified',
          leftNode,
          rightNode,
          changes
        });
      } else {
        nodes.push({
          nodeId: rightNode.id,
          nodeName: getNodeLabel(rightNode),
          nodeType: rightNode.type,
          changeType: 'unchanged',
          leftNode,
          rightNode
        });
      }
    }
  });

  left.nodes.forEach(leftNode => {
    if (!rightNodeMap.has(leftNode.id)) {
      nodes.push({
        nodeId: leftNode.id,
        nodeName: getNodeLabel(leftNode),
        nodeType: leftNode.type,
        changeType: 'removed',
        leftNode
      });
    }
  });

  const leftEdgeSet = new Set(left.edges.map(e => `${e.source}->${e.target}`));
  const rightEdgeSet = new Set(right.edges.map(e => `${e.source}->${e.target}`));

  const edges: EdgeDiff[] = [];

  right.edges.forEach(edge => {
    const key = `${edge.source}->${edge.target}`;
    if (!leftEdgeSet.has(key)) {
      edges.push({
        changeType: 'added',
        source: edge.source,
        target: edge.target,
        sourceName: rightNodeMap.get(edge.source)
          ? getNodeLabel(rightNodeMap.get(edge.source)!)
          : edge.source,
        targetName: rightNodeMap.get(edge.target)
          ? getNodeLabel(rightNodeMap.get(edge.target)!)
          : edge.target
      });
    }
  });

  left.edges.forEach(edge => {
    const key = `${edge.source}->${edge.target}`;
    if (!rightEdgeSet.has(key)) {
      edges.push({
        changeType: 'removed',
        source: edge.source,
        target: edge.target,
        sourceName: leftNodeMap.get(edge.source)
          ? getNodeLabel(leftNodeMap.get(edge.source)!)
          : edge.source,
        targetName: leftNodeMap.get(edge.target)
          ? getNodeLabel(leftNodeMap.get(edge.target)!)
          : edge.target
      });
    }
  });

  nodes.sort((a, b) => {
    const order = { removed: 0, added: 1, modified: 2, unchanged: 3 };
    return order[a.changeType] - order[b.changeType];
  });

  return { nodes, edges };
}

function DiffNodeItem({ diff, showUnchanged }: { diff: DiffNode; showUnchanged: boolean }) {
  const [expanded, setExpanded] = useState(diff.changeType === 'modified');

  if (diff.changeType === 'unchanged' && !showUnchanged) return null;

  const bgColor = {
    added: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    removed: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    modified: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    unchanged: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
  };

  const textColor = {
    added: 'text-emerald-700 dark:text-emerald-400',
    removed: 'text-red-700 dark:text-red-400',
    modified: 'text-amber-700 dark:text-amber-400',
    unchanged: 'text-gray-600 dark:text-gray-400'
  };

  const Icon = {
    added: Plus,
    removed: Minus,
    modified: Edit3,
    unchanged: Zap
  }[diff.changeType];

  return (
    <div className={`border rounded-lg overflow-hidden ${bgColor[diff.changeType]}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3"
      >
        <Icon className={`w-4 h-4 ${textColor[diff.changeType]}`} />
        <div className="flex-1 text-left">
          <p className="font-medium text-gray-900 dark:text-white">{diff.nodeName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {diff.nodeType}
            {diff.changeType === 'modified' && diff.changes && (
              <span className="ml-2 text-amber-600">
                {diff.changes.length} field{diff.changes.length !== 1 ? 's' : ''} changed
              </span>
            )}
          </p>
        </div>
        {diff.changeType === 'modified' && diff.changes && (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )
        )}
      </button>

      {expanded && diff.changeType === 'modified' && diff.changes && (
        <div className="border-t border-amber-200 dark:border-amber-800 divide-y divide-amber-200 dark:divide-amber-800">
          {diff.changes.map((change, i) => (
            <div key={i} className="p-3 bg-white dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                {change.field}
              </p>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-red-600 dark:text-red-400 font-medium">Before:</span>
                  <pre className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(change.oldValue, null, 2) || 'null'}
                  </pre>
                </div>
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">After:</span>
                  <pre className="mt-1 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(change.newValue, null, 2) || 'null'}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkflowVersionDiff({
  leftDefinition,
  rightDefinition,
  leftLabel,
  rightLabel,
  onClose
}: WorkflowVersionDiffProps) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const diff = useMemo(
    () => computeDiff(leftDefinition, rightDefinition),
    [leftDefinition, rightDefinition]
  );

  const stats = useMemo(() => ({
    added: diff.nodes.filter(n => n.changeType === 'added').length,
    removed: diff.nodes.filter(n => n.changeType === 'removed').length,
    modified: diff.nodes.filter(n => n.changeType === 'modified').length,
    unchanged: diff.nodes.filter(n => n.changeType === 'unchanged').length,
    edgesAdded: diff.edges.filter(e => e.changeType === 'added').length,
    edgesRemoved: diff.edges.filter(e => e.changeType === 'removed').length
  }), [diff]);

  const hasChanges = stats.added > 0 || stats.removed > 0 || stats.modified > 0 ||
    stats.edgesAdded > 0 || stats.edgesRemoved > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Version Comparison
            </h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span>{leftLabel}</span>
              <ArrowRight className="w-4 h-4" />
              <span>{rightLabel}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center text-sm">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {stats.added}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">Added</p>
            </div>
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <p className="text-lg font-bold text-red-700 dark:text-red-400">
                {stats.removed}
              </p>
              <p className="text-xs text-red-600 dark:text-red-500">Removed</p>
            </div>
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {stats.modified}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">Modified</p>
            </div>
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
                {stats.unchanged}
              </p>
              <p className="text-xs text-gray-500">Unchanged</p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                +{stats.edgesAdded}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500">Connections</p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                -{stats.edgesRemoved}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500">Connections</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!hasChanges && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                No differences found between versions
              </p>
            </div>
          )}

          {hasChanges && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Node Changes
                </h3>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showUnchanged}
                    onChange={(e) => setShowUnchanged(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-600 dark:text-gray-400">Show unchanged</span>
                </label>
              </div>

              <div className="space-y-2">
                {diff.nodes.map(node => (
                  <DiffNodeItem
                    key={node.nodeId}
                    diff={node}
                    showUnchanged={showUnchanged}
                  />
                ))}
              </div>

              {(stats.edgesAdded > 0 || stats.edgesRemoved > 0) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Connection Changes
                  </h3>
                  <div className="space-y-2">
                    {diff.edges.map((edge, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          edge.changeType === 'added'
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        }`}
                      >
                        {edge.changeType === 'added' ? (
                          <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Minus className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {edge.sourceName}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {edge.targetName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
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
