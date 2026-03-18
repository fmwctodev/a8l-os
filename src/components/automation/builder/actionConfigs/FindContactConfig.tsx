import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function FindContactConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Lookup Field</label>
        <select value={cfg.lookupField ?? 'email'} onChange={e => set('lookupField', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="id">Contact ID</option>
          <option value="custom_field">Custom Field</option>
        </select>
      </div>
      {cfg.lookupField === 'custom_field' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Custom Field Key</label>
          <input type="text" value={cfg.customFieldKey ?? ''} onChange={e => set('customFieldKey', e.target.value)}
            placeholder="field_key" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Lookup Value</label>
        <input type="text" value={cfg.lookupValue ?? ''} onChange={e => set('lookupValue', e.target.value)}
          placeholder="{{contact.email}} or static value" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">If Multiple Matches</label>
        <select value={cfg.matchMode ?? 'first'} onChange={e => set('matchMode', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="first">Use first match</option>
          <option value="last">Use last match</option>
          <option value="newest">Use newest created</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">If No Match Found</label>
        <select value={cfg.fallbackBehavior ?? 'skip'} onChange={e => set('fallbackBehavior', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="skip">Skip remaining actions</option>
          <option value="stop">Stop workflow</option>
          <option value="notify">Notify user</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Store Result As Variable</label>
        <input type="text" value={cfg.storeResultAs ?? ''} onChange={e => set('storeResultAs', e.target.value)}
          placeholder="found_contact_id" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
    </div>
  );
}
