import { useState, useCallback, useRef, useMemo } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
} from '@xyflow/react';
import type {
  BuilderNode,
  BuilderEdge,
  BuilderNodeData,
  DrawerMode,
  ValidationIssue,
} from '../../../types/workflowBuilder';
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  TriggerNodeData,
} from '../../../types';
import {
  getDefaultNodeData,
  getDefaultLabel,
} from '../../../types/workflowBuilder';
import { validateWorkflow } from './utils/workflowValidation';
import { getLayoutedElements } from './utils/layoutEngine';

function workflowNodeToBuilder(wn: WorkflowNode): BuilderNode {
  return {
    id: wn.id,
    type: wn.type,
    position: wn.position,
    data: {
      nodeType: wn.type,
      nodeData: wn.data,
      label: wn.label || getDefaultLabel(wn.type, (wn.data as any)?.actionType || (wn.data as any)?.triggerType),
      description: wn.description,
      isValid: true,
      validationErrors: [],
    },
  };
}

function workflowEdgeToBuilder(we: WorkflowEdge): BuilderEdge {
  return {
    id: we.id,
    source: we.source,
    target: we.target,
    sourceHandle: we.sourceHandle ?? undefined,
    targetHandle: we.targetHandle ?? undefined,
    type: 'insertable',
    data: { insertable: true },
  };
}

function builderNodeToWorkflow(bn: BuilderNode): WorkflowNode {
  return {
    id: bn.id,
    type: bn.data.nodeType as WorkflowNodeType,
    position: bn.position,
    data: bn.data.nodeData,
    label: bn.data.label,
    description: bn.data.description,
  };
}

function builderEdgeToWorkflow(be: BuilderEdge): WorkflowEdge {
  return {
    id: be.id,
    source: be.source,
    target: be.target,
    sourceHandle: be.sourceHandle ?? undefined,
    targetHandle: be.targetHandle ?? undefined,
  };
}

