import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { deleteCalendar } from '../../../services/calendars';
import type { Calendar } from '../../../types';

interface DeleteCalendarModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  calendar: Calendar | null;
}

export function DeleteCalendarModal({
  open,
  onClose,
  onConfirm,
  calendar,
}: DeleteCalendarModalProps) {
  const { user } = useAuth();
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!open || !calendar) return null;

  const handleDelete = async () => {
    if (!user || confirmName !== calendar.name) return;

    setError('');
    setDeleting(true);

    try {
      await deleteCalendar(calendar.id, user);
      onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete calendar');
    } finally {
      setDeleting(false);
    }
  };

  const isConfirmValid = confirmName === calendar.name;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Delete Calendar</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm font-medium mb-2">
                This action cannot be undone. This will permanently delete:
              </p>
              <ul className="text-red-400/80 text-sm space-y-1 list-disc list-inside">
                <li>The calendar "{calendar.name}"</li>
                <li>All appointment types ({calendar.appointment_types?.length || 0})</li>
                <li>All scheduled and past appointments</li>
                <li>All availability rules</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Type <span className="text-white font-bold">{calendar.name}</span> to confirm
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder="Enter calendar name"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!isConfirmValid || deleting}
              className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting...' : 'Delete Calendar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
