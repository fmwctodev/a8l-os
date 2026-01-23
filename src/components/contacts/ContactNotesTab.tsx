import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createNote, updateNote, deleteNote, toggleNotePin } from '../../services/contactNotes';
import type { ContactNote } from '../../types';
import { Plus, Edit2, Trash2, Pin, Loader2, MessageSquare } from 'lucide-react';

interface ContactNotesTabProps {
  contactId: string;
  notes: ContactNote[];
  onRefresh: () => void;
}

export function ContactNotesTab({ contactId, notes, onRefresh }: ContactNotesTabProps) {
  const { user: currentUser, hasPermission, isSuperAdmin } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit = hasPermission('contacts.edit');
  const isAdmin = isSuperAdmin || currentUser?.role?.hierarchy_level === 2;

  const handleAdd = async () => {
    if (!currentUser || !content.trim()) return;

    try {
      setIsSubmitting(true);
      await createNote(contactId, content.trim(), currentUser);
      setContent('');
      setIsAdding(false);
      onRefresh();
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (noteId: string) => {
    if (!currentUser || !content.trim()) return;

    try {
      setIsSubmitting(true);
      await updateNote(noteId, content.trim(), currentUser);
      setContent('');
      setEditingId(null);
      onRefresh();
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!currentUser || !confirm('Are you sure you want to delete this note?')) return;

    try {
      await deleteNote(noteId, currentUser);
      onRefresh();
    } catch {
    }
  };

  const handleTogglePin = async (note: ContactNote) => {
    try {
      await toggleNotePin(note.id, !note.is_pinned);
      onRefresh();
    } catch {
    }
  };

  const startEditing = (note: ContactNote) => {
    setEditingId(note.id);
    setContent(note.content);
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setContent('');
    setIsAdding(false);
  };

  const canModifyNote = (note: ContactNote) => {
    return note.user_id === currentUser?.id || isAdmin;
  };

  return (
    <div className="space-y-4">
      {canEdit && !isAdding && !editingId && (
        <button
          onClick={() => {
            setIsAdding(true);
            setContent('');
          }}
          className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </button>
      )}

      {isAdding && (
        <div className="bg-slate-800/50 rounded-lg p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a note..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!content.trim() || isSubmitting}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Note
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className={`bg-slate-800/50 rounded-lg p-4 ${note.is_pinned ? 'ring-1 ring-amber-500/30' : ''}`}
          >
            {editingId === note.id ? (
              <>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdate(note.id)}
                    disabled={!content.trim() || isSubmitting}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-white">
                        {note.user?.name || 'Unknown'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                      {note.is_pinned && (
                        <Pin className="w-3 h-3 text-amber-400" />
                      )}
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{note.content}</p>
                  </div>
                  {canModifyNote(note) && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTogglePin(note)}
                        className={`p-1.5 rounded transition-colors ${
                          note.is_pinned
                            ? 'text-amber-400 hover:bg-amber-500/10'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                        }`}
                        title={note.is_pinned ? 'Unpin note' : 'Pin note'}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startEditing(note)}
                        className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                        title="Edit note"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {notes.length === 0 && !isAdding && (
        <div className="text-center py-8">
          <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No notes yet</p>
          {canEdit && (
            <button
              onClick={() => {
                setIsAdding(true);
                setContent('');
              }}
              className="mt-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Add the first note
            </button>
          )}
        </div>
      )}
    </div>
  );
}
