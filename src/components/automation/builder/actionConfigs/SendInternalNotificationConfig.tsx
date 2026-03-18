import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

const CHANNELS = [
  { key: 'in_app', label: 'In-App' },
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
  { key: 'slack', label: 'Slack' },
];

export default function SendInternalNotificationConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });
  const channels: string[] = cfg.channels ?? ['in_app'];

  const toggleChannel = (key: string) => {
    const updated = channels.includes(key) ? channels.filter(c => c !== key) : [...channels, key];
    set('channels', updated);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Recipients</label>
        <select value={cfg.recipientType ?? 'contact_owner'} onChange={e => set('recipientType', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="contact_owner">Contact Owner</option>
          <option value="specific_user">Specific Users</option>
          <option value="role">By Role</option>
          <option value="team">Entire Team</option>
        </select>
      </div>
      {cfg.recipientType === 'specific_user' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">User IDs (comma-separated)</label>
          <input type="text" value={(cfg.recipientIds ?? []).join(', ')} onChange={e => set('recipientIds', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
            placeholder="user-id-1, user-id-2" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      {cfg.recipientType === 'role' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Role Names (comma-separated)</label>
          <input type="text" value={(cfg.roleNames ?? []).join(', ')} onChange={e => set('roleNames', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
            placeholder="admin, sales" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
        <input type="text" value={cfg.title ?? ''} onChange={e => set('title', e.target.value)}
          placeholder="Notification title" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Body</label>
        <textarea value={cfg.body ?? ''} onChange={e => set('body', e.target.value)}
          rows={3} placeholder="Notification message... Use {{contact.first_name}} for merge fields"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Urgency</label>
        <select value={cfg.urgency ?? 'normal'} onChange={e => set('urgency', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Send Via</label>
        <div className="flex flex-wrap gap-3">
          {CHANNELS.map(c => (
            <label key={c.key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={channels.includes(c.key)} onChange={() => toggleChannel(c.key)}
                className="rounded border-gray-300 text-blue-600" />
              {c.label}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.includeContactLink ?? true} onChange={e => set('includeContactLink', e.target.checked)}
          className="rounded border-gray-300" />
        <span className="text-gray-700">Include link to contact record</span>
      </label>
    </div>
  );
}
