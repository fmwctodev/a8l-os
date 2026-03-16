import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const CHANNELS = [
  { value: 'all', label: 'All Channels' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Phone Call' },
];

const STATES = [
  { value: 'any', label: 'Any Change' },
  { value: 'turned_on', label: 'Turned On' },
  { value: 'turned_off', label: 'Turned Off' },
];

export default function ContactDndConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const channel = (config.channel as string) ?? 'all';
  const state = (config.state as string) ?? 'any';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Channel</label>
        <select
          value={channel}
          onChange={e => update({ channel: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          {CHANNELS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">DND State</label>
        <div className="space-y-2">
          {STATES.map(s => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="dnd_state"
                checked={state === s.value}
                onChange={() => update({ state: s.value })}
                className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">{s.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
