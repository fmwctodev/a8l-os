import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function DeleteContactConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-xs text-red-700 font-medium">Caution: This action permanently removes contact data.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Delete Mode</label>
        <select value={cfg.mode ?? 'soft'} onChange={e => set('mode', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="soft">Soft Delete (archive, data retained)</option>
          <option value="hard">Hard Delete (permanent removal)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
        <input type="text" value={cfg.reason ?? ''} onChange={e => set('reason', e.target.value)}
          placeholder="Why is this contact being deleted?" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.requireApproval ?? true} onChange={e => set('requireApproval', e.target.checked)}
          className="rounded border-gray-300" />
        <span className="text-gray-700">Require manual approval before deleting</span>
      </label>
    </div>
  );
}
