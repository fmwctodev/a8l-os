import { useState } from 'react';
import { XCircle, AlertCircle } from 'lucide-react';
import type { ProjectChangeRequest } from '../../types';

interface Props {
  request: ProjectChangeRequest;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export function RejectChangeModal({ request, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setProcessing(true);
    setError('');
    try {
      await onConfirm(reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Reject Change Request</h2>
            <p className="text-sm text-gray-500">{request.title}</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Please let the project team know why you are declining this change request. Your feedback helps them understand your needs.
        </p>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Reason <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Budget constraints, scope creep, need to discuss alternatives..."
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none text-gray-900 placeholder-gray-400"
          />
        </div>

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
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-colors"
          >
            <XCircle className="w-4 h-4" />
            {processing ? 'Processing...' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  );
}
