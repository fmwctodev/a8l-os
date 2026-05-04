import { useState, useEffect } from 'react';
import { X, Loader2, FolderPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createWorkflow, getWorkflowFolders } from '../../services/workflows';

interface CreateWorkflowModalProps {
  onClose: () => void;
  onSuccess: (workflowId: string) => void;
  initialFolder?: string;
}

export function CreateWorkflowModal({ onClose, onSuccess, initialFolder }: CreateWorkflowModalProps) {
  const { user: currentUser } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState(initialFolder?.trim() || '');
  const [folderOptions, setFolderOptions] = useState<string[]>([]);
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.organization_id) return;
    getWorkflowFolders(currentUser.organization_id)
      .then(setFolderOptions)
      .catch(() => setFolderOptions([]));
  }, [currentUser?.organization_id]);

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Create Workflow</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
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
              Workflow Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New Lead Welcome Sequence"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Folder
            </label>
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
            <p className="text-xs text-slate-500 mt-1">
              Folders help you organize related workflows together.
            </p>
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
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Workflow
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
