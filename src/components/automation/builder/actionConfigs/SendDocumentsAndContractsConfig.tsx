import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

export default function SendDocumentsAndContractsConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Document Template ID</label>
        <input type="text" value={cfg.templateId ?? ''} onChange={e => set('templateId', e.target.value)}
          placeholder="template-id" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <p className="text-xs text-gray-400 mt-1">Create templates in Payments &rarr; Documents & Contracts.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Send To</label>
        <select value={cfg.recipientType ?? 'contact'} onChange={e => set('recipientType', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="contact">Contact (in workflow)</option>
          <option value="contact_owner">Contact Owner</option>
          <option value="specific_user">Specific User</option>
        </select>
      </div>
      {cfg.recipientType === 'specific_user' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">User ID</label>
          <input type="text" value={(cfg.recipientIds ?? []).join(', ')} onChange={e => set('recipientIds', [e.target.value.trim()])}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Channel</label>
        <select value={cfg.deliveryChannel ?? 'email'} onChange={e => set('deliveryChannel', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="email">Email</option>
          <option value="sms">SMS (link)</option>
          <option value="both">Email + SMS</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.requireSignature ?? true} onChange={e => set('requireSignature', e.target.checked)}
          className="rounded border-gray-300" />
        <span className="text-gray-700">Require electronic signature</span>
      </label>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Link To Entity</label>
        <select value={cfg.linkedEntityType ?? 'contact'} onChange={e => set('linkedEntityType', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="contact">Contact</option>
          <option value="opportunity">Opportunity</option>
          <option value="project">Project</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Expiration (days)</label>
        <input type="number" min={1} value={cfg.expirationDays ?? 30} onChange={e => set('expirationDays', parseInt(e.target.value) || 30)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
    </div>
  );
}
