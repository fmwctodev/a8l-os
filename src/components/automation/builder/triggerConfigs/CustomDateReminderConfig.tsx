import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const TIMINGS = [
  { value: 'before', label: 'Before the date' },
  { value: 'on', label: 'On the date' },
  { value: 'after', label: 'After the date' },
];

const UNITS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
];

export default function CustomDateReminderConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const customDateField = (config.customDateField as string) ?? '';
  const timing = (config.timing as string) ?? 'on';
  const offsetValue = (config.offsetValue as number) ?? 0;
  const offsetUnit = (config.offsetUnit as string) ?? 'days';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Custom Date Field</label>
        <input
          value={customDateField}
          onChange={e => update({ customDateField: e.target.value })}
          placeholder="e.g. birthday, renewal_date, contract_end"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
        {!customDateField && (
          <p className="text-xs text-amber-600 mt-1">A custom date field is required</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Timing</label>
        <select
          value={timing}
          onChange={e => update({ timing: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          {TIMINGS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {timing !== 'on' && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Offset</label>
            <input
              type="number"
              min={0}
              value={offsetValue}
              onChange={e => update({ offsetValue: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
            <select
              value={offsetUnit}
              onChange={e => update({ offsetUnit: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            >
              {UNITS.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          {timing === 'on'
            ? 'Triggers exactly on the date stored in the custom field.'
            : `Triggers ${offsetValue} ${offsetUnit} ${timing} the date stored in the custom field.`}
        </p>
      </div>
    </div>
  );
}
