import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const OUTCOMES = [
  { value: 'answered', label: 'Answered' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'failed', label: 'Failed' },
];

export default function CallDetailsConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const direction = (config.direction as string) ?? 'any';
  const answeredStatus = (config.answeredStatus as string) ?? 'any';
  const minDuration = (config.minDuration as number | undefined);
  const maxDuration = (config.maxDuration as number | undefined);
  const outcome = (config.outcome as string[]) ?? [];

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function toggleOutcome(value: string) {
    const next = outcome.includes(value)
      ? outcome.filter(o => o !== value)
      : [...outcome, value];
    update({ outcome: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Call Direction</label>
        <select
          value={direction}
          onChange={e => update({ direction: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          <option value="any">Any Direction</option>
          <option value="inbound">Inbound Only</option>
          <option value="outbound">Outbound Only</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Answered Status</label>
        <select
          value={answeredStatus}
          onChange={e => update({ answeredStatus: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          <option value="any">Any</option>
          <option value="answered">Answered</option>
          <option value="missed">Missed</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Min Duration (sec)</label>
          <input
            type="number"
            min={0}
            value={minDuration ?? ''}
            onChange={e => update({ minDuration: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Any"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max Duration (sec)</label>
          <input
            type="number"
            min={0}
            value={maxDuration ?? ''}
            onChange={e => update({ maxDuration: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Any"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Disposition / Outcome</label>
        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => toggleOutcome(o.value)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                outcome.includes(o.value)
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
