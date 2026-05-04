import { useState } from 'react';
import { X, Loader2, BookmarkPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { saveWorkflowAsTemplate } from '../../services/automationTemplates';

const CATEGORIES = [
  { value: 'sales', label: 'Sales' },
  { value: 'lead_management', label: 'Lead Management' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'follow_up', label: 'Follow-Up' },
  { value: 'internal_ops', label: 'Internal Ops' },
];

const COMPLEXITIES = [
  { value: 'simple', label: 'Simple' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'advanced', label: 'Advanced' },
];

const CHANNEL_TAGS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'ai', label: 'AI' },
  { value: 'notification', label: 'Notification' },
];

interface SaveAsTemplateModalProps {
  workflowId: string;
  defaultName?: string;
  defaultDescription?: string | null;
  onClose: () => void;
  onSuccess?: (templateId: string) => void;
}

export function SaveAsTemplateModal({
  workflowId,
  defaultName,
  defaultDescription,
  onClose,
  onSuccess,
}: SaveAsTemplateModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState(defaultName?.trim() || '');
  const [description, setDescription] = useState(defaultDescription?.trim() || '');
  const [category, setCategory] = useState('sales');
  const [complexity, setComplexity] = useState<'simple' | 'moderate' | 'advanced'>('simple');
  const [channelTags, setChannelTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(t: string) {
    setChannelTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.organization_id || !name.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      const template = await saveWorkflowAsTemplate({
        orgId: user.organization_id,
        userId: user.id,
        workflowId,
        templateName: name.trim(),
        templateDescription: description.trim() || null,
        category,
        complexity,
        channelTags,
      });
      onSuccess?.(template.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Save as Template</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Template Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New Lead Welcome"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Complexity</label>
              <select
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as typeof complexity)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {COMPLEXITIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Channels Used</label>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_TAGS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleTag(t.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    channelTags.includes(t.value)
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white text-sm font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
