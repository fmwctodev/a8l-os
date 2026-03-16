import { Plus, X } from 'lucide-react';
import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const OPP_FIELDS = [
  { value: 'name', label: 'Name' },
  { value: 'value', label: 'Value' },
  { value: 'status', label: 'Status' },
  { value: 'stage_id', label: 'Stage' },
  { value: 'owner_id', label: 'Owner' },
  { value: 'expected_close_date', label: 'Expected Close Date' },
  { value: 'probability', label: 'Probability' },
  { value: 'source', label: 'Source' },
];

export default function OpportunityChangedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const watchedFields = (config.watchedFields as string[]) ?? [];
  const matchMode = (config.matchMode as string) ?? 'any';
  const pipelineFilter = (config.pipelineFilter as string) ?? '';
  const fieldConditions = (config.fieldConditions as { field: string; operator: string; newValue: string }[]) ?? [];

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function toggleField(field: string) {
    const next = watchedFields.includes(field)
      ? watchedFields.filter(f => f !== field)
      : [...watchedFields, field];
    update({ watchedFields: next });
  }

  function addCondition() {
    update({
      fieldConditions: [...fieldConditions, { field: '', operator: 'equals', newValue: '' }],
    });
  }

  function updateCondition(idx: number, patch: Record<string, string>) {
    const next = fieldConditions.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    update({ fieldConditions: next });
  }

  function removeCondition(idx: number) {
    update({ fieldConditions: fieldConditions.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Watched Fields</label>
        <div className="flex flex-wrap gap-2">
          {OPP_FIELDS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => toggleField(f.value)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                watchedFields.includes(f.value)
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {watchedFields.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">Select at least one field to watch</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Match Mode</label>
        <select
          value={matchMode}
          onChange={e => update({ matchMode: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          <option value="any">Any field matches</option>
          <option value="all">All fields must match</option>
        </select>
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

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700">Value Conditions (Optional)</label>
          <button type="button" onClick={addCondition} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        {fieldConditions.map((cond, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <select
              value={cond.field}
              onChange={e => updateCondition(idx, { field: e.target.value })}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
            >
              <option value="">Field...</option>
              {OPP_FIELDS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <select
              value={cond.operator}
              onChange={e => updateCondition(idx, { operator: e.target.value })}
              className="w-24 px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
            >
              <option value="equals">Equals</option>
              <option value="not_equals">Not Equals</option>
              <option value="greater_than">Greater</option>
              <option value="less_than">Less</option>
            </select>
            <input
              value={cond.newValue}
              onChange={e => updateCondition(idx, { newValue: e.target.value })}
              placeholder="Value"
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
            />
            <button type="button" onClick={() => removeCondition(idx)} className="text-gray-400 hover:text-red-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
