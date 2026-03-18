import type { ActionNodeData } from '../../../../types';

const COPYABLE_FIELDS = [
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'postal_code', label: 'Postal Code' },
  { key: 'country', label: 'Country' },
  { key: 'source', label: 'Source' },
  { key: 'tags', label: 'Tags' },
  { key: 'custom_fields', label: 'Custom Fields' },
];

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function CopyContactConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });
  const fields: string[] = cfg.fieldsToCopy ?? [];

  const toggleField = (key: string) => {
    const updated = fields.includes(key) ? fields.filter(f => f !== key) : [...fields, key];
    set('fieldsToCopy', updated);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Fields to Copy</label>
        <div className="grid grid-cols-2 gap-1.5">
          {COPYABLE_FIELDS.map(f => (
            <label key={f.key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={fields.includes(f.key)} onChange={() => toggleField(f.key)}
                className="rounded border-gray-300 text-blue-600" />
              {f.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Add Tags to Copy (comma-separated)</label>
        <input type="text" value={(cfg.newTags ?? []).join(', ')} onChange={e => set('newTags', e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean))}
          placeholder="copy-of, cloned" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.overwriteExisting ?? false} onChange={e => set('overwriteExisting', e.target.checked)}
          className="rounded border-gray-300" />
        <span className="text-gray-700">Overwrite existing fields if contact already exists</span>
      </label>
    </div>
  );
}
