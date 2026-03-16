import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

export default function ProspectGeneratedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const sourceFilter = (config.sourceFilter as string) ?? '';
  const ownerFilter = (config.ownerFilter as string) ?? '';
  const campaignFilter = (config.campaignFilter as string) ?? '';

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
          placeholder="e.g. linkedin, referral, cold_outreach"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Owner Filter (Optional)</label>
        <input
          value={ownerFilter}
          onChange={e => update({ ownerFilter: e.target.value })}
          placeholder="Filter by owner user ID"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Campaign Filter (Optional)</label>
        <input
          value={campaignFilter}
          onChange={e => update({ campaignFilter: e.target.value })}
          placeholder="Filter by campaign name or ID"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          Fires when a new prospect record is created. Leave all filters empty to trigger on every new prospect.
        </p>
      </div>
    </div>
  );
}
