import { useEffect, useState } from 'react';
import { Mail, FileText, AlertCircle, User } from 'lucide-react';
import type { ActionNodeData } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';
import { listEmailTemplates, type EmailTemplate } from '../../../../services/emailTemplates';

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

/**
 * SendEmailPersonalConfig — sends from a user's Gmail OAuth account.
 * Email appears from the real person; threading + replies route through their inbox.
 * Use case: 1:1 personal-touch follow-ups from sales / account owners.
 */
export default function SendEmailPersonalConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });
  const { user } = useAuth();
  const orgId = user?.organization_id ?? null;

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const useTemplate = cfg.useTemplate !== false;

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    listEmailTemplates(orgId, { status: 'published' })
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, [orgId]);

  return (
    <div className="space-y-3">
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-2.5 flex items-start gap-2">
        <User className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-violet-800">
          Sends from a user's Gmail OAuth account. Email appears from the real person; replies route to their inbox. Best for 1:1 follow-ups.
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Send as (From user)</label>
        <select
          value={cfg.from_user_id ?? 'contact_owner'}
          onChange={e => set('from_user_id', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="contact_owner">Contact owner (default)</option>
          <option value="workflow_creator">Workflow creator</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          The chosen user must have a Gmail OAuth connection. If not, the action errors and the workflow continues.
        </p>
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
                {t.name}{t.category ? ` (${t.category})` : ''}
              </option>
            ))}
          </select>
          {!loading && templates.length === 0 && (
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              No published templates yet — create one in Email Templates first.
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
              placeholder="Hi {{contact.first_name}}, following up..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Body</label>
            <textarea
              value={cfg.raw_body_html ?? ''}
              onChange={e => set('raw_body_html', e.target.value)}
              rows={8}
              placeholder="Hey {{contact.first_name}}, just wanted to..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Plain text or HTML. Sent through Gmail so HTML is preserved if you include it.
            </p>
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
            checked={cfg.thread_with_existing ?? true}
            onChange={e => set('thread_with_existing', e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-700 text-xs">Thread with existing conversation</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.respect_dnd ?? true}
            onChange={e => set('respect_dnd', e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-700 text-xs">Respect email DND</span>
        </label>
      </div>
    </div>
  );
}
