import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function ModifyEngagementScoreConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Operation</label>
        <div className="grid grid-cols-3 gap-2">
          {(['set', 'increase', 'decrease'] as const).map(op => (
            <button key={op} onClick={() => set('operation', op)}
              className={`py-2 text-xs font-medium rounded-lg border transition-colors capitalize ${
                (cfg.operation ?? 'increase') === op
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {op}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
        <input type="number" min={0} value={cfg.value ?? ''} onChange={e => set('value', parseInt(e.target.value) || 0)}
          placeholder="10" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Floor (min score)</label>
          <input type="number" min={0} value={cfg.floor ?? ''} onChange={e => set('floor', parseInt(e.target.value) || undefined)}
            placeholder="0" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Ceiling (max score)</label>
          <input type="number" min={0} value={cfg.ceiling ?? ''} onChange={e => set('ceiling', parseInt(e.target.value) || undefined)}
            placeholder="100" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
        <input type="text" value={cfg.reason ?? ''} onChange={e => set('reason', e.target.value)}
          placeholder="e.g. Completed onboarding" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
    </div>
  );
}
