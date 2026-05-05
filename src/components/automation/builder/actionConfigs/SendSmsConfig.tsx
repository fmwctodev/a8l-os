import type { ActionNodeData } from '../../../../types';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

/**
 * SendSmsConfig — configures a workflow `send_sms` action node.
 * The engine handler (workflow-processor) reads `config.body`, resolves
 * merge fields against contact + context_data, and dispatches via
 * plivo-sms-send. TCPA gating is enforced upstream by canSendOnChannel
 * (Phase 7) and by the form-submit applyTCPAGate (Phase B already shipped).
 */
export default function SendSmsConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  const body = (cfg.body as string) ?? '';
  const segments = Math.max(1, Math.ceil(body.length / 160));
  const remainingInSegment = 160 - (body.length % 160 || 160);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Message body
        </label>
        <textarea
          value={body}
          onChange={e => set('body', e.target.value)}
          rows={5}
          placeholder='Hi {{contact.first_name}}, just confirming your appointment on {{appointment.date}}. Reply STOP to opt out.'
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-mono"
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-500">
            {body.length} chars · {segments} SMS segment{segments > 1 ? 's' : ''}
          </span>
          {body.length > 0 && (
            <span className="text-xs text-gray-400">
              {remainingInSegment} until next segment
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Use <code className="px-1 py-0.5 bg-gray-100 rounded">{'{{contact.first_name}}'}</code>,{' '}
          <code className="px-1 py-0.5 bg-gray-100 rounded">{'{{appointment.date}}'}</code>, etc. for merge fields.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          From number
        </label>
        <select
          value={cfg.fromNumberMode ?? 'org_default'}
          onChange={e => set('fromNumberMode', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="org_default">Organization default SMS number</option>
          <option value="contact_owner">Contact owner's assigned number</option>
          <option value="specific">Specific number...</option>
        </select>
        {cfg.fromNumberMode === 'specific' && (
          <input
            type="text"
            value={cfg.fromNumber ?? ''}
            onChange={e => set('fromNumber', e.target.value)}
            placeholder="+18133209652"
            className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.includeOptOutFooter ?? true}
            onChange={e => set('includeOptOutFooter', e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-700 text-xs">Append "Reply STOP to opt out"</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.respectDnd ?? true}
            onChange={e => set('respectDnd', e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-700 text-xs">Respect DND / consent</span>
        </label>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Media URLs (optional, makes this an MMS)
        </label>
        <textarea
          value={(cfg.mediaUrls as string[] | undefined)?.join('\n') ?? ''}
          onChange={e => set('mediaUrls', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
          rows={2}
          placeholder="https://example.com/image.jpg"
          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">One URL per line. Public URLs only.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
        <strong>TCPA reminder:</strong> SMS will only fire if the contact has consented (opt-in stored in <code className="px-1 bg-amber-100 rounded">sms_consent</code> custom field) and is not on DND. The system gates these checks server-side in workflow-processor.
      </div>
    </div>
  );
}
