import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDangerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  isLoading?: boolean;
}

export function ConfirmDangerModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'CONFIRM',
  isLoading,
}: ConfirmDangerModalProps) {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const isValid = inputValue === confirmText;

  function handleConfirm() {
    if (isValid) {
      onConfirm();
      setInputValue('');
    }
  }

  function handleClose() {
    setInputValue('');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-slate-300 mb-4">{description}</p>

          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-2">
              Type <span className="font-mono text-red-400">{confirmText}</span> to confirm
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
              placeholder={confirmText}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isValid || isLoading}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
            >
              {isLoading ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
