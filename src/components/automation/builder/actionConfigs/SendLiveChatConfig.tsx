import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function SendLiveChatConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Widget ID (optional)</label>
        <input type="text" value={cfg.widgetId ?? ''} onChange={e => set('widgetId', e.target.value)}
          placeholder="Leave blank to use default widget" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Target Conversation</label>
        <select value={cfg.conversationTarget ?? 'current'} onChange={e => set('conversationTarget', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="current">Current conversation (from trigger)</option>
          <option value="most_recent">Most recent live chat</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
        <textarea value={cfg.message ?? ''} onChange={e => set('message', e.target.value)}
          rows={3} placeholder="Message text... Use {{contact.first_name}} for merge fields"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      </div>
    </div>
  );
}
