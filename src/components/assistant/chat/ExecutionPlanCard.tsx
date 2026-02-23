import { useState } from 'react';
import {
  ListChecks,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
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
} from 'lucide-react';
import type { ITSAction, ITSRequest } from '../../../types/its';
import { confirmExecutionRequest } from '../../../services/assistantChat';

interface ExecutionPlanCardProps {
  itsRequest: ITSRequest;
  executionRequestId: string;
  threadId: string;
  onConfirmed?: () => void;
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

function formatActionLabel(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getActionSummary(action: ITSAction): string {
  const p = action.payload;
  switch (action.type) {
    case 'create_contact':
      return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'New contact';
    case 'update_contact':
      return `Update ${Object.keys(p.updates || {}).length} field(s)`;
    case 'create_opportunity':
      return p.value_amount ? `$${Number(p.value_amount).toLocaleString()}` : 'New opportunity';
    case 'move_opportunity':
      return 'Move to new stage';
    case 'create_project':
      return (p.name as string) || 'New project';
    case 'create_task':
      return (p.title as string) || 'New task';
    case 'draft_email':
    case 'send_email':
      return (p.subject as string) || `To: ${(p.to as string[])?.join(', ') || 'unknown'}`;
    case 'send_sms':
      return ((p.message as string) || '').substring(0, 60);
    case 'create_event':
      return (p.title as string) || 'New event';
    case 'update_event':
      return 'Update event';
    case 'cancel_event':
      return 'Cancel event';
    case 'create_proposal_draft':
      return (p.title as string) || 'New proposal';
    case 'create_invoice_draft':
      return `${((p.items as unknown[]) || []).length} item(s)`;
    case 'query_analytics':
      return (p.metric as string) || 'Query';
    case 'remember':
      return (p.key as string) || 'Memory';
    default:
      return action.type;
  }
}

export function ExecutionPlanCard({
  itsRequest,
  executionRequestId,
  threadId,
  onConfirmed,
}: ExecutionPlanCardProps) {
  const [state, setState] = useState<'pending' | 'approving' | 'rejecting' | 'approved' | 'rejected'>('pending');
  const [expanded, setExpanded] = useState(true);

  const handleApprove = async () => {
    setState('approving');
    try {
      await confirmExecutionRequest(threadId, executionRequestId, true);
      setState('approved');
      onConfirmed?.();
    } catch {
      setState('pending');
    }
  };

  const handleReject = async () => {
    setState('rejecting');
    try {
      await confirmExecutionRequest(threadId, executionRequestId, false);
      setState('rejected');
    } catch {
      setState('pending');
    }
  };

  const isDone = state === 'approved' || state === 'rejected';

  return (
    <div className={`border rounded-lg overflow-hidden ${
      isDone
        ? state === 'approved'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-slate-600/30 bg-slate-800/30'
        : 'border-amber-500/30 bg-amber-500/5'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <ShieldAlert className={`w-4 h-4 flex-shrink-0 ${
          isDone ? (state === 'approved' ? 'text-emerald-400' : 'text-slate-500') : 'text-amber-400'
        }`} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-slate-200">
            {isDone
              ? state === 'approved'
                ? 'Plan approved and executed'
                : 'Plan rejected'
              : 'Execution plan requires approval'}
          </p>
          <p className="text-[10px] text-slate-400">
            {itsRequest.actions.length} action{itsRequest.actions.length !== 1 ? 's' : ''}
            {itsRequest.confidence < 0.8 && ` - ${Math.round(itsRequest.confidence * 100)}% confidence`}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {itsRequest.confirmation_reason && (
            <p className="text-[10px] text-amber-400/80 bg-amber-500/5 px-2 py-1 rounded">
              {itsRequest.confirmation_reason}
            </p>
          )}

          <div className="space-y-1">
            {itsRequest.actions.map((action, i) => {
              const Icon = ACTION_ICONS[action.type] || ListChecks;
              return (
                <div key={action.action_id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/40 rounded">
                  <span className="text-[9px] text-slate-600 font-mono w-4 text-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <Icon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-300 font-medium truncate">
                      {formatActionLabel(action.type)}
                    </p>
                    <p className="text-[9px] text-slate-500 truncate">
                      {getActionSummary(action)}
                    </p>
                  </div>
                  {action.depends_on && (
                    <span className="text-[8px] text-slate-600 bg-slate-700/50 px-1 rounded flex-shrink-0">
                      after #{itsRequest.actions.findIndex((a) => a.action_id === action.depends_on) + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {!isDone && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleApprove}
                disabled={state !== 'pending'}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {state === 'approving' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Approve All
              </button>
              <button
                onClick={handleReject}
                disabled={state !== 'pending'}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
              >
                {state === 'rejecting' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
