import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const EVENT_TYPES = [
  { value: 'delivered', label: 'Delivered' },
  { value: 'opened', label: 'Opened' },
  { value: 'clicked', label: 'Clicked' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'spam', label: 'Marked as Spam' },
  { value: 'unsubscribe', label: 'Unsubscribed' },
];

export default function EmailEventsConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const eventTypes = (config.eventTypes as string[]) ?? [];
  const templateFilter = (config.templateFilter as string) ?? '';
  const senderFilter = (config.senderFilter as string) ?? '';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function toggleEventType(value: string) {
    const next = eventTypes.includes(value)
      ? eventTypes.filter(t => t !== value)
      : [...eventTypes, value];
    update({ eventTypes: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Email Event Types</label>
        <div className="grid grid-cols-2 gap-2">
          {EVENT_TYPES.map(et => (
            <label key={et.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={eventTypes.includes(et.value)}
                onChange={() => toggleEventType(et.value)}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">{et.label}</span>
            </label>
          ))}
        </div>
        {eventTypes.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">Select at least one event type</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Email Template Filter (Optional)</label>
        <input
          value={templateFilter}
          onChange={e => update({ templateFilter: e.target.value })}
          placeholder="Filter by template name or ID"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Sender Account Filter (Optional)</label>
        <input
          value={senderFilter}
          onChange={e => update({ senderFilter: e.target.value })}
          placeholder="Filter by sender email or account"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>
    </div>
  );
}
