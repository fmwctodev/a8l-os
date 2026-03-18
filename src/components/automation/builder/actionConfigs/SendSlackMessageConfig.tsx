import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function SendSlackMessageConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Channel Type</label>
        <select value={cfg.channelType ?? 'webhook'} onChange={e => set('channelType', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="webhook">Incoming Webhook URL</option>
          <option value="channel">Channel Name</option>
          <option value="user">Direct Message to User</option>
        </select>
      </div>
      {cfg.channelType === 'webhook' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Webhook URL</label>
          <input type="url" value={cfg.webhookUrl ?? ''} onChange={e => set('webhookUrl', e.target.value)}
            placeholder="https://hooks.slack.com/..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      {cfg.channelType === 'channel' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Channel Name</label>
          <input type="text" value={cfg.channelId ?? ''} onChange={e => set('channelId', e.target.value)}
            placeholder="#general" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      {cfg.channelType === 'user' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Slack User ID</label>
          <input type="text" value={cfg.userId ?? ''} onChange={e => set('userId', e.target.value)}
            placeholder="U01ABCDEF" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
        <textarea value={cfg.message ?? ''} onChange={e => set('message', e.target.value)}
          rows={3} placeholder="Message text... Use {{contact.first_name}} for merge fields"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.includeContactLink ?? false} onChange={e => set('includeContactLink', e.target.checked)}
          className="rounded border-gray-300" />
        <span className="text-gray-700">Include contact link in message</span>
      </label>
    </div>
  );
}
