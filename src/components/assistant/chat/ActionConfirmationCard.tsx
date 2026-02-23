import { useState } from 'react';
import { ShieldAlert, Check, X, Loader2 } from 'lucide-react';
import type { ClaraActionConfirmation } from '../../../types/assistant';

interface ActionConfirmationCardProps {
  confirmation: ClaraActionConfirmation;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export function ActionConfirmationCard({ confirmation, onApprove, onReject }: ActionConfirmationCardProps) {
  const [state, setState] = useState<'pending' | 'approving' | 'rejecting' | 'approved' | 'rejected'>(
    confirmation.status === 'approved' ? 'approved' : confirmation.status === 'rejected' ? 'rejected' : 'pending'
  );

  const handleApprove = async () => {
    setState('approving');
    try {
      await onApprove(confirmation.id);
      setState('approved');
    } catch {
      setState('pending');
    }
  };

  const handleReject = async () => {
    setState('rejecting');
    try {
      await onReject(confirmation.id);
      setState('rejected');
    } catch {
      setState('pending');
    }
  };

  const isDone = state === 'approved' || state === 'rejected';

  return (
    <div className={`border rounded-lg p-3 ${
      isDone
        ? state === 'approved'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-slate-600/30 bg-slate-800/30'
        : 'border-amber-500/30 bg-amber-500/5'
    }`}>
      <div className="flex items-start gap-2">
        <ShieldAlert className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
          isDone ? (state === 'approved' ? 'text-emerald-400' : 'text-slate-500') : 'text-amber-400'
        }`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200">
            {confirmation.description}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {confirmation.action_type.replace(/_/g, ' ')}
          </p>

          {!isDone && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleApprove}
                disabled={state !== 'pending'}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {state === 'approving' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Approve
              </button>
              <button
                onClick={handleReject}
                disabled={state !== 'pending'}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
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

          {isDone && (
            <p className={`text-[10px] mt-1 ${
              state === 'approved' ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              {state === 'approved' ? 'Approved and executed' : 'Rejected'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
