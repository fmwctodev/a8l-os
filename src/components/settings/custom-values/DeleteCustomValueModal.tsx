import { AlertTriangle } from 'lucide-react';
import type { CustomValue } from '../../../services/customValues';
import { formatTokenKey } from '../../../services/customValues';

interface Props {
  value: CustomValue;
  usageCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCustomValueModal({ value, usageCount, onClose, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border border-slate-700">
        <div className="flex items-center gap-3 text-red-400 mb-4">
          <div className="p-2 bg-red-500/10 rounded-lg">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">Delete Custom Value</h3>
        </div>

        <div className="space-y-4">
          <p className="text-slate-300">
            Are you sure you want to delete this custom value?
          </p>

          <div className="p-3 bg-slate-900 rounded-lg border border-slate-700">
            <p className="text-sm text-slate-400 mb-1">Token being deleted:</p>
            <code className="text-cyan-400 font-mono text-sm">
              {formatTokenKey(value.key)}
            </code>
          </div>

          {usageCount > 0 && (
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <p className="text-sm text-amber-400">
                This value is referenced in <strong>{usageCount}</strong> place{usageCount > 1 ? 's' : ''} across automations, snippets, and AI prompts.
              </p>
            </div>
          )}

          <p className="text-sm text-slate-400">
            Existing content containing this token will show an unresolved placeholder.
            Past sent messages are not affected.
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            Delete Value
          </button>
        </div>
      </div>
    </div>
  );
}
