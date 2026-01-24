import { useState } from 'react';
import {
  X,
  FolderInput,
  ToggleLeft,
  ToggleRight,
  Trash2,
  ChevronDown,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkMove: () => void;
  onBulkEnable: () => Promise<void>;
  onBulkDisable: () => Promise<void>;
  onBulkDelete: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkMove,
  onBulkEnable,
  onBulkDisable,
  onBulkDelete,
}: BulkActionsBarProps) {
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  async function handleStatusChange(enable: boolean) {
    setProcessing(true);
    try {
      if (enable) {
        await onBulkEnable();
      } else {
        await onBulkDisable();
      }
    } finally {
      setProcessing(false);
      setStatusDropdownOpen(false);
    }
  }

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-600">
          <span className="text-sm font-medium text-white">
            {selectedCount} field{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onClearSelection}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onBulkMove}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          <FolderInput className="w-4 h-4" />
          Move
        </button>

        <div className="relative">
          <button
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
            disabled={processing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ToggleRight className="w-4 h-4" />
            )}
            Status
            <ChevronDown className="w-3 h-3" />
          </button>

          {statusDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStatusDropdownOpen(false)} />
              <div className="absolute bottom-full left-0 mb-2 w-36 bg-slate-800 rounded-lg shadow-xl border border-slate-600 py-1 z-50">
                <button
                  onClick={() => handleStatusChange(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  <ToggleRight className="w-4 h-4 text-green-400" />
                  Enable All
                </button>
                <button
                  onClick={() => handleStatusChange(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  <ToggleLeft className="w-4 h-4 text-slate-500" />
                  Disable All
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={onBulkDelete}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  );
}

interface BulkDeleteConfirmModalProps {
  fieldCount: number;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function BulkDeleteConfirmModal({
  fieldCount,
  onConfirm,
  onCancel,
}: BulkDeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-xl shadow-xl border border-slate-700">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-500/20 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Delete {fieldCount} Fields</h2>
              <p className="text-sm text-slate-400">This action cannot be undone</p>
            </div>
          </div>

          <p className="text-slate-300 mb-6">
            Are you sure you want to delete {fieldCount} custom field{fieldCount !== 1 ? 's' : ''}?
            Any existing data stored in these fields will be lost.
          </p>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              {deleting ? 'Deleting...' : `Delete ${fieldCount} Field${fieldCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
