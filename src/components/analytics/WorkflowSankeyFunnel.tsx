import { useMemo, useState } from 'react';
import {
  Zap,
  GitBranch,
  Timer,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { StepFunnelData } from '../../services/workflowAnalytics';
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge } from '../../types';

interface WorkflowSankeyFunnelProps {
  stepData: StepFunnelData[];
  definition: WorkflowDefinition;
  totalEnrollments: number;
}

interface LayoutNode {
  id: string;
  data: StepFunnelData;
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
  branchDepth: number;
}

interface LayoutLink {
  source: LayoutNode;
  target: LayoutNode;
  value: number;
  flowType: 'success' | 'failed' | 'dropped';
  branchLabel?: string;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 80;
const COLUMN_GAP = 120;
const ROW_GAP = 40;
const PADDING = 40;

function buildLayout(
  definition: WorkflowDefinition,
  stepData: StepFunnelData[]
): { nodes: LayoutNode[]; links: LayoutLink[]; width: number; height: number } {
  const stepMap = new Map<string, StepFunnelData>();
  stepData.forEach(s => stepMap.set(s.nodeId, s));

  const nodeMap = new Map<string, WorkflowNode>();
  definition.nodes.forEach(n => nodeMap.set(n.id, n));

  const edgesBySource = new Map<string, WorkflowEdge[]>();
  definition.edges.forEach(e => {
    const existing = edgesBySource.get(e.source) || [];
    existing.push(e);
    edgesBySource.set(e.source, existing);
  });

  const triggerNode = definition.nodes.find(n => n.type === 'trigger');
  if (!triggerNode) return { nodes: [], links: [], width: 0, height: 0 };

  const visited = new Set<string>();
  const columns: string[][] = [];
  const nodeColumns = new Map<string, number>();
  const nodeBranchDepth = new Map<string, number>();

  function assignColumns(nodeId: string, col: number, branchDepth: number) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    if (!columns[col]) columns[col] = [];
    columns[col].push(nodeId);
    nodeColumns.set(nodeId, col);
    nodeBranchDepth.set(nodeId, branchDepth);

    const outEdges = edgesBySource.get(nodeId) || [];
    const node = nodeMap.get(nodeId);
    const isCondition = node?.type === 'condition';

    outEdges.forEach((edge, idx) => {
      const newDepth = isCondition ? branchDepth + idx : branchDepth;
      assignColumns(edge.target, col + 1, newDepth);
    });
  }

  assignColumns(triggerNode.id, 0, 0);

  const layoutNodes: LayoutNode[] = [];
  let maxY = 0;

  columns.forEach((colNodes, colIndex) => {
    const sortedNodes = colNodes.sort((a, b) => {
      const depthA = nodeBranchDepth.get(a) || 0;
      const depthB = nodeBranchDepth.get(b) || 0;
      return depthA - depthB;
    });

    sortedNodes.forEach((nodeId, rowIndex) => {
      const data = stepMap.get(nodeId);
      if (!data) return;

      const x = PADDING + colIndex * (NODE_WIDTH + COLUMN_GAP);
      const y = PADDING + rowIndex * (NODE_HEIGHT + ROW_GAP);

      layoutNodes.push({
        id: nodeId,
        data,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        column: colIndex,
        branchDepth: nodeBranchDepth.get(nodeId) || 0
      });

      if (y + NODE_HEIGHT > maxY) maxY = y + NODE_HEIGHT;
    });
  });

  const layoutNodeMap = new Map<string, LayoutNode>();
  layoutNodes.forEach(n => layoutNodeMap.set(n.id, n));

  const layoutLinks: LayoutLink[] = [];

  definition.edges.forEach(edge => {
    const source = layoutNodeMap.get(edge.source);
    const target = layoutNodeMap.get(edge.target);
    if (!source || !target) return;

    const sourceData = source.data;
    const targetData = target.data;

    const successFlow = Math.min(sourceData.succeeded, targetData.reached);
    if (successFlow > 0) {
      layoutLinks.push({
        source,
        target,
        value: successFlow,
        flowType: 'success',
        branchLabel: edge.sourceHandle === 'true' ? 'Yes' :
          edge.sourceHandle === 'false' ? 'No' : undefined
      });
    }

    const failedFlow = sourceData.failed;
    if (failedFlow > 0 && target.data.nodeType !== 'end') {
      layoutLinks.push({
        source,
        target,
        value: failedFlow,
        flowType: 'failed'
      });
    }
  });

  const width = PADDING * 2 + columns.length * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP;
  const height = maxY + PADDING;

  return { nodes: layoutNodes, links: layoutLinks, width: Math.max(width, 600), height: Math.max(height, 300) };
}

