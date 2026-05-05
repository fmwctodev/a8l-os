import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, FileText, Wand2, Mail, MoreVertical,
  Edit3, Trash2, Send, Archive, ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  listEmailTemplates,
  deleteEmailTemplate,
  publishEmailTemplate,
  type EmailTemplate,
  type TemplateStatus,
} from '../../services/emailTemplates';

const STATUS_BADGES: Record<TemplateStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-amber-100 text-amber-700' },
  published: { label: 'Published', cls: 'bg-emerald-100 text-emerald-700' },
  archived: { label: 'Archived', cls: 'bg-gray-100 text-gray-600' },
};

export default function EmailTemplates() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = user?.organization_id ?? null;
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TemplateStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const list = await listEmailTemplates(orgId);
      setTemplates(list);
    } catch (e) {
      console.error('Failed to list email templates:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [orgId]);

  const filtered = templates.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!t.name.toLowerCase().includes(s) && !(t.description ?? '').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const handleDelete = async (t: EmailTemplate) => {
    if (!confirm(`Delete email template "${t.name}"? This can't be undone.`)) return;
    try {
      await deleteEmailTemplate(t.id);
      load();
    } catch (e) {
      alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  const handlePublish = async (t: EmailTemplate) => {
    try {
      await publishEmailTemplate(t.id);
      load();
    } catch (e) {
      alert(`Publish failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            Email Templates
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Design transactional and lifecycle emails. Used by <code className="px-1 py-0.5 bg-gray-100 rounded">send_email_org</code> and <code className="px-1 py-0.5 bg-gray-100 rounded">send_email_personal</code> workflow actions.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New template
        </button>
      </header>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'draft', 'published', 'archived'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setStatusFilter(opt)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === opt
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {opt === 'all' ? 'All' : opt[0].toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading templates…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-700 mb-1">
            {templates.length === 0 ? 'No templates yet' : 'No templates match your filters'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {templates.length === 0
              ? 'Create your first email template to use in workflows.'
              : 'Try adjusting search or status.'}
          </p>
          {templates.length === 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create your first template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => {
            const badge = STATUS_BADGES[t.status];
            const ModeIcon = t.editor_mode === 'drag_drop' ? Wand2 : FileText;
            return (
              <div
                key={t.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-md bg-blue-50 flex items-center justify-center">
                      <ModeIcon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{t.name}</h3>
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  <TemplateMenu
                    template={t}
                    onEdit={() => navigate(`/email-templates/${t.id}`)}
                    onPublish={() => handlePublish(t)}
                    onDelete={() => handleDelete(t)}
                  />
                </div>

                <div className="text-xs text-gray-500 line-clamp-2 mb-3 min-h-[2.5rem]">
                  {t.description || t.subject_template || 'No description'}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{t.category || 'Uncategorized'}</span>
                  <span>{t.use_count} sends</span>
                </div>

                <button
                  onClick={() => navigate(`/email-templates/${t.id}`)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit template
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => {
            setShowCreateModal(false);
            navigate(`/email-templates/${id}`);
          }}
        />
      )}
    </div>
  );
}

function TemplateMenu({
  template,
  onEdit,
  onPublish,
  onDelete,
}: {
  template: EmailTemplate;
  onEdit: () => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 hover:bg-gray-100 rounded transition-colors"
      >
        <MoreVertical className="w-4 h-4 text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-20 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            <button
              onClick={() => { onEdit(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 text-left"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
            {template.status !== 'published' && (
              <button
                onClick={() => { onPublish(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 text-left"
              >
                <Send className="w-3.5 h-3.5" />
                Publish
              </button>
            )}
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CreateTemplateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const orgId = user?.organization_id ?? null;
  const [name, setName] = useState('');
  const [editorMode, setEditorMode] = useState<'plain_text' | 'drag_drop'>('plain_text');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!orgId || !name.trim()) return;
    setCreating(true);
    try {
      const { createEmailTemplate } = await import('../../services/emailTemplates');
      const t = await createEmailTemplate(orgId, {
        name: name.trim(),
        editor_mode: editorMode,
      }, user?.id ?? null);
      onCreated(t.id);
    } catch (e) {
      alert(`Create failed: ${(e as Error).message}`);
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New email template</h2>

        <label className="block text-xs font-medium text-gray-700 mb-1">Template name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Welcome email"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 mb-4"
          autoFocus
        />

        <label className="block text-xs font-medium text-gray-700 mb-1">Editor mode</label>
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            type="button"
            onClick={() => setEditorMode('plain_text')}
            className={`p-3 border rounded-lg text-left transition-colors ${
              editorMode === 'plain_text'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <FileText className="w-5 h-5 text-blue-600 mb-1" />
            <div className="text-sm font-medium text-gray-900">Plain text</div>
            <div className="text-xs text-gray-500">Simple textarea editor</div>
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('drag_drop')}
            className={`p-3 border rounded-lg text-left transition-colors ${
              editorMode === 'drag_drop'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Wand2 className="w-5 h-5 text-blue-600 mb-1" />
            <div className="text-sm font-medium text-gray-900">Drag & drop</div>
            <div className="text-xs text-gray-500">Visual block editor</div>
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
