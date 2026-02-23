import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { ClaraToolCall } from '../../../types/assistant';

interface ToolReceiptCardProps {
  toolCall: ClaraToolCall;
}

export function ToolReceiptCard({ toolCall }: ToolReceiptCardProps) {
  const [expanded, setExpanded] = useState(false);

  const StatusIcon = toolCall.status === 'success' ? CheckCircle : XCircle;
  const statusColor = toolCall.status === 'success' ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-slate-800 transition-colors"
      >
        <StatusIcon className={`w-3 h-3 flex-shrink-0 ${statusColor}`} />
        <span className="text-[11px] text-slate-300 font-mono flex-1 truncate">
          {toolCall.tool_name}
        </span>
        {toolCall.duration_ms > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
            <Clock className="w-2.5 h-2.5" />
            {toolCall.duration_ms}ms
          </span>
        )}
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-slate-500" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="px-2.5 py-2 border-t border-slate-700/40 space-y-1.5">
          <div>
            <p className="text-[9px] font-medium text-slate-500 uppercase mb-0.5">Input</p>
            <pre className="text-[10px] text-slate-400 bg-slate-900/50 rounded px-2 py-1 overflow-x-auto max-h-[80px] overflow-y-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.output !== undefined && (
            <div>
              <p className="text-[9px] font-medium text-slate-500 uppercase mb-0.5">Output</p>
              <pre className="text-[10px] text-slate-400 bg-slate-900/50 rounded px-2 py-1 overflow-x-auto max-h-[80px] overflow-y-auto">
                {typeof toolCall.output === 'string'
                  ? toolCall.output
                  : JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
