import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function SendMessengerConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Channel</label>
        <select value={cfg.channel ?? 'facebook'} onChange={e => set('channel', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="facebook">Facebook Messenger</option>
          <option value="instagram">Instagram Direct</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Account ID</label>
        <input type="text" value={cfg.accountId ?? ''} onChange={e => set('accountId', e.target.value)}
          placeholder="Connected account ID" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
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
