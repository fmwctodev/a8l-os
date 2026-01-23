import { useState } from 'react';
import { X, Tag, Loader2, Plus, Minus } from 'lucide-react';
import type { Tag as TagType } from '../../types';

interface BulkTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTag: (tagId: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
  tags: TagType[];
  selectedCount: number;
  mode: 'add' | 'remove';
}

export function BulkTagsModal({
  isOpen,
  onClose,
  onAddTag,
  onRemoveTag,
  tags,
  selectedCount,
  mode,
}: BulkTagsModalProps) {
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedTagId) return;

    setIsLoading(true);
    try {
      if (mode === 'add') {
        await onAddTag(selectedTagId);
      } else {
        await onRemoveTag(selectedTagId);
      }
      onClose();
    } catch (error) {
      console.error(`Failed to ${mode} tag:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isAdd = mode === 'add';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 w-full max-w-md shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isAdd ? 'bg-emerald-500/10' : 'bg-red-500/10'
                }`}
              >
                {isAdd ? (
                  <Plus className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Minus className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {isAdd ? 'Add Tag' : 'Remove Tag'}
                </h2>
                <p className="text-sm text-slate-400">{selectedCount} contacts selected</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="p-4">
            <p className="text-sm text-slate-400 mb-4">
              {isAdd
                ? 'Select a tag to add to the selected contacts:'
                : 'Select a tag to remove from the selected contacts:'}
            </p>

            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedTagId(tag.id)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedTagId === tag.id
                      ? 'ring-2 ring-offset-2 ring-offset-slate-900'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    ...(selectedTagId === tag.id ? { ringColor: tag.color } : {}),
                  }}
                >
                  <Tag className="w-3.5 h-3.5" />
                  {tag.name}
                </button>
              ))}
            </div>

            {tags.length === 0 && (
              <div className="text-center py-8">
                <Tag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No tags available</p>
                <p className="text-xs text-slate-600 mt-1">Create tags in settings first</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !selectedTagId}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                isAdd ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isAdd ? 'Adding...' : 'Removing...'}
                </>
              ) : isAdd ? (
                'Add Tag'
              ) : (
                'Remove Tag'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
