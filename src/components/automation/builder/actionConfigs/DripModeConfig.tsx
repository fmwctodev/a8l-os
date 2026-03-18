import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function DripModeConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">Drip mode processes enrolled contacts in timed batches instead of all at once.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Batch Size</label>
        <input type="number" min={1} value={cfg.batchSize ?? 10} onChange={e => set('batchSize', parseInt(e.target.value) || 10)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Interval</label>
          <input type="number" min={1} value={cfg.intervalValue ?? 1} onChange={e => set('intervalValue', parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
          <select value={cfg.intervalUnit ?? 'hours'} onChange={e => set('intervalUnit', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Queue Order</label>
        <select value={cfg.queueOrdering ?? 'fifo'} onChange={e => set('queueOrdering', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="fifo">First In, First Out</option>
          <option value="lifo">Last In, First Out</option>
          <option value="random">Random</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Start Time (optional)</label>
          <input type="time" value={cfg.startTime ?? ''} onChange={e => set('startTime', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">End Time (optional)</label>
          <input type="time" value={cfg.endTime ?? ''} onChange={e => set('endTime', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>
    </div>
  );
}
