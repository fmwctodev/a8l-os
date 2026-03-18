import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

const OPERATIONS = [
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'title_case', label: 'Title Case' },
  { value: 'trim', label: 'Trim whitespace' },
  { value: 'replace', label: 'Find & Replace' },
  { value: 'concatenate', label: 'Concatenate' },
  { value: 'extract', label: 'Extract pattern' },
  { value: 'format_phone', label: 'Format as phone number' },
  { value: 'format_date', label: 'Format as date' },
];

export default function TextFormatterConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  const op = cfg.operation ?? 'uppercase';

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Input Value</label>
        <input type="text" value={cfg.inputValue ?? ''} onChange={e => set('inputValue', e.target.value)}
          placeholder="{{contact.first_name}} or static text" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Operation</label>
        <select value={op} onChange={e => set('operation', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          {OPERATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {op === 'replace' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Find</label>
            <input type="text" value={cfg.findText ?? ''} onChange={e => set('findText', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Replace With</label>
            <input type="text" value={cfg.replaceText ?? ''} onChange={e => set('replaceText', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </>
      )}
      {op === 'concatenate' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Append Text</label>
          <input type="text" value={cfg.appendText ?? ''} onChange={e => set('appendText', e.target.value)}
            placeholder="Text to append" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      {op === 'extract' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Regex Pattern</label>
          <input type="text" value={cfg.extractPattern ?? ''} onChange={e => set('extractPattern', e.target.value)}
            placeholder="(\d+)" className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      {op === 'format_date' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Date Format</label>
          <input type="text" value={cfg.dateFormat ?? 'MM/DD/YYYY'} onChange={e => set('dateFormat', e.target.value)}
            placeholder="MM/DD/YYYY" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Save Result To Variable</label>
        <input type="text" value={cfg.outputKey ?? ''} onChange={e => set('outputKey', e.target.value)}
          placeholder="formatted_text" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
    </div>
  );
}
