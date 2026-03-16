import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

export default function CustomerBookedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const calendarFilter = (config.calendarFilter as string) ?? '';
  const appointmentTypeFilter = (config.appointmentTypeFilter as string) ?? '';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Calendar Filter (Optional)</label>
        <input
          value={calendarFilter}
          onChange={e => update({ calendarFilter: e.target.value })}
          placeholder="Filter by calendar name or ID"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Appointment Type Filter (Optional)</label>
        <input
          value={appointmentTypeFilter}
          onChange={e => update({ appointmentTypeFilter: e.target.value })}
          placeholder="Filter by appointment type"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          Fires specifically when a customer self-books an appointment through a booking page.
        </p>
      </div>
    </div>
  );
}
