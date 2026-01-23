import { Calendar } from 'lucide-react';
import type { ReportTimeRange } from '../../types';
import { timeRangePresets } from '../../config/reportingFields';

interface TimeRangePickerProps {
  value: ReportTimeRange;
  onChange: (range: ReportTimeRange) => void;
}

export function TimeRangePicker({ value, onChange }: TimeRangePickerProps) {
  const handlePresetChange = (preset: string) => {
    if (preset === 'custom') {
      onChange({
        type: 'custom',
        customStart: value.customStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        customEnd: value.customEnd || new Date().toISOString().split('T')[0],
      });
    } else {
      onChange({
        type: 'preset',
        preset: preset as ReportTimeRange['preset'],
      });
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">Time Range</label>

      <div className="space-y-3">
        <select
          value={value.type === 'custom' ? 'custom' : value.preset || 'last_30_days'}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
        >
          {timeRangePresets.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
          <option value="custom">Custom Range</option>
        </select>

        {value.type === 'custom' && (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={value.customStart || ''}
                  onChange={(e) => onChange({ ...value, customStart: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg pl-10 pr-3 py-2"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={value.customEnd || ''}
                  onChange={(e) => onChange({ ...value, customEnd: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg pl-10 pr-3 py-2"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
