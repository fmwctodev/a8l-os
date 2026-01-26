import { useState, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Pause,
  SkipForward,
  ChevronRight,
  ChevronDown,
  Zap,
  GitBranch,
  Timer,
  Mail,
  MessageSquare,
  Calendar,
  Bot,
  AlertTriangle
} from 'lucide-react';
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge, WorkflowExecutionLog } from '../../types';

type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting' | 'skipped';

interface ExecutionTimelineProps {
  definition: WorkflowDefinition;
  logs: WorkflowExecutionLog[];
  currentNodeId: string | null;
  enrollmentStatus: string;
  onNodeClick?: (nodeId: string, logs: WorkflowExecutionLog[]) => void;
  hasRecentChange?: (nodeId: string) => boolean;
}

interface TimelineNode {
  id: string;
  node: WorkflowNode;
  status: NodeStatus;
  logs: WorkflowExecutionLog[];
  duration?: number;
  timestamp?: string;
  children: TimelineNode[];
  branchLabel?: string;
}

const STATUS_ICONS: Record<NodeStatus, React.ElementType> = {
  pending: Clock,
  running: Play,
  completed: CheckCircle,
  failed: XCircle,
  waiting: Pause,
  skipped: SkipForward
};

const STATUS_COLORS: Record<NodeStatus, string> = {
  pending: 'text-gray-400',
  running: 'text-blue-500',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
  waiting: 'text-amber-500',
  skipped: 'text-gray-400'
};

const STATUS_BG: Record<NodeStatus, string> = {
  pending: 'bg-gray-100 dark:bg-gray-800',
  running: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  completed: 'bg-emerald-50 dark:bg-emerald-900/20',
  failed: 'bg-red-50 dark:bg-red-900/20',
  waiting: 'bg-amber-50 dark:bg-amber-900/20',
  skipped: 'bg-gray-50 dark:bg-gray-800/50'
};

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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 60000) return 'Just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getNodeStatus(
  nodeId: string,
  logs: WorkflowExecutionLog[],
  currentNodeId: string | null
): { status: NodeStatus; logs: WorkflowExecutionLog[]; duration?: number; timestamp?: string } {
  const nodeLogs = logs.filter(l => l.node_id === nodeId);

  if (nodeLogs.length === 0) {
    if (currentNodeId === nodeId) {
      return { status: 'running', logs: [] };
    }
    return { status: 'pending', logs: [] };
  }

  const lastLog = nodeLogs[nodeLogs.length - 1];
  const startLog = nodeLogs.find(l => l.event_type === 'node_started');
  const endLog = nodeLogs.find(l =>
    ['node_completed', 'node_failed', 'node_waiting', 'node_skipped'].includes(l.event_type)
  );

  let duration: number | undefined;
  if (startLog && endLog) {
    duration = new Date(endLog.created_at).getTime() - new Date(startLog.created_at).getTime();
  } else if (lastLog.duration_ms) {
    duration = lastLog.duration_ms;
  }

  let status: NodeStatus;
  switch (lastLog.event_type) {
    case 'node_started':
      status = 'running';
      break;
    case 'node_completed':
      status = 'completed';
      break;
    case 'node_failed':
      status = 'failed';
      break;
    case 'node_waiting':
      status = 'waiting';
      break;
    case 'node_skipped':
      status = 'skipped';
      break;
    default:
      status = 'pending';
  }

  return {
    status,
    logs: nodeLogs,
    duration,
    timestamp: lastLog.created_at
  };
}

function buildTimelineTree(
  definition: WorkflowDefinition,
  logs: WorkflowExecutionLog[],
  currentNodeId: string | null
): TimelineNode[] {
  const { nodes, edges } = definition;
  const nodeMap = new Map<string, WorkflowNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const edgesBySource = new Map<string, WorkflowEdge[]>();
  edges.forEach(e => {
    const existing = edgesBySource.get(e.source) || [];
    existing.push(e);
    edgesBySource.set(e.source, existing);
  });

  const triggerNode = nodes.find(n => n.type === 'trigger');
  if (!triggerNode) return [];

  const visited = new Set<string>();

  function buildNode(nodeId: string, branchLabel?: string): TimelineNode | null {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return null;

    const { status, logs: nodeLogs, duration, timestamp } = getNodeStatus(nodeId, logs, currentNodeId);

    const outEdges = edgesBySource.get(nodeId) || [];
    const children: TimelineNode[] = [];

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
      status,
      logs: nodeLogs,
      duration,
      timestamp,
      children,
      branchLabel
    };
  }

  const root = buildNode(triggerNode.id);
  return root ? [root] : [];
}

