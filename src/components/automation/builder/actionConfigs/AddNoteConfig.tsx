import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function AddNoteConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Note Content</label>
        <textarea value={cfg.content ?? ''} onChange={e => set('content', e.target.value)}
          rows={4} placeholder="Note text... Use {{contact.first_name}} for merge fields"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Visibility</label>
        <select value={cfg.visibility ?? 'internal'} onChange={e => set('visibility', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="internal">Internal (team only)</option>
          <option value="public">Public (visible in portal)</option>
          <option value="private">Private (author only)</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.prependTimestamp ?? false} onChange={e => set('prependTimestamp', e.target.checked)}
          className="rounded border-gray-300" />
        <span className="text-gray-700">Prepend timestamp to note</span>
      </label>
    </div>
  );
}
