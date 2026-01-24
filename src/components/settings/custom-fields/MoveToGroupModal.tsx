import { useState } from 'react';
import { X, FolderInput, Loader2 } from 'lucide-react';
import type { CustomField, CustomFieldGroup } from '../../../types';

interface MoveToGroupModalProps {
  field?: CustomField | null;
  fieldCount?: number;
  groups: CustomFieldGroup[];
  currentGroupId: string | null;
  onMove: (groupId: string | null) => Promise<void>;
  onClose: () => void;
}

export function MoveToGroupModal({
  field,
  fieldCount = 1,
  groups,
  currentGroupId,
  onMove,
  onClose,
}: MoveToGroupModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(currentGroupId);
  const [moving, setMoving] = useState(false);

  const currentGroup = groups.find((g) => g.id === currentGroupId);
  const isBulk = !field && fieldCount > 1;

  async function handleSubmit() {
    if (selectedGroupId === currentGroupId) {
      onClose();
      return;
    }

    setMoving(true);
    try {
      await onMove(selectedGroupId === '' ? null : selectedGroupId);
      onClose();
    } catch (err) {
      console.error('Failed to move field(s):', err);
      alert('Failed to move field(s)');
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-xl shadow-xl border border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <FolderInput className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Move {isBulk ? `${fieldCount} Fields` : 'Field'}
              </h2>
              {field && (
                <p className="text-sm text-slate-400">{field.name}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {currentGroup && (
            <div className="mb-4">
              <p className="text-sm text-slate-400">
                Currently in: <span className="text-white font-medium">{currentGroup.name}</span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Select destination group
            </label>
            <select
              value={selectedGroupId || ''}
              onChange={(e) => setSelectedGroupId(e.target.value || null)}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">No Group (Ungrouped)</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.fields?.length || 0} fields)
                </option>
              ))}
            </select>
          </div>

          {selectedGroupId !== currentGroupId && selectedGroupId && (
            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <p className="text-sm text-cyan-400">
                {isBulk ? `${fieldCount} fields` : 'This field'} will be moved to{' '}
                <span className="font-medium">
                  {groups.find((g) => g.id === selectedGroupId)?.name || 'Ungrouped'}
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={moving || selectedGroupId === currentGroupId}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-teal-600 rounded-lg hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {moving && <Loader2 className="w-4 h-4 animate-spin" />}
            {moving ? 'Moving...' : 'Move'}
          </button>
        </div>
      </div>
    </div>
  );
}
