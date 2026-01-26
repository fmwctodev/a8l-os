import { useState } from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Pause,
  Timer,
  ChevronDown,
  ChevronRight,
  Bot,
  FileText,
  AlertTriangle,
  RefreshCw,
  Zap
} from 'lucide-react';
import type { WorkflowNode, WorkflowExecutionLog } from '../../types';

interface NodeExecutionModalProps {
  node: WorkflowNode;
  logs: WorkflowExecutionLog[];
  onClose: () => void;
  onViewInWorkflow?: () => void;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

function JsonViewer({ data, label }: { data: unknown; label: string }) {
  const [expanded, setExpanded] = useState(true);

  if (!data || (typeof data === 'object' && Object.keys(data as object).length === 0)) {
    return null;
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {expanded && (
        <pre className="p-3 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto bg-gray-900 text-gray-100">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function LogEntry({ log, index }: { log: WorkflowExecutionLog; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const getEventIcon = () => {
    switch (log.event_type) {
      case 'node_started':
        return <Play className="w-4 h-4 text-blue-500" />;
      case 'node_completed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'node_failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'node_waiting':
        return <Pause className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getEventLabel = () => {
    switch (log.event_type) {
      case 'node_started':
        return 'Started';
      case 'node_completed':
        return 'Completed';
      case 'node_failed':
        return 'Failed';
      case 'node_waiting':
        return 'Waiting';
      case 'node_skipped':
        return 'Skipped';
      default:
        return log.event_type;
    }
  };

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        <span className="text-xs text-gray-400 w-6">#{index + 1}</span>
        {getEventIcon()}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {getEventLabel()}
        </span>
        <span className="text-xs text-gray-500 ml-auto">
          {formatTimestamp(log.created_at)}
        </span>
        {log.duration_ms && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {formatDuration(log.duration_ms)}
          </span>
        )}
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && log.payload && Object.keys(log.payload).length > 0 && (
        <div className="px-3 pb-3 ml-9">
          <pre className="p-3 text-xs bg-gray-900 text-gray-100 rounded-lg overflow-x-auto">
            {JSON.stringify(log.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function NodeExecutionModal({
  node,
  logs,
  onClose,
  onViewInWorkflow
}: NodeExecutionModalProps) {
  const nodeData = node.data as {
    label?: string;
    name?: string;
    actionType?: string;
    config?: Record<string, unknown>;
  };

  const lastLog = logs[logs.length - 1];
  const startLog = logs.find(l => l.event_type === 'node_started');
  const endLog = logs.find(l =>
    ['node_completed', 'node_failed', 'node_waiting', 'node_skipped'].includes(l.event_type)
  );

  const totalDuration = startLog && endLog
    ? new Date(endLog.created_at).getTime() - new Date(startLog.created_at).getTime()
    : lastLog?.duration_ms;

  const errorPayload = logs.find(l => l.event_type === 'node_failed')?.payload;
  const resultPayload = logs.find(l => l.event_type === 'node_completed')?.payload;

  const isAIAction = nodeData.actionType?.startsWith('ai_');
  const aiOutput = resultPayload?.ai_output;
  const aiPrompt = resultPayload?.prompt_rendered || nodeData.config?.prompt;
  const aiTokens = resultPayload?.tokens_used;
  const aiLatency = resultPayload?.ai_latency_ms;
  const aiApprovalStatus = resultPayload?.approval_status;

  const retryAttempts = logs.filter(l => l.event_type === 'node_started').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Zap className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {nodeData.label || nodeData.name || node.id}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {node.type} {nodeData.actionType ? `- ${nodeData.actionType}` : ''}
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className={`text-sm font-medium mt-1 ${
                lastLog?.event_type === 'node_completed' ? 'text-emerald-600' :
                lastLog?.event_type === 'node_failed' ? 'text-red-600' :
                lastLog?.event_type === 'node_waiting' ? 'text-amber-600' :
                'text-gray-600 dark:text-gray-300'
              }`}>
                {lastLog?.event_type === 'node_completed' ? 'Completed' :
                 lastLog?.event_type === 'node_failed' ? 'Failed' :
                 lastLog?.event_type === 'node_waiting' ? 'Waiting' :
                 lastLog?.event_type === 'node_started' ? 'Running' :
                 'Pending'}
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                {totalDuration ? formatDuration(totalDuration) : '-'}
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Attempts</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                {retryAttempts || 0}
              </p>
            </div>

            {isAIAction && aiTokens && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">Tokens Used</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                  {aiTokens.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {errorPayload && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-300">
                    {errorPayload.error_type || 'Error'}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {errorPayload.error_message || 'An error occurred during execution'}
                  </p>
                  {errorPayload.retry_scheduled && (
                    <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      Retry scheduled
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {isAIAction && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                AI Execution Details
              </h3>

              {aiLatency && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  AI Response Time: {formatDuration(aiLatency)}
                </div>
              )}

              {aiApprovalStatus && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  aiApprovalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  aiApprovalStatus === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {aiApprovalStatus === 'approved' ? <CheckCircle className="w-4 h-4" /> :
                   aiApprovalStatus === 'rejected' ? <XCircle className="w-4 h-4" /> :
                   <Clock className="w-4 h-4" />}
                  {aiApprovalStatus === 'pending_approval' ? 'Pending Approval' : aiApprovalStatus}
                </div>
              )}

              {aiPrompt && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Rendered Prompt
                    </span>
                  </div>
                  <pre className="p-3 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
                    {typeof aiPrompt === 'string' ? aiPrompt : JSON.stringify(aiPrompt, null, 2)}
                  </pre>
                </div>
              )}

              {aiOutput && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      AI Output
                    </span>
                  </div>
                  <pre className="p-3 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
                    {typeof aiOutput === 'string' ? aiOutput : JSON.stringify(aiOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <JsonViewer data={nodeData.config} label="Node Configuration" />
          <JsonViewer data={resultPayload?.resolved_inputs} label="Resolved Inputs" />
          <JsonViewer data={resultPayload?.output} label="Execution Result" />

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Execution Log ({logs.length} entries)
            </h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <LogEntry key={log.id} log={log} index={index} />
                ))
              ) : (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No execution logs available
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          {onViewInWorkflow && (
            <button
              onClick={onViewInWorkflow}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              View in Workflow
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
