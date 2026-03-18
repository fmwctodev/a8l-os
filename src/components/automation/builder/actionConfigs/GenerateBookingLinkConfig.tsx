import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function GenerateBookingLinkConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Calendar ID</label>
        <input type="text" value={cfg.calendarId ?? ''} onChange={e => set('calendarId', e.target.value)}
          placeholder="calendar-id" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Appointment Type ID</label>
        <input type="text" value={cfg.appointmentTypeId ?? ''} onChange={e => set('appointmentTypeId', e.target.value)}
          placeholder="appointment-type-id" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Expires After (hours)</label>
        <input type="number" min={1} value={cfg.expirationHours ?? 48} onChange={e => set('expirationHours', parseInt(e.target.value) || 48)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Usage Limit</label>
        <input type="number" min={1} value={cfg.usageLimit ?? 1} onChange={e => set('usageLimit', parseInt(e.target.value) || 1)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Save Link To Variable</label>
        <input type="text" value={cfg.saveToField ?? 'booking_link'} onChange={e => set('saveToField', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
    </div>
  );
}
