import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const STATUSES = [
  { value: 'booked', label: 'Booked' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
  { value: 'completed', label: 'Completed' },
];

export default function AppointmentStatusConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const statuses = (config.statuses as string[]) ?? [];
  const calendarFilter = (config.calendarFilter as string) ?? '';
  const appointmentTypeFilter = (config.appointmentTypeFilter as string) ?? '';
  const assignedUserFilter = (config.assignedUserFilter as string) ?? '';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function toggleStatus(value: string) {
    const next = statuses.includes(value)
      ? statuses.filter(s => s !== value)
      : [...statuses, value];
    update({ statuses: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Status Changes</label>
        <div className="grid grid-cols-2 gap-2">
          {STATUSES.map(s => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={statuses.includes(s.value)}
                onChange={() => toggleStatus(s.value)}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">{s.label}</span>
            </label>
          ))}
        </div>
        {statuses.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">Select at least one status</p>
        )}
      </div>

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

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Assigned User Filter (Optional)</label>
        <input
          value={assignedUserFilter}
          onChange={e => update({ assignedUserFilter: e.target.value })}
          placeholder="Filter by assigned user ID"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>
    </div>
  );
}
