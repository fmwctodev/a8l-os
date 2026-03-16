import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'webchat', label: 'Webchat' },
  { value: 'facebook_dm', label: 'Facebook DM' },
  { value: 'instagram_dm', label: 'Instagram DM' },
  { value: 'linkedin_dm', label: 'LinkedIn DM' },
  { value: 'x_dm', label: 'X (Twitter) DM' },
  { value: 'vapi_sms', label: 'VAPI SMS' },
  { value: 'vapi_webchat', label: 'VAPI Webchat' },
];

export default function CustomerRepliedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const channels = (config.channels as string[]) ?? [];
  const replyContains = (config.replyContains as string) ?? '';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function toggleChannel(value: string) {
    const next = channels.includes(value)
      ? channels.filter(c => c !== value)
      : [...channels, value];
    update({ channels: next });
  }

  function selectAll() {
    update({ channels: CHANNELS.map(c => c.value) });
  }

  function clearAll() {
    update({ channels: [] });
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700">Channels</label>
          <div className="flex gap-2">
            <button type="button" onClick={selectAll} className="text-xs text-emerald-600 hover:text-emerald-700">
              Select All
            </button>
            <button type="button" onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-600">
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CHANNELS.map(ch => (
            <label key={ch.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.includes(ch.value)}
                onChange={() => toggleChannel(ch.value)}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">{ch.label}</span>
            </label>
          ))}
        </div>
        {channels.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">Select at least one channel</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Reply Contains (Optional)</label>
        <input
          value={replyContains}
          onChange={e => update({ replyContains: e.target.value })}
          placeholder="Filter by text content in reply"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
        <p className="text-xs text-gray-400 mt-1">Leave empty to trigger on any reply</p>
      </div>
    </div>
  );
}
