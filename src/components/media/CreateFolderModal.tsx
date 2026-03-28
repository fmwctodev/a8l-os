import { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { createDriveFolderViaApi } from '../../services/googleDrive';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string;
  driveId?: string;
  onCreated: () => void;
}

export default function CreateFolderModal({
  isOpen,
  onClose,
  parentId,
  driveId,
  onCreated,
}: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createDriveFolderViaApi(name.trim(), parentId, driveId);
      setName('');
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (!creating) {
      setName('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-slate-300" />
            </div>
            <h3 className="text-base font-semibold text-white">New Folder</h3>
          </div>
          <button onClick={handleClose} disabled={creating} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          <label className="text-sm font-medium text-slate-300 mb-2 block">Folder name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled folder"
            className="w-full px-3 py-2.5 text-sm border border-slate-600 rounded-lg bg-slate-900 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          {error && (
            <p className="mt-2 text-sm text-rose-400">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-700 bg-slate-900/30">
          <button
            onClick={handleClose}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
