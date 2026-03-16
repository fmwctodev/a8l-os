import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const FREQUENCIES = [
  { value: 'once', label: 'Once' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom_cron', label: 'Custom (Cron)' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default function SchedulerConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const frequency = (config.frequency as string) ?? 'daily';
  const timezone = (config.timezone as string) ?? 'America/New_York';
  const timeOfDay = (config.timeOfDay as string) ?? '09:00';
  const startDate = (config.startDate as string) ?? '';
  const endDate = (config.endDate as string) ?? '';
  const dayOfWeek = (config.dayOfWeek as number) ?? 1;
  const dayOfMonth = (config.dayOfMonth as number) ?? 1;
  const cronExpression = (config.cronExpression as string) ?? '';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
        <select
          value={frequency}
          onChange={e => update({ frequency: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          {FREQUENCIES.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Timezone</label>
        <select
          value={timezone}
          onChange={e => update({ timezone: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {frequency !== 'custom_cron' && frequency !== 'hourly' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Time of Day</label>
          <input
            type="time"
            value={timeOfDay}
            onChange={e => update({ timeOfDay: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
      )}

      {frequency === 'weekly' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Day of Week</label>
          <select
            value={dayOfWeek}
            onChange={e => update({ dayOfWeek: parseInt(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          >
            {DAYS_OF_WEEK.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {frequency === 'monthly' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Day of Month</label>
          <input
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={e => update({ dayOfMonth: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
      )}

      {frequency === 'custom_cron' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Cron Expression</label>
          <input
            value={cronExpression}
            onChange={e => update({ cronExpression: e.target.value })}
            placeholder="e.g. 0 9 * * 1-5"
            className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
          <p className="text-xs text-gray-400 mt-1">Standard cron format: minute hour day month weekday</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => update({ startDate: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">End Date (Optional)</label>
          <input
            type="date"
            value={endDate}
            onChange={e => update({ endDate: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
      </div>

      <div className="p-3 bg-amber-50 rounded-lg">
        <p className="text-xs text-amber-700">
          This is a contactless trigger. The workflow will run on schedule without requiring a specific contact.
        </p>
      </div>
    </div>
  );
}
