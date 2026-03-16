import { useState } from 'react';
import { CheckCircle2, DollarSign, Clock, AlertCircle } from 'lucide-react';
import type { ProjectChangeRequest } from '../../types';

interface Props {
  request: ProjectChangeRequest;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ApproveChangeModal({ request, onConfirm, onClose }: Props) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setProcessing(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Approve Change Request</h2>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-3">
          <p className="text-sm font-medium text-gray-900">{request.title}</p>

          {(request.cost_impact_visible_to_client && request.cost_impact > 0) && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Additional cost:</span>
              <span className="font-semibold text-gray-900">
                +${Number(request.cost_impact).toLocaleString()}
              </span>
            </div>
          )}

          {(request.timeline_impact_visible_to_client && request.timeline_impact_days > 0) && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Timeline extension:</span>
              <span className="font-semibold text-gray-900">+{request.timeline_impact_days} days</span>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-600 mb-5">
          By approving, you authorize the project team to proceed with this change. Any associated costs and
          timeline impacts will apply to your project.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-4 h-4 flex-none" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            {processing ? 'Approving...' : 'Confirm Approval'}
          </button>
        </div>
      </div>
    </div>
  );
}
