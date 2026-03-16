import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type ReactFlowInstance,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TriggerNode, ActionNode, ConditionNode, DelayNode, GoalNode, EndNode } from './nodes';
import { InsertableEdge } from './edges/InsertableEdge';

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  delay: DelayNode,
  goal: GoalNode,
  end: EndNode,
} as NodeTypes;

const defaultEdgeOptions = {
  type: 'insertable',
  animated: false,
};

interface WorkflowCanvasProps {
  nodes: any[];
  edges: any[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: any;
  onNodeClick: (nodeId: string) => void;
  onEdgeInsert: (edgeId: string) => void;
  onInit?: (instance: ReactFlowInstance) => void;
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeInsert,
  onInit,
}: WorkflowCanvasProps) {
  const reactFlowRef = useRef<HTMLDivElement>(null);

  const edgeTypes = {
    insertable: (props: any) => (
      <InsertableEdge {...props} data={{ ...props.data, onInsert: onEdgeInsert }} />
    ),
  };

  const handleNodeClick: NodeMouseHandler<any> = useCallback(
    (_event, node) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const handlePaneClick = useCallback(() => {
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selected = nodes.find((n: any) => n.selected);
        if (selected && selected.data?.nodeType !== 'trigger') {
        }
      }
    },
    [nodes]
  );

  return (
    <div ref={reactFlowRef} className="w-full h-full" onKeyDown={handleKeyDown}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={2}
        snapToGrid
        snapGrid={[20, 20]}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        className="bg-gray-50"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#d1d5db"
        />
        <Controls
          position="bottom-left"
          showInteractive={false}
          className="!shadow-md !border-gray-200 !rounded-lg overflow-hidden"
        />
        <MiniMap
          position="bottom-right"
          nodeColor={(node: any) => {
            const nodeType = node.data?.nodeType;
            switch (nodeType) {
              case 'trigger': return '#10b981';
              case 'action': return '#0ea5e9';
              case 'condition': return '#f59e0b';
              case 'delay': return '#3b82f6';
              case 'goal': return '#f43f5e';
              case 'end': return '#64748b';
              default: return '#94a3b8';
            }
          }}
          maskColor="rgba(0,0,0,0.08)"
          className="!shadow-md !border-gray-200 !rounded-lg"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
