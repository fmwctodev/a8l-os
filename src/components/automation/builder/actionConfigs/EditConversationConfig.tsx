import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function EditConversationConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Operation</label>
        <select value={cfg.operation ?? 'mark_read'} onChange={e => set('operation', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="mark_read">Mark as Read</option>
          <option value="mark_unread">Mark as Unread</option>
          <option value="archive">Archive</option>
          <option value="close">Close</option>
          <option value="reopen">Reopen</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Target Conversation</label>
        <select value={cfg.conversationSource ?? 'most_recent'} onChange={e => set('conversationSource', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="current">Current conversation (from trigger)</option>
          <option value="most_recent">Most recent conversation</option>
        </select>
      </div>
    </div>
  );
}
