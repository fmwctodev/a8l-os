import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

const OPERATIONS = [
  { value: 'create', label: 'Create array from value' },
  { value: 'append', label: 'Append item to array' },
  { value: 'remove', label: 'Remove item from array' },
  { value: 'sort', label: 'Sort array' },
  { value: 'dedupe', label: 'Deduplicate array' },
  { value: 'iterate', label: 'Iterate (loop over items)' },
  { value: 'contains', label: 'Check if array contains value' },
  { value: 'join', label: 'Join array into string' },
];

export default function ArrayOperationConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  const showOperand = ['append', 'remove', 'contains'].includes(cfg.operation ?? 'create');
  const showSort = cfg.operation === 'sort';
  const showJoin = cfg.operation === 'join';

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Input Source</label>
        <select value={cfg.inputSource ?? 'variable'} onChange={e => set('inputSource', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="variable">Workflow variable</option>
          <option value="custom_field">Contact custom field</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Input Key / Field</label>
        <input type="text" value={cfg.inputKey ?? ''} onChange={e => set('inputKey', e.target.value)}
          placeholder="variable_name or field_key" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Operation</label>
        <select value={cfg.operation ?? 'create'} onChange={e => set('operation', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          {OPERATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {showOperand && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
          <input type="text" value={cfg.operandValue ?? ''} onChange={e => set('operandValue', e.target.value)}
            placeholder="Item value or {{merge_field}}" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      {showSort && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sort Direction</label>
          <select value={cfg.sortDirection ?? 'asc'} onChange={e => set('sortDirection', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      )}
      {showJoin && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Join Separator</label>
          <input type="text" value={cfg.joinSeparator ?? ', '} onChange={e => set('joinSeparator', e.target.value)}
            placeholder=", " className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Save Result To Variable</label>
        <input type="text" value={cfg.outputKey ?? ''} onChange={e => set('outputKey', e.target.value)}
          placeholder="result_array" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
    </div>
  );
}
