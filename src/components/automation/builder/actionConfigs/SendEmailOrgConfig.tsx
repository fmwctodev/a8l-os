import { useEffect, useState } from 'react';
import { Mail, FileText, AlertCircle } from 'lucide-react';
import type { ActionNodeData } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';
import { listEmailTemplates, type EmailTemplate } from '../../../../services/emailTemplates';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

/**
 * SendEmailOrgConfig — sends as the organization via SendGrid.
 * Templates are sourced from the marketing module's email_templates table.
 */
export default function SendEmailOrgConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });
  const { user } = useAuth();
  const orgId = user?.organization_id ?? null;

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const useTemplate = cfg.useTemplate !== false; // default true

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    listEmailTemplates(orgId, { status: 'published' })
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, [orgId]);

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-start gap-2">
        <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
          Sends from your organization's verified SendGrid sender. Higher deliverability for transactional + lifecycle emails.
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => set('useTemplate', true)}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            useTemplate ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5 inline mr-1" />
          Use template
        </button>
        <button
          type="button"
          onClick={() => set('useTemplate', false)}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            !useTemplate ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Raw email (ad-hoc)
        </button>
      </div>

      {useTemplate ? (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email template</label>
          <select
            value={cfg.template_id ?? ''}
            onChange={e => set('template_id', e.target.value || undefined)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            disabled={loading}
          >
            <option value="">{loading ? 'Loading…' : 'Select a template…'}</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.category ? ` (${t.category})` : ''}
              </option>
            ))}
          </select>
          {!loading && templates.length === 0 && (
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              No published templates yet — create one in the Email Templates page first.
            </p>
          )}
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={cfg.raw_subject ?? ''}
              onChange={e => set('raw_subject', e.target.value)}
              placeholder="Hi {{contact.first_name}} — quick update"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Body (HTML)</label>
            <textarea
              value={cfg.raw_body_html ?? ''}
              onChange={e => set('raw_body_html', e.target.value)}
              rows={8}
              placeholder="<p>Hi {{contact.first_name}},</p><p>...</p>"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-mono"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Recipient override (optional)</label>
        <input
          type="email"
          value={cfg.recipient_override ?? ''}
          onChange={e => set('recipient_override', e.target.value || undefined)}
          placeholder="Leave blank to use {{contact.email}}"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.track_opens ?? true}
            onChange={e => set('track_opens', e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-700 text-xs">Track opens</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.track_clicks ?? true}
            onChange={e => set('track_clicks', e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-700 text-xs">Track clicks</span>
        </label>
      </div>
    </div>
  );
}
