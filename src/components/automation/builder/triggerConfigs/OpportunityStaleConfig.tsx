import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const INACTIVITY_BASES = [
  { value: 'no_note', label: 'No note added' },
  { value: 'no_message', label: 'No message sent or received' },
  { value: 'no_stage_movement', label: 'No stage movement' },
  { value: 'no_task_completed', label: 'No task completed' },
];

export default function OpportunityStaleConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const pipelineFilter = (config.pipelineFilter as string) ?? '';
  const stageFilter = (config.stageFilter as string) ?? '';
  const inactivityThreshold = (config.inactivityThreshold as number) ?? 7;
  const inactivityUnit = (config.inactivityUnit as string) ?? 'days';
  const basedOn = (config.basedOn as string[]) ?? [];

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function toggleBase(value: string) {
    const next = basedOn.includes(value)
      ? basedOn.filter(b => b !== value)
      : [...basedOn, value];
    update({ basedOn: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Inactivity Threshold</label>
        <div className="flex gap-3">
          <input
            type="number"
            min={1}
            value={inactivityThreshold}
            onChange={e => update({ inactivityThreshold: parseInt(e.target.value) || 1 })}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
          <select
            value={inactivityUnit}
            onChange={e => update({ inactivityUnit: e.target.value })}
            className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          >
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
        {inactivityThreshold < 1 && (
          <p className="text-xs text-amber-600 mt-1">Threshold must be at least 1</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Based On (Inactivity Type)</label>
        <div className="space-y-2">
          {INACTIVITY_BASES.map(b => (
            <label key={b.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={basedOn.includes(b.value)}
                onChange={() => toggleBase(b.value)}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">{b.label}</span>
            </label>
          ))}
        </div>
        {basedOn.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">Select at least one inactivity type</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Pipeline Filter (Optional)</label>
        <input
          value={pipelineFilter}
          onChange={e => update({ pipelineFilter: e.target.value })}
          placeholder="Filter by pipeline"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Stage Filter (Optional)</label>
        <input
          value={stageFilter}
          onChange={e => update({ stageFilter: e.target.value })}
          placeholder="Filter by specific stage"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>

      <div className="p-3 bg-amber-50 rounded-lg">
        <p className="text-xs text-amber-700">
          Triggers when an opportunity has had no selected activity for {inactivityThreshold} {inactivityUnit}. Evaluated periodically by the system scheduler.
        </p>
      </div>
    </div>
  );
}
