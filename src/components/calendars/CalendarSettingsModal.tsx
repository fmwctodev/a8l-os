import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateCalendar } from '../../services/calendars';
import type { Calendar, AssignmentMode } from '../../types';
import { X, Loader2 } from 'lucide-react';

interface CalendarSettingsModalProps {
  calendar: Calendar;
  onClose: () => void;
  onSuccess: () => void;
}

export function CalendarSettingsModal({
  calendar,
  onClose,
  onSuccess,
}: CalendarSettingsModalProps) {
  const { user: currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(calendar.name);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(
    calendar.settings.assignment_mode
  );

  const handleSubmit = async () => {
    if (!currentUser) return;

    try {
      setIsLoading(true);
      setError(null);

      await updateCalendar(
        calendar.id,
        {
          name,
          settings: { assignment_mode: assignmentMode },
        },
        currentUser
      );

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update calendar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-xl border border-slate-800 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Calendar Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Calendar Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {calendar.type === 'team' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Assignment Mode
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    assignmentMode === 'round_robin'
                      ? 'bg-cyan-500/10 border-cyan-500/50'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    checked={assignmentMode === 'round_robin'}
                    onChange={() => setAssignmentMode('round_robin')}
                    className="mt-0.5 border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div>
                    <p className="text-white font-medium">Weighted Round-Robin</p>
                    <p className="text-sm text-slate-400">
                      Distribute bookings evenly based on member weights
                    </p>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    assignmentMode === 'priority'
                      ? 'bg-cyan-500/10 border-cyan-500/50'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    checked={assignmentMode === 'priority'}
                    onChange={() => setAssignmentMode('priority')}
                    className="mt-0.5 border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div>
                    <p className="text-white font-medium">Priority-Based</p>
                    <p className="text-sm text-slate-400">
                      Assign to highest priority member who is available
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !name}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
