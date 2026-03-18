import type { ActionNodeData } from '../../../../types';

interface Variant { id: string; label: string; percentage: number; }

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function SplitTestConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });
  const variants: Variant[] = cfg.variants ?? [
    { id: 'a', label: 'Variant A', percentage: 50 },
    { id: 'b', label: 'Variant B', percentage: 50 },
  ];
  const total = variants.reduce((s, v) => s + v.percentage, 0);

  const updateVariant = (idx: number, updates: Partial<Variant>) => {
    const updated = variants.map((v, i) => i === idx ? { ...v, ...updates } : v);
    set('variants', updated);
  };

  const addVariant = () => {
    const id = String.fromCharCode(97 + variants.length);
    set('variants', [...variants, { id, label: `Variant ${id.toUpperCase()}`, percentage: 0 }]);
  };

  const removeVariant = (idx: number) => {
    if (variants.length <= 2) return;
    set('variants', variants.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">Contacts will be randomly assigned to a variant based on percentages. Percentages must total 100%.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Split Type</label>
        <select value={cfg.splitType ?? 'percentage'} onChange={e => set('splitType', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="percentage">Percentage-based</option>
          <option value="random">Equal random split</option>
        </select>
      </div>
      <div className="space-y-2">
        {variants.map((v, i) => (
          <div key={v.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
            <input type="text" value={v.label} onChange={e => updateVariant(i, { label: e.target.value })}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none" placeholder="Variant name" />
            {cfg.splitType !== 'random' && (
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={100} value={v.percentage} onChange={e => updateVariant(i, { percentage: parseInt(e.target.value) || 0 })}
                  className="w-16 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none text-right" />
                <span className="text-xs text-gray-500">%</span>
              </div>
            )}
            {variants.length > 2 && (
              <button onClick={() => removeVariant(i)} className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
            )}
          </div>
        ))}
      </div>
      {cfg.splitType !== 'random' && total !== 100 && (
        <p className="text-xs text-amber-600">Total: {total}% — must equal 100%</p>
      )}
      <button onClick={addVariant}
        className="w-full py-2 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
        + Add Variant
      </button>
    </div>
  );
}
