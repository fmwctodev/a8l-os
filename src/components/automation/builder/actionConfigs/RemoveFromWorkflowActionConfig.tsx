import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function RemoveFromWorkflowActionConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Target</label>
        <select value={cfg.target ?? 'current'} onChange={e => set('target', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="current">This workflow (current)</option>
          <option value="selected">Selected workflows</option>
        </select>
      </div>
      {cfg.target === 'selected' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Workflow IDs (comma-separated)</label>
          <input type="text" value={(cfg.workflowIds ?? []).join(', ')} onChange={e => set('workflowIds', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
            placeholder="workflow-id-1, workflow-id-2" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      <div className="p-3 bg-amber-50 rounded-lg">
        <p className="text-xs text-amber-700">Removing a contact from this workflow will stop their enrollment. This action cannot be undone.</p>
      </div>
    </div>
  );
}