function TimelineNodeItem({
  item,
  depth = 0,
  onNodeClick,
  hasRecentChange
}: {
  item: TimelineNode;
  depth?: number;
  onNodeClick?: (nodeId: string, logs: WorkflowExecutionLog[]) => void;
  hasRecentChange?: (nodeId: string) => boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const StatusIcon = STATUS_ICONS[item.status];
  const NodeIcon = getNodeIcon(item.node);
  const hasChildren = item.children.length > 0;
  const isRecent = hasRecentChange?.(item.id);

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}>
      {item.branchLabel && (
        <div className="flex items-center gap-2 mb-1 text-xs text-gray-500 dark:text-gray-400">
          <GitBranch className="w-3 h-3" />
          <span>{item.branchLabel}</span>
        </div>
      )}

      <div
        className={`
          relative flex items-start gap-3 p-3 rounded-lg cursor-pointer
          transition-all duration-200
          ${STATUS_BG[item.status]}
          ${item.status === 'running' ? 'border-2 animate-pulse' : 'border border-transparent'}
          ${isRecent ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
          hover:shadow-md
        `}
        onClick={() => onNodeClick?.(item.id, item.logs)}
      >
        <div className={`flex-shrink-0 ${STATUS_COLORS[item.status]}`}>
          <StatusIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <NodeIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-white truncate">
              {getNodeLabel(item.node)}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
            {item.timestamp && (
              <span>{formatTimestamp(item.timestamp)}</span>
            )}
            {item.duration !== undefined && (
              <span className="flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {formatDuration(item.duration)}
              </span>
            )}
            {item.status === 'failed' && item.logs.length > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertTriangle className="w-3 h-3" />
                Error
              </span>
            )}
          </div>
        </div>

        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="mt-2 space-y-2">
          {item.children.map(child => (
            <TimelineNodeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              onNodeClick={onNodeClick}
              hasRecentChange={hasRecentChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExecutionTimeline({
  definition,
  logs,
  currentNodeId,
  enrollmentStatus,
  onNodeClick,
  hasRecentChange
}: ExecutionTimelineProps) {
  const timeline = useMemo(
    () => buildTimelineTree(definition, logs, currentNodeId),
    [definition, logs, currentNodeId]
  );

  const stats = useMemo(() => {
    const completed = logs.filter(l => l.event_type === 'node_completed').length;
    const failed = logs.filter(l => l.event_type === 'node_failed').length;
    const waiting = logs.filter(l => l.event_type === 'node_waiting').length;
    return { completed, failed, waiting };
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            enrollmentStatus === 'active' ? 'bg-emerald-500 animate-pulse' :
            enrollmentStatus === 'completed' ? 'bg-blue-500' :
            enrollmentStatus === 'errored' ? 'bg-red-500' :
            'bg-gray-400'
          }`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
            {enrollmentStatus}
          </span>
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />

        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            {stats.completed} completed
          </span>
          {stats.failed > 0 && (
            <span className="flex items-center gap-1">
              <XCircle className="w-4 h-4 text-red-500" />
              {stats.failed} failed
            </span>
          )}
          {stats.waiting > 0 && (
            <span className="flex items-center gap-1">
              <Pause className="w-4 h-4 text-amber-500" />
              {stats.waiting} waiting
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {timeline.map(item => (
          <TimelineNodeItem
            key={item.id}
            item={item}
            onNodeClick={onNodeClick}
            hasRecentChange={hasRecentChange}
          />
        ))}
      </div>

      {timeline.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No execution data available</p>
        </div>
      )}
    </div>
  );
}
