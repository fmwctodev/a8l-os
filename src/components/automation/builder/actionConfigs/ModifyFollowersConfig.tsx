import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function ModifyFollowersConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
        <div className="grid grid-cols-2 gap-2">
          {(['add', 'remove'] as const).map(a => (
            <button key={a} onClick={() => set('action', a)}
              className={`py-2 text-xs font-medium rounded-lg border transition-colors capitalize ${
                (cfg.action ?? 'add') === a
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {a} Followers
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Follower Type</label>
        <select value={cfg.followerType ?? 'specific_user'} onChange={e => set('followerType', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="specific_user">Specific User(s)</option>
          <option value="role">By Role</option>
          <option value="contact_owner">Contact Owner</option>
        </select>
      </div>
      {cfg.followerType === 'specific_user' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">User IDs (comma-separated)</label>
          <input type="text" value={(cfg.userIds ?? []).join(', ')} onChange={e => set('userIds', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
            placeholder="user-id-1, user-id-2" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      {cfg.followerType === 'role' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Roles (comma-separated)</label>
          <input type="text" value={(cfg.roleNames ?? []).join(', ')} onChange={e => set('roleNames', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
            placeholder="admin, sales" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
    </div>
  );
}
