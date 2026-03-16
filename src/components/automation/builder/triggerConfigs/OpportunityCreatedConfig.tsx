import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

export default function OpportunityCreatedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const pipelineFilter = (config.pipelineFilter as string) ?? '';
  const stageFilter = (config.stageFilter as string) ?? '';
  const ownerFilter = (config.ownerFilter as string) ?? '';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Pipeline Filter (Optional)</label>
        <input
          value={pipelineFilter}
          onChange={e => update({ pipelineFilter: e.target.value })}
          placeholder="Filter by pipeline name or ID"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Stage Filter (Optional)</label>
        <input
          value={stageFilter}
          onChange={e => update({ stageFilter: e.target.value })}
          placeholder="Filter by initial stage"
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

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          Leave all filters empty to trigger on every new opportunity creation.
        </p>
      </div>
    </div>
  );
}
