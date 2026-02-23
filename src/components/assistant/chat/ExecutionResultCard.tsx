import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  Calendar,
  Users,
  BarChart3,
  FileText,
  MessageSquare,
  Brain,
  Briefcase,
  FolderKanban,
  CreditCard,
  ClipboardList,
  ListChecks,
} from 'lucide-react';
import type { ITSActionResult, ITSExecutionResult } from '../../../types/its';

interface ExecutionResultCardProps {
  executionResult: ITSExecutionResult;
}

const ACTION_ICONS: Record<string, typeof Mail> = {
  create_contact: Users,
  update_contact: Users,
  create_opportunity: Briefcase,
  move_opportunity: Briefcase,
  create_project: FolderKanban,
  create_task: ClipboardList,
  draft_email: Mail,
  send_email: Mail,
  send_sms: MessageSquare,
  create_event: Calendar,
  update_event: Calendar,
  cancel_event: Calendar,
  create_proposal_draft: FileText,
  create_invoice_draft: CreditCard,
  query_analytics: BarChart3,
  remember: Brain,
};

function StatusIcon({ status }: { status: ITSActionResult['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircle className="w-3 h-3 text-emerald-400" />;
    case 'failed':
      return <XCircle className="w-3 h-3 text-red-400" />;
    case 'skipped':
      return <AlertTriangle className="w-3 h-3 text-amber-400" />;
    default:
      return <AlertTriangle className="w-3 h-3 text-slate-500" />;
  }
}

function getStatusColor(status: ITSExecutionResult['status']): string {
  switch (status) {
    case 'success':
      return 'border-emerald-500/30 bg-emerald-500/5';
    case 'partial':
      return 'border-amber-500/30 bg-amber-500/5';
    case 'failed':
      return 'border-red-500/30 bg-red-500/5';
    default:
      return 'border-slate-600/30 bg-slate-800/30';
  }
}

function getStatusLabel(status: ITSExecutionResult['status']): string {
  switch (status) {
    case 'success':
      return 'All actions completed';
    case 'partial':
      return 'Some actions failed';
    case 'failed':
      return 'Execution failed';
    default:
      return status;
  }
}

function getStatusIcon(status: ITSExecutionResult['status']) {
  switch (status) {
    case 'success':
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case 'partial':
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <ListChecks className="w-4 h-4 text-slate-400" />;
  }
}

export function ExecutionResultCard({ executionResult }: ExecutionResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  const succeeded = executionResult.results.filter((r) => r.status === 'success').length;
  const failed = executionResult.results.filter((r) => r.status === 'failed').length;
  const total = executionResult.results.length;

  return (
    <div className={`border rounded-lg overflow-hidden ${getStatusColor(executionResult.status)}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {getStatusIcon(executionResult.status)}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-slate-200">
            {getStatusLabel(executionResult.status)}
          </p>
          <p className="text-[10px] text-slate-400">
            {succeeded}/{total} succeeded
            {failed > 0 && ` - ${failed} failed`}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {executionResult.results.map((result) => {
            const Icon = ACTION_ICONS[result.action_id.replace(/^a-\d+$/, '')] || ListChecks;
            return (
              <div
                key={result.action_id}
                className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/40 rounded"
              >
                <StatusIcon status={result.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-300 font-medium">
                    {result.action_id}
                  </p>
                  {result.error && (
                    <p className="text-[9px] text-red-400 truncate">{result.error}</p>
                  )}
                </div>
                {result.resource_id && (
                  <span className="text-[8px] text-slate-600 font-mono truncate max-w-[80px]">
                    {result.resource_id.substring(0, 8)}...
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
