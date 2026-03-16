import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const PLATFORMS = [
  { value: 'google', label: 'Google' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'trustpilot', label: 'Trustpilot' },
  { value: 'bbb', label: 'BBB' },
];

export default function ReviewReceivedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const platform = (config.platform as string[]) ?? [];
  const minRating = (config.minRating as number | undefined);
  const maxRating = (config.maxRating as number | undefined);
  const accountFilter = (config.accountFilter as string) ?? '';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function togglePlatform(value: string) {
    const next = platform.includes(value)
      ? platform.filter(p => p !== value)
      : [...platform, value];
    update({ platform: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Platforms</label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => togglePlatform(p.value)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                platform.includes(p.value)
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Leave empty to trigger for all platforms</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Min Rating</label>
          <input
            type="number"
            min={1}
            max={5}
            step={1}
            value={minRating ?? ''}
            onChange={e => update({ minRating: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="1"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max Rating</label>
          <input
            type="number"
            min={1}
            max={5}
            step={1}
            value={maxRating ?? ''}
            onChange={e => update({ maxRating: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="5"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Account Filter (Optional)</label>
        <input
          value={accountFilter}
          onChange={e => update({ accountFilter: e.target.value })}
          placeholder="Filter by account or location"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>
    </div>
  );
}
