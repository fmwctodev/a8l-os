import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function UpdateAppointmentStatusConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Target Appointment</label>
        <select value={cfg.appointmentSource ?? 'most_recent'} onChange={e => set('appointmentSource', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="most_recent">Most recent appointment</option>
          <option value="context">From workflow context</option>
          <option value="specific_id">Specific appointment ID</option>
        </select>
      </div>
      {cfg.appointmentSource === 'specific_id' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Appointment ID</label>
          <input type="text" value={cfg.appointmentId ?? ''} onChange={e => set('appointmentId', e.target.value)}
            placeholder="appointment-id or {{variable}}" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">New Status</label>
        <select value={cfg.newStatus ?? 'confirmed'} onChange={e => set('newStatus', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
          <option value="completed">Completed</option>
          <option value="rescheduled">Rescheduled</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
        <input type="text" value={cfg.reason ?? ''} onChange={e => set('reason', e.target.value)}
          placeholder="Status change reason" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.notifyContact ?? false} onChange={e => set('notifyContact', e.target.checked)}
          className="rounded border-gray-300" />
        <span className="text-gray-700">Notify contact of status change</span>
      </label>
    </div>
  );
}
