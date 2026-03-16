import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

export default function ContactCreatedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const sourceFilter = (config.sourceFilter as string) ?? '';
  const tagFilter = (config.tagFilter as string) ?? '';
  const ownerFilter = (config.ownerFilter as string) ?? '';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Source Filter (Optional)</label>
        <input
          value={sourceFilter}
          onChange={e => update({ sourceFilter: e.target.value })}
          placeholder="e.g. website, import, api"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
        <p className="text-xs text-gray-400 mt-1">Only trigger for contacts from this source</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Tag Filter (Optional)</label>
        <input
          value={tagFilter}
          onChange={e => update({ tagFilter: e.target.value })}
          placeholder="Tag name"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
        <p className="text-xs text-gray-400 mt-1">Only trigger if new contact has this tag</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Owner Filter (Optional)</label>
        <input
          value={ownerFilter}
          onChange={e => update({ ownerFilter: e.target.value })}
          placeholder="Owner user ID or name"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
        <p className="text-xs text-gray-400 mt-1">Only trigger if assigned to this owner</p>
      </div>

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          Leave all fields empty to trigger on every new contact creation.
        </p>
      </div>
    </div>
  );
}
