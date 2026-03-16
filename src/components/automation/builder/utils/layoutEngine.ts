import dagre from 'dagre';
import type { BuilderNode, BuilderEdge } from '../../../../types/workflowBuilder';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 80;
const TRIGGER_HEIGHT = 64;

export function getLayoutedElements(
  nodes: BuilderNode[],
  edges: BuilderEdge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: BuilderNode[]; edges: BuilderEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    const height = node.data.nodeType === 'trigger' ? TRIGGER_HEIGHT : NODE_HEIGHT;
    g.setNode(node.id, { width: NODE_WIDTH, height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map(node => {
    const pos = g.node(node.id);
    const height = node.data.nodeType === 'trigger' ? TRIGGER_HEIGHT : NODE_HEIGHT;
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
