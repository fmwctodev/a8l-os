import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const ACTIONS = [
  { value: 'added', label: 'Tag Added' },
  { value: 'removed', label: 'Tag Removed' },
  { value: 'either', label: 'Either (Added or Removed)' },
];

export default function ContactTagConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const tagName = (config.tagName as string) ?? '';
  const action = (config.action as string) ?? 'added';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Tag Name</label>
        <input
          value={tagName}
          onChange={e => update({ tagName: e.target.value })}
          placeholder="Enter tag name to watch"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
        {!tagName && (
          <p className="text-xs text-amber-600 mt-1">A tag name is required</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Event Type</label>
        <div className="space-y-2">
          {ACTIONS.map(a => (
            <label key={a.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tag_action"
                checked={action === a.value}
                onChange={() => update({ action: a.value })}
                className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">{a.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
