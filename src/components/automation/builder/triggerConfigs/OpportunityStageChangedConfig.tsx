import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

export default function OpportunityStageChangedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const pipelineFilter = (config.pipelineFilter as string) ?? '';
  const fromStage = (config.fromStage as string) ?? '';
  const toStage = (config.toStage as string) ?? '';
  const anyStageMove = (config.anyStageMove as boolean) ?? true;

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
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={anyStageMove}
            onChange={e => update({ anyStageMove: e.target.checked })}
            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm text-gray-700">Trigger on any stage movement</span>
        </label>
      </div>

      {!anyStageMove && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From Stage (Optional)</label>
            <input
              value={fromStage}
              onChange={e => update({ fromStage: e.target.value })}
              placeholder="Stage name or ID to move from"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">To Stage (Optional)</label>
            <input
              value={toStage}
              onChange={e => update({ toStage: e.target.value })}
              placeholder="Stage name or ID to move to"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            />
          </div>
        </>
      )}

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          {anyStageMove
            ? 'Triggers whenever an opportunity moves between any stages in the pipeline.'
            : 'Triggers only when the specific stage transition criteria are met.'}
        </p>
      </div>
    </div>
  );
}
