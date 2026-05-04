import { useState, useEffect } from 'react';
import { Copy, RefreshCw, Plus, Trash2, Check } from 'lucide-react';
import type { TriggerNodeData, WebhookTriggerConfig as WebhookConfig } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const IDENTIFIER_FIELDS: { value: 'email' | 'phone' | 'external_id' | 'custom'; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'external_id', label: 'External ID' },
  { value: 'custom', label: 'Custom field' },
];

const RE_ENROLLMENT: { value: 'never' | 'always' | 'after_completion'; label: string }[] = [
  { value: 'never', label: 'Never (only once)' },
  { value: 'after_completion', label: 'After previous run completes' },
  { value: 'always', label: 'Always (every webhook fires)' },
];

function generateToken(): string {
  // 32 hex chars
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function WebhookTriggerConfig({ data, onUpdate }: Props) {
  const config: WebhookConfig = (data.webhookConfig ?? {
    name: 'Webhook trigger',
    contactIdentifierField: 'email',
    contactIdentifierPath: 'email',
    payloadMapping: [],
    createContactIfMissing: true,
    updateExistingContact: true,
    reEnrollmentPolicy: 'always',
  }) as WebhookConfig;

  const [copied, setCopied] = useState(false);

  // Auto-generate a token on first mount if missing
  useEffect(() => {
    if (!config.token) {
      onUpdate({ webhookConfig: { ...config, token: generateToken() } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
  const webhookUrl = config.token
    ? `${supabaseUrl}/functions/v1/workflow-webhook-receiver/${config.token}`
    : '';

  function update(patch: Partial<WebhookConfig>) {
    onUpdate({ webhookConfig: { ...config, ...patch } });
  }

  function regenerateToken() {
    if (!confirm('Regenerate the webhook URL? Existing producers using the old URL will stop firing.')) return;
    update({ token: generateToken() });
  }

  function addMapping() {
    update({
      payloadMapping: [...(config.payloadMapping || []), { sourceField: '', targetField: '' }],
    });
  }

  function updateMapping(idx: number, patch: Partial<{ sourceField: string; targetField: string }>) {
    const next = [...(config.payloadMapping || [])];
    next[idx] = { ...next[idx], ...patch };
    update({ payloadMapping: next });
  }

  function removeMapping(idx: number) {
    const next = (config.payloadMapping || []).filter((_, i) => i !== idx);
    update({ payloadMapping: next });
  }

  async function copy() {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Webhook Name</label>
        <input
          type="text"
          value={config.name || ''}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. New lead from Zapier"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Receiver URL</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg break-all">
            {webhookUrl || 'Generating…'}
          </code>
          <button
            type="button"
            onClick={copy}
            disabled={!webhookUrl}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            title="Copy URL"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={regenerateToken}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="Regenerate token"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-1">
          External producers POST a JSON payload here. The receiver matches the contact, optionally creates one,
          then enrolls them in this workflow.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Match contact by</label>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={config.contactIdentifierField}
            onChange={(e) => update({ contactIdentifierField: e.target.value as WebhookConfig['contactIdentifierField'] })}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {IDENTIFIER_FIELDS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={config.contactIdentifierPath}
            onChange={(e) => update({ contactIdentifierPath: e.target.value })}
            placeholder="JSON path, e.g. lead.email"
            className="px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">
          Where to find the identifier inside the incoming JSON payload (dot-path).
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={config.createContactIfMissing}
            onChange={(e) => update({ createContactIfMissing: e.target.checked })}
            className="mt-0.5 rounded"
          />
          <span>Create contact if not found</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={config.updateExistingContact}
            onChange={(e) => update({ updateExistingContact: e.target.checked })}
            className="mt-0.5 rounded"
          />
          <span>Update existing contact with mapped fields</span>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Re-enrollment</label>
        <select
          value={config.reEnrollmentPolicy}
          onChange={(e) => update({ reEnrollmentPolicy: e.target.value as WebhookConfig['reEnrollmentPolicy'] })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          {RE_ENROLLMENT.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-gray-700">Payload Mapping</label>
          <button
            type="button"
            onClick={addMapping}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded"
          >
            <Plus className="w-3 h-3" /> Add mapping
          </button>
        </div>
        <div className="space-y-2">
          {(config.payloadMapping || []).length === 0 && (
            <p className="text-[11px] text-gray-400 italic">
              No mappings yet. Add one to copy fields from the webhook payload onto the contact (e.g.
              <code className="ml-1">lead.first_name</code> → <code>first_name</code>).
            </p>
          )}
          {(config.payloadMapping || []).map((m, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={m.sourceField}
                onChange={(e) => updateMapping(idx, { sourceField: e.target.value })}
                placeholder="payload.path"
                className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <span className="text-gray-400">→</span>
              <input
                type="text"
                value={m.targetField}
                onChange={(e) => updateMapping(idx, { targetField: e.target.value })}
                placeholder="contact_field"
                className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={() => removeMapping(idx)}
                className="p-1.5 text-gray-400 hover:text-red-500 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {webhookUrl && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-[11px] font-medium text-gray-700 mb-1">Test with curl:</p>
          <code className="block text-[11px] font-mono text-gray-600 break-all">
            curl -X POST {webhookUrl} \<br />
            &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
            &nbsp;&nbsp;-d '{`{"email":"test@example.com","first_name":"Test"}`}'
          </code>
        </div>
      )}
    </div>
  );
}
