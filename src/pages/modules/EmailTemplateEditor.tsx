import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Send, Eye, FileText, Wand2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getEmailTemplate,
  updateEmailTemplate,
  publishEmailTemplate,
  type EmailTemplate,
} from '../../services/emailTemplates';

const COMMON_MERGE_FIELDS = [
  'contact.first_name',
  'contact.last_name',
  'contact.email',
  'contact.phone',
  'contact.company',
  'contact.full_name',
  'appointment.date',
  'appointment.time',
  'appointment.start_at_utc',
  'opportunity.stage_name',
  'opportunity.value_amount',
  'message.body',
];

export default function EmailTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Local editable state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [category, setCategory] = useState('');
  const [bodyPlain, setBodyPlain] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  useEffect(() => {
    if (!id) return;
    getEmailTemplate(id).then(t => {
      if (!t) {
        navigate('/email-templates');
        return;
      }
      setTemplate(t);
      setName(t.name);
      setDescription(t.description ?? '');
      setSubject(t.subject_template);
      setPreviewText(t.preview_text ?? '');
      setCategory(t.category ?? '');
      setBodyPlain(t.body_plain ?? '');
      setBodyHtml(t.body_html ?? '');
      setLoading(false);
    });
  }, [id, navigate]);

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      // For plain_text mode, body_html mirrors body_plain wrapped in a <pre> for safety
      // For drag_drop mode (not yet built), the editor would supply rendered HTML separately
      let outputHtml = bodyHtml;
      if (template.editor_mode === 'plain_text') {
        const escaped = (bodyPlain || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
        outputHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5;"><p style="white-space: pre-wrap;">${escaped}</p></div>`;
      }
      await updateEmailTemplate(template.id, {
        name,
        description: description || undefined,
        subject_template: subject,
        preview_text: previewText || undefined,
        category: category || undefined,
        body_plain: bodyPlain,
        body_html: outputHtml,
      });
      const refreshed = await getEmailTemplate(template.id);
      setTemplate(refreshed);
      if (refreshed) setBodyHtml(refreshed.body_html);
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!template) return;
    await handleSave();
    try {
      await publishEmailTemplate(template.id);
      const refreshed = await getEmailTemplate(template.id);
      setTemplate(refreshed);
      alert('Template published. Now selectable from email actions in the Workflow Builder.');
    } catch (e) {
      alert(`Publish failed: ${(e as Error).message}`);
    }
  };

  const insertMergeField = (field: string) => {
    setBodyPlain(prev => `${prev}{{${field}}}`);
  };

  if (loading || !template) {
    return <div className="p-6 text-gray-400">Loading…</div>;
  }

  const ModeIcon = template.editor_mode === 'drag_drop' ? Wand2 : FileText;

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/email-templates')}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="text-base font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded px-1"
              placeholder="Template name"
            />
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              <ModeIcon className="w-3.5 h-3.5" />
              {template.editor_mode === 'drag_drop' ? 'Drag & drop' : 'Plain text'}
              <span>•</span>
              <span className={`font-medium ${
                template.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {template.status[0].toUpperCase() + template.status.slice(1)}
              </span>
              {template.status === 'published' && template.published_at && (
                <>
                  <span>•</span>
                  <span>v{Math.max(1, Math.floor(template.use_count / 1) + 1)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <Eye className="w-3.5 h-3.5" />
            {showPreview ? 'Hide preview' : 'Preview'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            onClick={handlePublish}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Publish
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        <div className="col-span-3 bg-white border border-gray-200 rounded-lg p-4 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Settings</h3>

          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="What's this template for?"
            className="w-full mb-3 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500/20 resize-none"
          />

          <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full mb-3 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500/20"
          >
            <option value="">None</option>
            <option value="welcome">Welcome</option>
            <option value="reminder">Reminder</option>
            <option value="announcement">Announcement</option>
            <option value="follow-up">Follow-up</option>
            <option value="receipt">Receipt</option>
            <option value="re-engagement">Re-engagement</option>
            <option value="onboarding">Onboarding</option>
          </select>

          <label className="block text-xs font-medium text-gray-700 mb-1">Preview text</label>
          <input
            type="text"
            value={previewText}
            onChange={e => setPreviewText(e.target.value)}
            placeholder="Inbox preview snippet (~120 chars)"
            maxLength={150}
            className="w-full mb-4 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500/20"
          />

          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-5 mb-2">Merge fields</h3>
          <div className="space-y-1">
            {COMMON_MERGE_FIELDS.map(f => (
              <button
                key={f}
                onClick={() => insertMergeField(f)}
                className="w-full text-left px-2 py-1 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded transition-colors font-mono"
              >
                {`{{${f}}}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Click a field to insert at end of body. Edit subject manually.
          </p>
        </div>

        <div className={showPreview ? 'col-span-5' : 'col-span-9'}>
          <div className="bg-white border border-gray-200 rounded-lg flex flex-col h-full">
            <div className="px-4 py-3 border-b border-gray-100">
              <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Hi {{contact.first_name}}, ..."
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex-1 px-4 py-3 overflow-y-auto">
              {template.editor_mode === 'plain_text' ? (
                <textarea
                  value={bodyPlain}
                  onChange={e => setBodyPlain(e.target.value)}
                  rows={20}
                  placeholder="Write your email body here. Use {{contact.first_name}} for merge fields."
                  className="w-full h-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-mono"
                />
              ) : (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <Wand2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>Drag-and-drop editor coming soon.</p>
                  <p className="text-xs mt-2">Will integrate <code>react-email-editor</code> (Unlayer) — install dependency first.</p>
                  <textarea
                    value={bodyHtml}
                    onChange={e => setBodyHtml(e.target.value)}
                    rows={12}
                    placeholder="For now, paste raw HTML here…"
                    className="mt-4 w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {showPreview && (
          <div className="col-span-4">
            <div className="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Preview</h3>
                <p className="text-xs text-gray-400 mt-0.5">Sample contact: Sean Richard, Autom8ion Lab</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="text-xs text-gray-500 mb-2">Subject:</div>
                <div className="text-sm font-medium text-gray-900 mb-4 pb-3 border-b border-gray-100">
                  {(subject || '(no subject)').replace(/\{\{contact\.first_name\}\}/g, 'Sean').replace(/\{\{contact\.last_name\}\}/g, 'Richard').replace(/\{\{contact\.company\}\}/g, 'Autom8ion Lab').replace(/\{\{[^}]+\}\}/g, '?')}
                </div>
                <div
                  className="text-sm text-gray-800 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: (template.editor_mode === 'plain_text' ? bodyPlain.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)) : bodyHtml)
                      .replace(/\{\{contact\.first_name\}\}/g, 'Sean')
                      .replace(/\{\{contact\.last_name\}\}/g, 'Richard')
                      .replace(/\{\{contact\.email\}\}/g, 'sean@autom8ionlab.com')
                      .replace(/\{\{contact\.company\}\}/g, 'Autom8ion Lab')
                      .replace(/\{\{[^}]+\}\}/g, '<span style="background: #FEF3C7; color: #92400E; padding: 0 4px; border-radius: 2px; font-size: 11px;">?</span>')
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
