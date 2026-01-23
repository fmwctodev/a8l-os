import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getWorkflowById,
  updateWorkflowDraft,
  updateWorkflow,
  publishWorkflow,
  getWorkflowVersions,
} from '../../services/workflows';
import { TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS, validateWorkflowDefinition } from '../../services/workflowEngine';
import type {
  Workflow,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowTriggerType,
  WorkflowActionType,
  WorkflowVersion,
} from '../../types';
import {
  ArrowLeft,
  Save,
  Upload,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Zap,
  GitBranch,
  Clock,
  CheckCircle,
  Play,
  MessageSquare,
  Mail,
  Tag,
  User,
  Building2,
  FileText,
  Globe,
  X,
  History,
  ChevronDown,
} from 'lucide-react';
import { NodeConfigPanel } from '../../components/automation/NodeConfigPanel';

const NODE_COLORS: Record<WorkflowNodeType, { bg: string; border: string; icon: string }> = {
  trigger: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', icon: 'text-emerald-400' },
  condition: { bg: 'bg-amber-500/10', border: 'border-amber-500/50', icon: 'text-amber-400' },
  delay: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', icon: 'text-blue-400' },
  action: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/50', icon: 'text-cyan-400' },
  end: { bg: 'bg-slate-500/10', border: 'border-slate-500/50', icon: 'text-slate-400' },
};

const NODE_ICONS: Record<WorkflowNodeType, typeof Zap> = {
  trigger: Zap,
  condition: GitBranch,
  delay: Clock,
  action: Play,
  end: CheckCircle,
};

