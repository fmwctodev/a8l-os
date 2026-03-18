import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function UpdateCustomValueConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Custom Value Key</label>
        <input type="text" value={cfg.customValueKey ?? ''} onChange={e => set('customValueKey', e.target.value)}
          placeholder="e.g. company_discount_code" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <p className="text-xs text-gray-400 mt-1">Find keys in Settings &rarr; Custom Values.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Operation</label>
        <select value={cfg.operation ?? 'set'} onChange={e => set('operation', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="set">Set (overwrite)</option>
          <option value="append">Append to existing</option>
          <option value="replace_token">Replace token in value</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {cfg.operation === 'replace_token' ? 'Replacement Value' : 'New Value'}
        </label>
        <input type="text" value={cfg.value ?? ''} onChange={e => set('value', e.target.value)}
          placeholder="Value or {{merge_field}}" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      {cfg.operation === 'replace_token' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Token to Replace</label>
          <input type="text" value={cfg.token ?? ''} onChange={e => set('token', e.target.value)}
            placeholder="{{token_name}}" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
    </div>
  );
}
