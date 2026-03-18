import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function CreateContactConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
          <input type="text" value={cfg.firstName ?? ''} onChange={e => set('firstName', e.target.value)}
            placeholder="{{contact.first_name}}" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
          <input type="text" value={cfg.lastName ?? ''} onChange={e => set('lastName', e.target.value)}
            placeholder="{{contact.last_name}}" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
        <input type="text" value={cfg.email ?? ''} onChange={e => set('email', e.target.value)}
          placeholder="{{contact.email}}" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
        <input type="text" value={cfg.phone ?? ''} onChange={e => set('phone', e.target.value)}
          placeholder="{{contact.phone}}" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
        <input type="text" value={cfg.company ?? ''} onChange={e => set('company', e.target.value)}
          placeholder="{{contact.company}}" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Source</label>
        <input type="text" value={cfg.source ?? ''} onChange={e => set('source', e.target.value)}
          placeholder="e.g. Workflow" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
        <input type="text" value={(cfg.tags ?? []).join(', ')} onChange={e => set('tags', e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean))}
          placeholder="tag1, tag2" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">If Duplicate Exists</label>
        <select value={cfg.duplicateRule ?? 'skip'} onChange={e => set('duplicateRule', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="skip">Skip (do nothing)</option>
          <option value="update">Update existing</option>
          <option value="create_new">Create new record</option>
        </select>
      </div>
      <p className="text-xs text-gray-400">At least email or phone is required for duplicate detection.</p>
    </div>
  );
}