export function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, hasPermission } = useAuth();
  const canManage = hasPermission('automation.manage');

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [definition, setDefinition] = useState<WorkflowDefinition>({
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const [showAddNode, setShowAddNode] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const loadWorkflow = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const data = await getWorkflowById(id);
      if (data) {
        setWorkflow(data);
        setDefinition(data.draft_definition);
        setNameValue(data.name);
      } else {
        setError('Workflow not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  const handleSave = async () => {
    if (!id || !canManage) return;

    try {
      setIsSaving(true);
      await updateWorkflowDraft(id, definition);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id || !currentUser || !canManage) return;

    const validation = validateWorkflowDefinition(definition);
    if (!validation.valid) {
      setError(`Cannot publish: ${validation.errors.join(', ')}`);
      return;
    }

    if (!confirm('Are you sure you want to publish this workflow? It will become active immediately.')) {
      return;
    }

    try {
      setIsPublishing(true);
      await updateWorkflowDraft(id, definition);
      await publishWorkflow(id, currentUser.id);
      await loadWorkflow();
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleNameSave = async () => {
    if (!id || !nameValue.trim() || !canManage) return;

    try {
      await updateWorkflow(id, { name: nameValue.trim() });
      setWorkflow((prev) => (prev ? { ...prev, name: nameValue.trim() } : null));
      setEditingName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update name');
    }
  };

  const handleLoadVersions = async () => {
    if (!id) return;

    try {
      const data = await getWorkflowVersions(id);
      setVersions(data);
      setShowVersions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    }
  };

  const updateDefinition = (newDef: WorkflowDefinition) => {
    setDefinition(newDef);
    setHasChanges(true);
  };

  const addNode = (type: WorkflowNodeType, data: Record<string, unknown> = {}) => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      position: { x: 250, y: definition.nodes.length * 120 + 50 },
      data,
    };

    updateDefinition({
      ...definition,
      nodes: [...definition.nodes, newNode],
    });
    setShowAddNode(false);
    setSelectedNodeId(newNode.id);
  };

  const deleteNode = (nodeId: string) => {
    updateDefinition({
      ...definition,
      nodes: definition.nodes.filter((n) => n.id !== nodeId),
      edges: definition.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  const updateNode = (nodeId: string, data: Record<string, unknown>) => {
    updateDefinition({
      ...definition,
      nodes: definition.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    });
  };

  const connectNodes = (sourceId: string, targetId: string, sourceHandle?: string) => {
    const existingEdge = definition.edges.find(
      (e) => e.source === sourceId && e.sourceHandle === sourceHandle
    );

    if (existingEdge) {
      updateDefinition({
        ...definition,
        edges: definition.edges.map((e) =>
          e.source === sourceId && e.sourceHandle === sourceHandle
            ? { ...e, target: targetId }
            : e
        ),
      });
    } else {
      const newEdge: WorkflowEdge = {
        id: `edge-${Date.now()}`,
        source: sourceId,
        target: targetId,
        sourceHandle,
      };
      updateDefinition({
        ...definition,
        edges: [...definition.edges, newEdge],
      });
    }
  };

  const deleteEdge = (edgeId: string) => {
    updateDefinition({
      ...definition,
      edges: definition.edges.filter((e) => e.id !== edgeId),
    });
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (!canManage) return;
    const node = definition.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setDragNode(nodeId);
    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragNode) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    updateDefinition({
      ...definition,
      nodes: definition.nodes.map((n) =>
        n.id === dragNode ? { ...n, position: { x: Math.max(0, newX), y: Math.max(0, newY) } } : n
      ),
    });
  };

  const handleMouseUp = () => {
    setDragNode(null);
  };

  const getNodeLabel = (node: WorkflowNode): string => {
    if (node.type === 'trigger') {
      const triggerType = (node.data as { triggerType?: WorkflowTriggerType }).triggerType;
      return triggerType ? TRIGGER_TYPE_LABELS[triggerType] || 'Trigger' : 'Select Trigger';
    }
    if (node.type === 'action') {
      const actionType = (node.data as { actionType?: WorkflowActionType }).actionType;
      return actionType ? ACTION_TYPE_LABELS[actionType] || 'Action' : 'Select Action';
    }
    if (node.type === 'delay') {
      const delayData = node.data as { delayType?: string; duration?: { value: number; unit: string } };
      if (delayData.duration) {
        return `Wait ${delayData.duration.value} ${delayData.duration.unit}`;
      }
      return 'Delay';
    }
    if (node.type === 'condition') {
      return 'Condition';
    }
    if (node.type === 'end') {
      return 'End';
    }
    return node.type;
  };

  const selectedNode = definition.nodes.find((n) => n.id === selectedNodeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error && !workflow) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">Error loading workflow</p>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/automation')}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  autoFocus
                  onBlur={handleNameSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                />
              </div>
            ) : (
              <h1
                className="text-lg font-semibold text-white cursor-pointer hover:text-cyan-400 transition-colors"
                onClick={() => canManage && setEditingName(true)}
              >
                {workflow?.name}
              </h1>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  workflow?.status === 'published'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : workflow?.status === 'draft'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-slate-500/10 text-slate-400'
                }`}
              >
                {workflow?.status}
              </span>
              {hasChanges && <span className="text-amber-400">Unsaved changes</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadVersions}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <History className="w-4 h-4" />
            History
          </button>
          {canManage && (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Draft
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors disabled:opacity-50"
              >
                {isPublishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Publish
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 hover:text-red-300">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 flex">
        <div className="w-64 bg-slate-900 border-r border-slate-800 p-4 overflow-y-auto">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Add Node
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => addNode('trigger', {})}
              disabled={!canManage || definition.nodes.some((n) => n.type === 'trigger')}
              className="w-full p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-5 h-5" />
              <span className="text-sm font-medium">Trigger</span>
            </button>
            <button
              onClick={() => addNode('condition', { conditions: { logic: 'and', rules: [] } })}
              disabled={!canManage}
              className="w-full p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors flex items-center gap-3 disabled:opacity-50"
            >
              <GitBranch className="w-5 h-5" />
              <span className="text-sm font-medium">Condition</span>
            </button>
            <button
              onClick={() => addNode('delay', { delayType: 'wait_duration' })}
              disabled={!canManage}
              className="w-full p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-3 disabled:opacity-50"
            >
              <Clock className="w-5 h-5" />
              <span className="text-sm font-medium">Delay</span>
            </button>
            <button
              onClick={() => addNode('action', {})}
              disabled={!canManage}
              className="w-full p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors flex items-center gap-3 disabled:opacity-50"
            >
              <Play className="w-5 h-5" />
              <span className="text-sm font-medium">Action</span>
            </button>
            <button
              onClick={() => addNode('end', {})}
              disabled={!canManage}
              className="w-full p-3 rounded-lg bg-slate-500/10 border border-slate-500/30 text-slate-400 hover:bg-slate-500/20 transition-colors flex items-center gap-3 disabled:opacity-50"
            >
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">End</span>
            </button>
          </div>

          {definition.nodes.length > 1 && (
            <>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mt-6 mb-3">
                Connect Nodes
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Select a source node, then click a target node to connect them.
              </p>
            </>
          )}
        </div>

        <div
          ref={canvasRef}
          className="flex-1 bg-slate-950 overflow-auto relative"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(100,116,139,0.15) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              minWidth: '2000px',
              minHeight: '2000px',
            }}
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {definition.edges.map((edge) => {
                const sourceNode = definition.nodes.find((n) => n.id === edge.source);
                const targetNode = definition.nodes.find((n) => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const sourceX = sourceNode.position.x + 120;
                const sourceY =
                  sourceNode.type === 'condition'
                    ? sourceNode.position.y + (edge.sourceHandle === 'true' ? 30 : 50)
                    : sourceNode.position.y + 40;
                const targetX = targetNode.position.x;
                const targetY = targetNode.position.y + 40;

                const midX = (sourceX + targetX) / 2;

                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`}
                      fill="none"
                      stroke={
                        edge.sourceHandle === 'true'
                          ? '#10b981'
                          : edge.sourceHandle === 'false'
                          ? '#ef4444'
                          : '#0ea5e9'
                      }
                      strokeWidth="2"
                      strokeDasharray={edge.sourceHandle ? '5,5' : undefined}
                    />
                    <circle cx={targetX} cy={targetY} r="4" fill="#0ea5e9" />
                    {canManage && (
                      <circle
                        cx={midX}
                        cy={(sourceY + targetY) / 2}
                        r="8"
                        fill="#1e293b"
                        stroke="#334155"
                        className="cursor-pointer hover:fill-red-500/20"
                        onClick={() => deleteEdge(edge.id)}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {definition.nodes.map((node) => {
              const Icon = NODE_ICONS[node.type];
              const colors = NODE_COLORS[node.type];
              const isSelected = selectedNodeId === node.id;

              return (
                <div
                  key={node.id}
                  className={`absolute w-60 rounded-lg border-2 ${colors.bg} ${
                    isSelected ? 'border-cyan-500' : colors.border
                  } cursor-move transition-shadow hover:shadow-lg`}
                  style={{
                    left: node.position.x,
                    top: node.position.y,
                    zIndex: isSelected ? 10 : 1,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!dragNode) setSelectedNodeId(node.id);
                  }}
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${colors.icon}`} />
                        <span className="text-xs font-medium text-slate-400 uppercase">
                          {node.type}
                        </span>
                      </div>
                      {canManage && node.type !== 'trigger' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNode(node.id);
                          }}
                          className="p-1 rounded hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-white font-medium truncate">{getNodeLabel(node)}</p>
                  </div>

                  {node.type === 'condition' && (
                    <div className="flex border-t border-slate-700/50">
                      <button
                        className="flex-1 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 border-r border-slate-700/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          const otherNodes = definition.nodes.filter(
                            (n) => n.id !== node.id && n.type !== 'trigger'
                          );
                          if (otherNodes.length > 0) {
                            connectNodes(node.id, otherNodes[0].id, 'true');
                          }
                        }}
                      >
                        True
                      </button>
                      <button
                        className="flex-1 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          const otherNodes = definition.nodes.filter(
                            (n) => n.id !== node.id && n.type !== 'trigger'
                          );
                          if (otherNodes.length > 0) {
                            connectNodes(node.id, otherNodes[0].id, 'false');
                          }
                        }}
                      >
                        False
                      </button>
                    </div>
                  )}

                  {node.type !== 'end' && node.type !== 'condition' && (
                    <button
                      className="w-full py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10 border-t border-slate-700/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        const otherNodes = definition.nodes.filter(
                          (n) => n.id !== node.id && n.type !== 'trigger'
                        );
                        if (otherNodes.length > 0) {
                          connectNodes(node.id, otherNodes[0].id);
                        }
                      }}
                    >
                      Connect to next
                    </button>
                  )}
                </div>
              );
            })}

            {definition.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Zap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-white font-medium mb-1">Start building your workflow</p>
                  <p className="text-slate-400 text-sm mb-4">
                    Add a trigger to begin your automation
                  </p>
                  {canManage && (
                    <button
                      onClick={() => addNode('trigger', {})}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Trigger
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={(data) => updateNode(selectedNode.id, data)}
            onClose={() => setSelectedNodeId(null)}
            canEdit={canManage}
          />
        )}
      </div>

      {showVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowVersions(false)} />
          <div className="relative w-full max-w-lg bg-slate-900 rounded-xl border border-slate-800 shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Version History</h2>
              <button
                onClick={() => setShowVersions(false)}
                className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {versions.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  No published versions yet
                </p>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">
                          Version {version.version_number}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(version.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {version.created_by && (
                        <p className="text-sm text-slate-400 mt-1">
                          Published by {version.created_by.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