export function useBuilderState(initialDefinition?: WorkflowDefinition) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialDefinition?.nodes.map(workflowNodeToBuilder) ?? []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialDefinition?.edges.map(workflowEdgeToBuilder) ?? []
  );
  const [drawerMode, setDrawerMode] = useState<DrawerMode>({ type: 'closed' });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [statsMode, setStatsMode] = useState(false);
  const changeCountRef = useRef(0);

  const typedNodes = nodes as BuilderNode[];
  const typedEdges = edges as BuilderEdge[];

  const markChanged = useCallback(() => {
    setHasUnsavedChanges(true);
    changeCountRef.current += 1;
  }, []);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) =>
      addEdge({ ...params, type: 'insertable', data: { insertable: true } }, eds)
    );
    markChanged();
  }, [setEdges, markChanged]);

  const addNode = useCallback((
    nodeType: WorkflowNodeType,
    actionType?: string,
    insertionEdgeId?: string,
  ) => {
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nodeData = getDefaultNodeData(nodeType, actionType);
    const label = getDefaultLabel(nodeType, actionType);

    const newNode: BuilderNode = {
      id,
      type: nodeType,
      position: { x: 0, y: 0 },
      data: {
        nodeType,
        nodeData: nodeData,
        label,
        isValid: nodeType === 'end',
        validationErrors: nodeType === 'end' ? [] : ['Not configured'],
      },
    };

    if (insertionEdgeId) {
      setEdges((eds) => {
        const edge = eds.find(e => e.id === insertionEdgeId);
        if (!edge) return eds;

        const sourceNode = typedNodes.find(n => n.id === edge.source);
        const targetNode = typedNodes.find(n => n.id === edge.target);
        if (sourceNode && targetNode) {
          newNode.position = {
            x: (sourceNode.position.x + targetNode.position.x) / 2,
            y: (sourceNode.position.y + targetNode.position.y) / 2,
          };
        }

        const filtered = eds.filter(e => e.id !== insertionEdgeId);

        const newEdge1: BuilderEdge = {
          id: `edge_${Date.now()}_a`,
          source: edge.source,
          target: id,
          sourceHandle: edge.sourceHandle ?? undefined,
          type: 'insertable',
          data: { insertable: true },
        };

        const sourceHandle = nodeType === 'condition' ? 'yes' : undefined;
        const newEdge2: BuilderEdge = {
          id: `edge_${Date.now()}_b`,
          source: id,
          target: edge.target,
          sourceHandle,
          type: 'insertable',
          data: { insertable: true },
        };

        return [...filtered, newEdge1, newEdge2] as typeof eds;
      });
    } else {
      const triggers = typedNodes.filter(n => n.data.nodeType === 'trigger');
      if (nodeType === 'trigger') {
        const lastTrigger = triggers[triggers.length - 1];
        newNode.position = {
          x: lastTrigger ? lastTrigger.position.x + 300 : 200,
          y: lastTrigger ? lastTrigger.position.y : 40,
        };
      } else {
        const lastNode = typedNodes[typedNodes.length - 1];
        newNode.position = {
          x: lastNode ? lastNode.position.x : 200,
          y: lastNode ? lastNode.position.y + 120 : 200,
        };
      }
    }

    setNodes((nds) => [...nds, newNode as Node] as typeof nds);
    markChanged();

    setDrawerMode({ type: 'node-config', nodeId: id });

    return id;
  }, [typedNodes, setNodes, setEdges, markChanged]);

  const addTrigger = useCallback((triggerType: string) => {
    const id = `trigger_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const endId = `end_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const triggers = typedNodes.filter(n => n.data.nodeType === 'trigger');

    const triggerX = triggers.length > 0 ? triggers[triggers.length - 1].position.x + 300 : 200;
    const triggerY = 40;

    const triggerData: TriggerNodeData = {
      triggerType: triggerType as any,
      triggerCategory: 'event',
    };

    const newTriggerNode: BuilderNode = {
      id,
      type: 'trigger',
      position: { x: triggerX, y: triggerY },
      data: {
        nodeType: 'trigger',
        nodeData: triggerData,
        label: getDefaultLabel('trigger', triggerType),
        isValid: true,
        validationErrors: [],
      },
    };

    const newEndNode: BuilderNode = {
      id: endId,
      type: 'end',
      position: { x: triggerX, y: triggerY + 140 },
      data: {
        nodeType: 'end',
        nodeData: {},
        label: 'End',
        isValid: true,
        validationErrors: [],
      },
    };

    const newEdge: BuilderEdge = {
      id: `edge_${Date.now()}_trigger_end`,
      source: id,
      target: endId,
      type: 'insertable',
      data: { insertable: true },
    };

    setNodes((nds) => [...nds, newTriggerNode as Node, newEndNode as Node] as typeof nds);
    setEdges((eds) => [...eds, newEdge as typeof eds[0]] as typeof eds);
    markChanged();

    setDrawerMode({ type: 'node-config', nodeId: id });
    return id;
  }, [typedNodes, setNodes, setEdges, markChanged]);

  const updateNodeData = useCallback((nodeId: string, updater: (data: BuilderNodeData) => BuilderNodeData) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: updater(n.data as BuilderNodeData) } as typeof n : n
      )
    );
    markChanged();
  }, [setNodes, markChanged]);

  const deleteNode = useCallback((nodeId: string) => {
    const node = typedNodes.find(n => n.id === nodeId);
    if (!node) return;

    const incomingEdges = typedEdges.filter(e => e.target === nodeId);
    const outgoingEdges = typedEdges.filter(e => e.source === nodeId);

    setEdges((eds) => {
      let updated = eds.filter(e => e.source !== nodeId && e.target !== nodeId);

      if (node.data.nodeType !== 'condition' && incomingEdges.length === 1 && outgoingEdges.length === 1) {
        const reconnect: BuilderEdge = {
          id: `edge_${Date.now()}_reconnect`,
          source: incomingEdges[0].source,
          target: outgoingEdges[0].target,
          sourceHandle: incomingEdges[0].sourceHandle ?? undefined,
          type: 'insertable',
          data: { insertable: true },
        };
        updated = [...updated, reconnect as typeof eds[0]];
      }

      return updated;
    });

    setNodes((nds) => nds.filter(n => n.id !== nodeId));
    markChanged();

    if (drawerMode.type === 'node-config' && drawerMode.nodeId === nodeId) {
      setDrawerMode({ type: 'closed' });
    }
  }, [typedNodes, typedEdges, setNodes, setEdges, markChanged, drawerMode]);

  const validationIssues = useMemo<ValidationIssue[]>(() => {
    return validateWorkflow(typedNodes, typedEdges);
  }, [typedNodes, typedEdges]);

  const toWorkflowDefinition = useCallback((viewport?: { x: number; y: number; zoom: number }): WorkflowDefinition => {
    return {
      nodes: typedNodes.map(builderNodeToWorkflow),
      edges: typedEdges.map(builderEdgeToWorkflow),
      viewport: viewport ?? { x: 0, y: 0, zoom: 1 },
    };
  }, [typedNodes, typedEdges]);

  const loadDefinition = useCallback((def: WorkflowDefinition) => {
    setNodes(def.nodes.map(workflowNodeToBuilder) as any);
    setEdges(def.edges.map(workflowEdgeToBuilder) as any);
    setHasUnsavedChanges(false);
  }, [setNodes, setEdges]);

  const autoLayout = useCallback(() => {
    const result = getLayoutedElements(typedNodes, typedEdges);
    setNodes(result.nodes as any);
    setEdges(result.edges as any);
    markChanged();
  }, [typedNodes, typedEdges, setNodes, setEdges, markChanged]);

  const clearUnsavedFlag = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

  return {
    nodes: typedNodes,
    edges: typedEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    addTrigger,
    updateNodeData,
    deleteNode,
    drawerMode,
    setDrawerMode,
    hasUnsavedChanges,
    clearUnsavedFlag,
    statsMode,
    setStatsMode,
    validationIssues,
    toWorkflowDefinition,
    loadDefinition,
    autoLayout,
    markChanged,
  };
}
