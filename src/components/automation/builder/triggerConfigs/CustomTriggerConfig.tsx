import { Plus, X } from 'lucide-react';
import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

export default function CustomTriggerConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const eventName = (config.eventName as string) ?? '';
  const payloadKeyFilters = (config.payloadKeyFilters as { key: string; operator: string; value: string }[]) ?? [];

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function addFilter() {
    update({
      payloadKeyFilters: [...payloadKeyFilters, { key: '', operator: 'equals', value: '' }],
    });
  }

  function updateFilter(idx: number, patch: Record<string, string>) {
    const next = payloadKeyFilters.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    update({ payloadKeyFilters: next });
  }

  function removeFilter(idx: number) {
    update({ payloadKeyFilters: payloadKeyFilters.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Custom Event Name</label>
        <input
          value={eventName}
          onChange={e => update({ eventName: e.target.value })}
          placeholder="e.g. my_custom_event"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
        {!eventName && (
          <p className="text-xs text-amber-600 mt-1">An event name is required</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700">Payload Key Filters (Optional)</label>
          <button
            type="button"
            onClick={addFilter}
            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
          >
            <Plus className="w-3 h-3" /> Add Filter
          </button>
        </div>
        {payloadKeyFilters.map((filter, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <input
              value={filter.key}
              onChange={e => updateFilter(idx, { key: e.target.value })}
              placeholder="Key"
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <select
              value={filter.operator}
              onChange={e => updateFilter(idx, { operator: e.target.value })}
              className="w-24 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
              <option value="exists">Exists</option>
            </select>
            <input
              value={filter.value}
              onChange={e => updateFilter(idx, { value: e.target.value })}
              placeholder="Value"
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button type="button" onClick={() => removeFilter(idx)} className="text-gray-400 hover:text-red-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          This trigger fires from custom events emitted via the API endpoint:
          <code className="bg-blue-100 px-1 py-0.5 rounded text-xs ml-1">POST /functions/v1/automation-custom-trigger</code>
        </p>
      </div>
    </div>
  );
}
