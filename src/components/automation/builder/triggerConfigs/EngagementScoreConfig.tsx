import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'crosses_above', label: 'Crosses Above' },
  { value: 'crosses_below', label: 'Crosses Below' },
];

export default function EngagementScoreConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const operator = (config.operator as string) ?? 'greater_than';
  const scoreValue = (config.scoreValue as number) ?? 50;

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Operator</label>
        <select
          value={operator}
          onChange={e => update({ operator: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          {OPERATORS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Score Value</label>
        <input
          type="number"
          min={0}
          max={100}
          value={scoreValue}
          onChange={e => update({ scoreValue: parseInt(e.target.value) || 0 })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          {(operator === 'crosses_above' || operator === 'crosses_below')
            ? `Triggers when the score transitions ${operator === 'crosses_above' ? 'above' : 'below'} ${scoreValue}. This only fires at the crossing point, not while the score remains ${operator === 'crosses_above' ? 'above' : 'below'}.`
            : `Triggers when the engagement score is ${operator.replace('_', ' ')} ${scoreValue}.`}
        </p>
      </div>
    </div>
  );
}
