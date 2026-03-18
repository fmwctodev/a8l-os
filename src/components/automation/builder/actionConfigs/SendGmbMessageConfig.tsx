import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function SendGmbMessageConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Google Business Account</label>
        <input type="text" value={cfg.accountId ?? ''} onChange={e => set('accountId', e.target.value)}
          placeholder="GMB account ID" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <p className="text-xs text-gray-400 mt-1">Connect your Google Business Profile in Settings &rarr; Integrations first.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
        <textarea value={cfg.message ?? ''} onChange={e => set('message', e.target.value)}
          rows={3} placeholder="Message text..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      </div>
    </div>
  );
}
