import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAutomationTemplateById,
  updateAutomationTemplateDraft,
  publishAutomationTemplate,
  createAutomationTemplate,
  getAutomationTemplateVersions,
} from '../../services/automationTemplates';
import { TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS, validateWorkflowDefinition } from '../../services/workflowEngine';
import type {
  AutomationTemplate,
  AutomationTemplateVersion,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowTriggerType,
  WorkflowActionType,
} from '../../types';
import { ArrowLeft, Save, Upload, Loader2, AlertCircle, Plus, Trash2, Zap, GitBranch, Clock, CheckCircle, Play, MessageSquare, Mail, Tag, User, Building2, FileText, Globe, X, History, ChevronDown, LayoutGrid as Layout } from 'lucide-react';
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

const NODE_TYPE_OPTIONS: { type: WorkflowNodeType; label: string; icon: typeof Zap }[] = [
  { type: 'trigger', label: 'Trigger', icon: Zap },
  { type: 'condition', label: 'Condition', icon: GitBranch },
  { type: 'delay', label: 'Delay', icon: Clock },
  { type: 'action', label: 'Action', icon: Play },
  { type: 'end', label: 'End', icon: CheckCircle },
];

export default function AutomationTemplateEditor() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { user: currentUser, hasPermission } = useAuth();
  const canManage = hasPermission('automation.manage');
  const isNewTemplate = templateId === 'new';

  const [template, setTemplate] = useState<AutomationTemplate | null>(null);
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
  const [showPublishInput, setShowPublishInput] = useState(false);
  const [publishSummary, setPublishSummary] = useState('');

  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const loadTemplate = useCallback(async () => {
    if (isNewTemplate) {
      setIsLoading(false);
      return;
    }
    if (!templateId) return;

    try {
      setIsLoading(true);
      const data = await getAutomationTemplateById(templateId);
      if (data) {
        setTemplate(data);
        if (data.latest_version) {
          setDefinition(data.latest_version.definition_snapshot);
        }
      } else {
        setError('Template not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setIsLoading(false);
    }
  }, [templateId, isNewTemplate]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const handleSave = async () => {
    if (!canManage) return;

    try {
      setIsSaving(true);

      if (isNewTemplate && !template) {
        if (!currentUser?.organization_id) return;
        const newTemplate = await createAutomationTemplate(
          currentUser.organization_id,
          'New Template',
          null,
          'sales',
          currentUser.id
        );
        setTemplate(newTemplate);
        await updateAutomationTemplateDraft(newTemplate.id, definition, currentUser.id);
        navigate(`/automation/templates/${newTemplate.id}/edit`, { replace: true });
      } else if (template && currentUser) {
        await updateAutomationTemplateDraft(template.id, definition, currentUser.id);
      }

      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const validation = validateWorkflowDefinition(definition);

  const handlePublish = async () => {
    if (!template || !currentUser || !canManage) return;

    if (!validation.valid) {
      // Show the first 3 distinct errors so the toast doesn't blow up
      const summary = validation.errors.slice(0, 3).join(', ');
      const more = validation.errors.length > 3 ? ` (+${validation.errors.length - 3} more)` : '';
      setError(`Cannot publish: ${summary}${more}`);
      return;
    }

    try {
      setIsPublishing(true);
      await updateAutomationTemplateDraft(template.id, definition, currentUser.id);
      await publishAutomationTemplate(template.id, currentUser.id, publishSummary || 'Published');
      await loadTemplate();
      setHasChanges(false);
      setShowPublishInput(false);
      setPublishSummary('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  };

  const addNode = (type: WorkflowNodeType) => {
    const id = `node_${Date.now()}`;
    const maxY = definition.nodes.reduce((max, n) => Math.max(max, n.position.y), 0);
    const newNode: WorkflowNode = {
      id,
      type,
      position: { x: 300, y: maxY + 120 },
      data: getDefaultNodeData(type),
    };
    setDefinition(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setHasChanges(true);
    setShowAddNode(false);
    setSelectedNodeId(id);
  };

  const deleteNode = (nodeId: string) => {
    setDefinition(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    }));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    setHasChanges(true);
  };

  const deleteEdge = (edgeId: string) => {
    setDefinition(prev => ({
      ...prev,
      edges: prev.edges.filter(e => e.id !== edgeId),
    }));
    setHasChanges(true);
  };

  const connectNodes = (sourceId: string, targetId: string, handle?: string) => {
    const edgeId = `edge_${Date.now()}`;
    const newEdge: WorkflowEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceHandle: handle,
    };
    setDefinition(prev => ({
      ...prev,
      edges: [...prev.edges, newEdge],
    }));
    setHasChanges(true);
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    const node = definition.nodes.find(n => n.id === nodeId);
    if (!node || !canManage) return;
    e.preventDefault();
    setDragNode(nodeId);
    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragNode) return;
    setDefinition(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === dragNode ? { ...n, position: { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y } } : n
      ),
    }));
    setHasChanges(true);
  };

  const handleMouseUp = () => {
    setDragNode(null);
  };

  const getNodeLabel = (node: WorkflowNode): string => {
    switch (node.type) {
      case 'trigger':
        return TRIGGER_TYPE_LABELS[(node.data as any).triggerType] || 'Trigger';
      case 'action':
        return ACTION_TYPE_LABELS[(node.data as any).actionType] || 'Action';
      case 'delay': {
        const d = node.data as any;
        if (d.delayType === 'wait_duration' && d.duration)
          return `Wait ${d.duration.value} ${d.duration.unit}`;
        return 'Delay';
      }
      case 'condition':
        return 'Condition';
      case 'end':
        return 'End';
      default:
        return node.type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error && !template && !isNewTemplate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">{error}</p>
        <button onClick={() => navigate('/automation/templates')} className="mt-4 text-sm text-cyan-400 hover:underline">
          Back to templates
        </button>
      </div>
    );
  }

  const selectedNode = definition.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 rounded-t-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(template ? `/automation/templates/${template.id}` : '/automation/templates')}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 text-xs font-medium text-teal-400 flex items-center gap-1">
              <Layout className="w-3 h-3" />
              Template Mode
            </div>
            <h1 className="text-lg font-semibold text-white">
              {template?.name || 'New Template'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && <span className="text-xs text-amber-400">Unsaved changes</span>}
          {error && <span className="text-xs text-red-400 max-w-[200px] truncate">{error}</span>}
          {canManage && (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors text-sm disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Draft
              </button>
              {!showPublishInput ? (
                <button
                  onClick={() => setShowPublishInput(true)}
                  disabled={isPublishing || !template}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium text-sm hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Publish
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={publishSummary}
                    onChange={(e) => setPublishSummary(e.target.value)}
                    placeholder="Change summary..."
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 w-48"
                    autoFocus
                  />
                  <button
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium text-sm"
                  >
                    {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Confirm
                  </button>
                  <button onClick={() => setShowPublishInput(false)} className="p-1.5 rounded hover:bg-slate-800">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto bg-slate-950"
          style={{ backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => setSelectedNodeId(null)}
        >
          {canManage && (
            <div className="absolute top-4 left-4 z-20">
              <div className="relative">
                <button
                  onClick={() => setShowAddNode(!showAddNode)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Node
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showAddNode && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAddNode(false)} />
                    <div className="absolute left-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                      {NODE_TYPE_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.type}
                            onClick={() => addNode(opt.type)}
                            className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                          >
                            <Icon className={`w-4 h-4 ${NODE_COLORS[opt.type].icon}`} />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '2000px', minHeight: '1500px' }}>
            {definition.edges.map(edge => {
              const sourceNode = definition.nodes.find(n => n.id === edge.source);
              const targetNode = definition.nodes.find(n => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const sx = sourceNode.position.x + 120;
              const sy = sourceNode.position.y + 50;
              const tx = targetNode.position.x + 120;
              const ty = targetNode.position.y;
              const my = (sy + ty) / 2;

              return (
                <g key={edge.id}>
                  <path
                    d={`M ${sx} ${sy} C ${sx} ${my}, ${tx} ${my}, ${tx} ${ty}`}
                    fill="none"
                    stroke={edge.sourceHandle === 'true' ? '#10b981' : edge.sourceHandle === 'false' ? '#ef4444' : '#475569'}
                    strokeWidth="2"
                    className="pointer-events-auto"
                  />
                  {edge.label && (
                    <text x={(sx + tx) / 2} y={my - 8} className="text-xs fill-slate-400" textAnchor="middle">
                      {edge.label}
                    </text>
                  )}
                  {canManage && (
                    <circle
                      cx={(sx + tx) / 2}
                      cy={my}
                      r="8"
                      fill="#1e293b"
                      stroke="#334155"
                      className="pointer-events-auto cursor-pointer hover:fill-red-500/20"
                      onClick={() => deleteEdge(edge.id)}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {definition.nodes.map(node => {
            const Icon = NODE_ICONS[node.type];
            const colors = NODE_COLORS[node.type];
            const isSelected = selectedNodeId === node.id;
            const nodeIssues = validation.nodeErrors[node.id] || [];
            const hasErrors = nodeIssues.length > 0;

            return (
              <div
                key={node.id}
                className={`absolute w-60 rounded-lg border-2 ${colors.bg} ${
                  isSelected
                    ? 'border-cyan-500'
                    : hasErrors
                      ? 'border-red-500/70'
                      : colors.border
                } cursor-move transition-shadow hover:shadow-lg`}
                style={{ left: node.position.x, top: node.position.y, zIndex: isSelected ? 10 : 1 }}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onClick={(e) => { e.stopPropagation(); if (!dragNode) setSelectedNodeId(node.id); }}
                title={hasErrors ? nodeIssues.join('\n') : undefined}
              >
                {hasErrors && (
                  <div className="absolute -top-2 -left-2 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold shadow ring-2 ring-slate-900">
                    <AlertCircle className="w-2.5 h-2.5" />
                    {nodeIssues.length > 1 ? nodeIssues.length : ''}
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${colors.icon}`} />
                      <span className="text-xs font-medium text-slate-400 uppercase">{node.type}</span>
                    </div>
                    {canManage && node.type !== 'trigger' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
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
                        const targets = definition.nodes.filter(n => n.id !== node.id && n.type !== 'trigger');
                        if (targets.length > 0) connectNodes(node.id, targets[0].id, 'true');
                      }}
                    >
                      True
                    </button>
                    <button
                      className="flex-1 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        const targets = definition.nodes.filter(n => n.id !== node.id && n.type !== 'trigger');
                        if (targets.length > 0) connectNodes(node.id, targets[0].id, 'false');
                      }}
                    >
                      False
                    </button>
                  </div>
                )}

                {node.type !== 'end' && node.type !== 'condition' && (
                  <button
                    className="w-full py-1.5 text-xs text-slate-400 hover:bg-slate-700/50 border-t border-slate-700/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targets = definition.nodes.filter(n => n.id !== node.id && n.type !== 'trigger');
                      if (targets.length > 0) connectNodes(node.id, targets[0].id);
                    }}
                  >
                    Connect
                  </button>
                )}
              </div>
            );
          })}

          {definition.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Zap className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">Empty Template</p>
                <p className="text-sm text-slate-400 mb-4">Add nodes to build your template workflow</p>
                {canManage && (
                  <button
                    onClick={() => addNode('trigger')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Trigger
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedNode && (
          <div className="w-80 bg-slate-900 border-l border-slate-800 overflow-y-auto flex-shrink-0">
            <NodeConfigPanel
              node={selectedNode}
              onUpdate={(updatedNode) => {
                setDefinition(prev => ({
                  ...prev,
                  nodes: prev.nodes.map(n => n.id === updatedNode.id ? updatedNode : n),
                }));
                setHasChanges(true);
              }}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function getDefaultNodeData(type: WorkflowNodeType) {
  switch (type) {
    case 'trigger':
      return { triggerType: 'contact_created', triggerCategory: 'event' };
    case 'condition':
      return { conditions: { logic: 'and', rules: [] } };
    case 'delay':
      return { delayType: 'wait_duration', duration: { value: 1, unit: 'days' } };
    case 'action':
      return { actionType: 'add_tag', config: { tagId: '', tagName: '' } };
    case 'end':
      return { label: 'End' };
    default:
      return {};
  }
}
