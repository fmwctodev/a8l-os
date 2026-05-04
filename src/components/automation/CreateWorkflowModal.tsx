import { useState, useEffect } from 'react';
import { X, Loader2, FolderPlus, Sparkles, Pencil } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createWorkflow, updateWorkflowDraft, getWorkflowFolders } from '../../services/workflows';
import { generateWorkflowFromPrompt } from '../../services/workflowAIGenerator';

interface CreateWorkflowModalProps {
  onClose: () => void;
  onSuccess: (workflowId: string) => void;
  initialFolder?: string;
}

type Tab = 'manual' | 'ai';

export function CreateWorkflowModal({ onClose, onSuccess, initialFolder }: CreateWorkflowModalProps) {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('manual');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState(initialFolder?.trim() || '');
  const [folderOptions, setFolderOptions] = useState<string[]>([]);
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI tab
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiValidationWarnings, setAiValidationWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser?.organization_id) return;
    getWorkflowFolders(currentUser.organization_id)
      .then(setFolderOptions)
      .catch(() => setFolderOptions([]));
  }, [currentUser?.organization_id]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser?.organization_id || !name.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const workflow = await createWorkflow(
        currentUser.organization_id,
        name.trim(),
        description.trim() || null,
        currentUser.id,
        folder.trim() || null
      );

      onSuccess(workflow.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser?.organization_id || !aiPrompt.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      setAiValidationWarnings([]);

      const result = await generateWorkflowFromPrompt({
        prompt: aiPrompt.trim(),
        orgId: currentUser.organization_id,
        name: name.trim() || undefined,
      });

      // Persist a fresh workflow with the AI definition seeded into the draft
      const workflowName = name.trim() || result.suggestedName || 'AI-generated workflow';
      const workflow = await createWorkflow(
        currentUser.organization_id,
        workflowName,
        description.trim() || null,
        currentUser.id,
        folder.trim() || null
      );

      // Drop the AI-produced definition into the draft (server already
      // validated structure; non-blocking errors get shown below the form).
      await updateWorkflowDraft(workflow.id, result.definition);

      if (result.validationErrors.length > 0) {
        // Still hand off — the user can fix these inline in the builder
        setAiValidationWarnings(result.validationErrors);
      }

      onSuccess(workflow.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Create Workflow</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex border-b border-slate-800 px-4">
          <button
            onClick={() => setTab('manual')}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'manual'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            Build manually
          </button>
          <button
            onClick={() => setTab('ai')}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'ai'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Build with AI
          </button>
        </div>

        <form
          onSubmit={tab === 'manual' ? handleManualSubmit : handleAiSubmit}
          className="p-4 space-y-4"
        >
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {aiValidationWarnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-0.5">
              <div className="font-medium text-amber-200">
                Workflow created — fix these in the builder before publishing:
              </div>
              {aiValidationWarnings.slice(0, 5).map((m, i) => (
                <div key={i}>• {m}</div>
              ))}
              {aiValidationWarnings.length > 5 && (
                <div className="text-amber-400/80">+{aiValidationWarnings.length - 5} more</div>
              )}
            </div>
          )}

          {tab === 'ai' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Describe what you want this workflow to do <span className="text-red-400">*</span>
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={`e.g. When a contact submits the contact form, send a welcome email immediately, wait 1 hour, then text them to confirm we got their request. If they don't reply within 24h, notify the assigned salesperson.`}
                rows={6}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none text-sm"
                required
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-1">
                The AI uses our trigger and action catalog. You can edit any node afterward.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Workflow Name {tab === 'manual' && <span className="text-red-400">*</span>}
              {tab === 'ai' && <span className="text-slate-500 text-xs ml-1">(optional)</span>}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tab === 'manual' ? 'e.g., New Lead Welcome Sequence' : 'AI will suggest one'}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              required={tab === 'manual'}
              autoFocus={tab === 'manual'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Folder</label>
            {isCreatingNewFolder || folderOptions.length === 0 ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="e.g., Lead Nurture"
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                {folderOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewFolder(false);
                      setFolder('');
                    }}
                    className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Pick existing
                  </button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">No folder</option>
                  {folderOptions.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewFolder(true);
                    setFolder('');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-cyan-400 border border-slate-700 hover:bg-slate-800"
                  title="New folder"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  New
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (tab === 'manual' ? !name.trim() : !aiPrompt.trim())}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {tab === 'manual' ? 'Create Workflow' : 'Generate & Open'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
