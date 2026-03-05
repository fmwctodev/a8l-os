import { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { CADENCE_OPTIONS } from '../../services/aiReportSchedules';

interface ScheduleReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cadenceDays: number) => Promise<void>;
  reportName: string;
}

export function ScheduleReportModal({ isOpen, onClose, onSave, reportName }: ScheduleReportModalProps) {
  const [cadenceDays, setCadenceDays] = useState(30);
  const [customDays, setCustomDays] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const days = isCustom ? parseInt(customDays, 10) : cadenceDays;
      if (!days || days < 1) return;
      await onSave(days);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const nextRunDate = new Date(Date.now() + (isCustom ? parseInt(customDays, 10) || 30 : cadenceDays) * 86400000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Schedule Report</h2>
              <p className="text-xs text-slate-400 mt-0.5">Auto-generate on a recurring basis</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Report</label>
            <p className="text-sm text-slate-400 truncate">{reportName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Frequency</label>
            <div className="space-y-2">
              {CADENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setCadenceDays(opt.value); setIsCustom(false); }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm ${
                    !isCustom && cadenceDays === opt.value
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                      : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                  } ${opt.value === 30 ? 'ring-1 ring-cyan-500/10' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt.label}</span>
                    {opt.value === 30 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        Recommended
                      </span>
                    )}
                  </div>
                </button>
              ))}
              <button
                onClick={() => setIsCustom(true)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm ${
                  isCustom
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                    : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                Custom interval
              </button>
              {isCustom && (
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-sm text-slate-400">Every</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder="30"
                    className="w-20 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  />
                  <span className="text-sm text-slate-400">days</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">
              Next report: <span className="text-slate-200">{nextRunDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Reports are stored automatically. You will receive an in-app notification when each report is ready.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || (isCustom && (!customDays || parseInt(customDays, 10) < 1))}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isSaving ? 'Scheduling...' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
