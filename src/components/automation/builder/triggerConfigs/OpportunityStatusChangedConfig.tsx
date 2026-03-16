import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export default function OpportunityStatusChangedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const statuses = (config.statuses as string[]) ?? [];
  const pipelineFilter = (config.pipelineFilter as string) ?? '';
  const oldStatusFilter = (config.oldStatusFilter as string) ?? '';
  const newStatusFilter = (config.newStatusFilter as string) ?? '';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function toggleStatus(value: string) {
    const next = statuses.includes(value)
      ? statuses.filter(s => s !== value)
      : [...statuses, value];
    update({ statuses: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Status Changes</label>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleStatus(s.value)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                statuses.includes(s.value)
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {statuses.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">Select at least one status</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Old Status (Optional)</label>
          <select
            value={oldStatusFilter}
            onChange={e => update({ oldStatusFilter: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          >
            <option value="">Any</option>
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">New Status (Optional)</label>
          <select
            value={newStatusFilter}
            onChange={e => update({ newStatusFilter: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          >
            <option value="">Any</option>
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Pipeline Filter (Optional)</label>
        <input
          value={pipelineFilter}
          onChange={e => update({ pipelineFilter: e.target.value })}
          placeholder="Filter by pipeline name or ID"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>
    </div>
  );
}
