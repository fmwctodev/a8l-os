import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function ManualActionConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">This action pauses the workflow and creates a task for a team member to complete manually before it continues.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Instructions</label>
        <textarea value={cfg.instructionText ?? ''} onChange={e => set('instructionText', e.target.value)}
          rows={4} placeholder="Describe the task the team member must complete..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Assign To</label>
        <select value={cfg.assigneeType ?? 'contact_owner'} onChange={e => set('assigneeType', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="contact_owner">Contact Owner</option>
          <option value="specific_user">Specific User</option>
          <option value="round_robin">Round Robin</option>
        </select>
      </div>
      {cfg.assigneeType === 'specific_user' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">User ID</label>
          <input type="text" value={cfg.assigneeId ?? ''} onChange={e => set('assigneeId', e.target.value)}
            placeholder="User ID" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Due In (hours)</label>
        <input type="number" min={1} value={cfg.dueHours ?? 24} onChange={e => set('dueHours', parseInt(e.target.value) || 24)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Can Be Completed By</label>
        <select value={cfg.completionRule ?? 'assigned_user'} onChange={e => set('completionRule', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="assigned_user">Assigned user only</option>
          <option value="any_user">Any team member</option>
        </select>
      </div>
    </div>
  );
}
