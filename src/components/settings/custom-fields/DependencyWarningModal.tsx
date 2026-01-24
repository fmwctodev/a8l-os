import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { CustomField } from '../../../types';

interface DependencyWarningModalProps {
  field: CustomField;
  valueCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  deleting?: boolean;
}

export function DependencyWarningModal({
  field,
  valueCount,
  onConfirm,
  onCancel,
  deleting = false,
}: DependencyWarningModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-slate-800 rounded-xl shadow-xl w-full max-w-md border border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Delete Custom Field</h2>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="font-medium text-red-400">Warning: This action cannot be undone</p>
              <p className="text-sm text-slate-400 mt-1">
                You are about to delete the custom field <span className="font-medium text-white">"{field.name}"</span>
              </p>
            </div>
          </div>

          {valueCount > 0 && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-400">
                <span className="font-semibold">{valueCount.toLocaleString()}</span> record{valueCount !== 1 ? 's' : ''} currently {valueCount !== 1 ? 'use' : 'uses'} this field.
              </p>
              <p className="text-sm text-slate-400 mt-2">
                Existing data will be <span className="text-amber-400 font-medium">hidden, not deleted</span>. The data will no longer be visible in the UI but can be recovered if needed.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">Field Details</p>
            <div className="p-3 bg-slate-900 rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Field Key:</span>
                <span className="text-slate-300 font-mono">{field.field_key}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Type:</span>
                <span className="text-slate-300">{field.field_type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Scope:</span>
                <span className="text-slate-300 capitalize">{field.scope}</span>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800"
            />
            <span className="text-sm text-slate-300">
              I understand that deleting this field will hide all associated data and this action cannot be easily reversed.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-900/50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {deleting ? 'Deleting...' : 'Delete Field'}
          </button>
        </div>
      </div>
    </div>
  );
}
