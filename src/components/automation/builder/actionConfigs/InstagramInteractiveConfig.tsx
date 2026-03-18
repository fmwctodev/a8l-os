import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function InstagramInteractiveConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Instagram Account</label>
        <input type="text" value={cfg.accountId ?? ''} onChange={e => set('accountId', e.target.value)}
          placeholder="Connected Instagram account ID" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Template ID (optional)</label>
        <input type="text" value={cfg.templateId ?? ''} onChange={e => set('templateId', e.target.value)}
          placeholder="Use saved template or write custom" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Response Text</label>
        <textarea value={cfg.responseText ?? ''} onChange={e => set('responseText', e.target.value)}
          rows={3} placeholder="Message text... Use {{contact.first_name}} for merge fields"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      </div>
    </div>
  );
}