function SankeyNode({
  node,
  totalEnrollments,
  isHovered,
  onHover
}: {
  node: LayoutNode;
  totalEnrollments: number;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const { data } = node;
  const completionRate = data.reached > 0 ? (data.succeeded / data.reached) * 100 : 0;
  const reachRate = totalEnrollments > 0 ? (data.reached / totalEnrollments) * 100 : 0;

  const barWidth = Math.max(8, (reachRate / 100) * (NODE_WIDTH - 16));

  const getNodeIcon = () => {
    switch (data.nodeType) {
      case 'trigger':
        return <Zap className="w-4 h-4" />;
      case 'condition':
        return <GitBranch className="w-4 h-4" />;
      case 'delay':
        return <Timer className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      className="cursor-pointer"
    >
      <rect
        width={node.width}
        height={node.height}
        rx={8}
        className={`fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-700 ${
          isHovered ? 'stroke-blue-500 stroke-2' : ''
        }`}
        style={{ filter: isHovered ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' : '' }}
      />

      <rect
        x={8}
        y={node.height - 16}
        width={barWidth}
        height={8}
        rx={4}
        className="fill-emerald-500"
      />

      <rect
        x={8}
        y={node.height - 16}
        width={NODE_WIDTH - 16}
        height={8}
        rx={4}
        className="fill-gray-200 dark:fill-gray-700"
        style={{ opacity: 0.3 }}
      />

      <foreignObject x={8} y={8} width={NODE_WIDTH - 16} height={NODE_HEIGHT - 32}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            {getNodeIcon()}
            <span className="text-xs font-medium truncate">{data.nodeName}</span>
          </div>
          <div className="mt-auto flex items-baseline gap-2">
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {data.reached.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500">reached</span>
          </div>
        </div>
      </foreignObject>

      {isHovered && (
        <foreignObject x={node.width + 8} y={0} width={200} height={120}>
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg p-3 shadow-xl">
            <p className="font-medium mb-2">{data.nodeName}</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Reached:</span>
                <span>{data.reached.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Succeeded:</span>
                <span className="text-emerald-400">{data.succeeded.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Failed:</span>
                <span className="text-red-400">{data.failed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Waiting:</span>
                <span className="text-amber-400">{data.waiting.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-700">
                <span className="text-gray-400">Success Rate:</span>
                <span>{completionRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

function SankeyLink({ link }: { link: LayoutLink }) {
  const { source, target, value, flowType, branchLabel } = link;

  const sourceX = source.x + source.width;
  const sourceY = source.y + source.height / 2;
  const targetX = target.x;
  const targetY = target.y + target.height / 2;

  const midX = (sourceX + targetX) / 2;

  const path = `M ${sourceX} ${sourceY}
    C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;

  const strokeWidth = Math.max(2, Math.min(20, (value / 100) * 10));

  const strokeColor = {
    success: 'stroke-emerald-400',
    failed: 'stroke-red-400',
    dropped: 'stroke-gray-300'
  }[flowType];

  return (
    <g>
      <path
        d={path}
        fill="none"
        className={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={0.6}
        strokeLinecap="round"
      />
      {branchLabel && (
        <text
          x={sourceX + 20}
          y={sourceY - 8}
          className="fill-gray-500 dark:fill-gray-400 text-xs"
        >
          {branchLabel}
        </text>
      )}
    </g>
  );
}

export function WorkflowSankeyFunnel({
  stepData,
  definition,
  totalEnrollments
}: WorkflowSankeyFunnelProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [scrollX, setScrollX] = useState(0);

  const { nodes, links, width, height } = useMemo(
    () => buildLayout(definition, stepData),
    [definition, stepData]
  );

  const canScrollLeft = scrollX > 0;
  const canScrollRight = scrollX < width - 600;

  const handleScroll = (direction: 'left' | 'right') => {
    const delta = 200;
    if (direction === 'left') {
      setScrollX(Math.max(0, scrollX - delta));
    } else {
      setScrollX(Math.min(width - 600, scrollX + delta));
    }
  };

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p>No funnel data available</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      )}

      {canScrollRight && (
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <svg
          width="100%"
          height={height}
          viewBox={`${scrollX} 0 ${Math.min(width, 800)} ${height}`}
          preserveAspectRatio="xMinYMin meet"
        >
          <g>
            {links.map((link, i) => (
              <SankeyLink key={i} link={link} />
            ))}
          </g>

          <g>
            {nodes.map(node => (
              <SankeyNode
                key={node.id}
                node={node}
                totalEnrollments={totalEnrollments}
                isHovered={hoveredNode === node.id}
                onHover={setHoveredNode}
              />
            ))}
          </g>
        </svg>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-emerald-400 rounded" />
          <span className="text-gray-600 dark:text-gray-400">Success flow</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-red-400 rounded" />
          <span className="text-gray-600 dark:text-gray-400">Failed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-gray-300 rounded" />
          <span className="text-gray-600 dark:text-gray-400">Drop-off</span>
        </div>
      </div>
    </div>
  );
}
