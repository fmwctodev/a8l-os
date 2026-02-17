import { useState, useEffect } from 'react';
import { Send, Trash2, Loader2 } from 'lucide-react';
import type { ProjectNote } from '../../types';
import { getProjectNotes, createProjectNote, deleteProjectNote } from '../../services/projectNotes';

interface Props {
  projectId: string;
  orgId: string;
  canEdit: boolean;
  currentUserId: string;
}

export function ProjectNotesTab({ projectId, orgId, canEdit, currentUserId }: Props) {
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [body, setBody] = useState('');

  useEffect(() => {
    loadNotes();
  }, [projectId]);

  async function loadNotes() {
    try {
      const data = await getProjectNotes(projectId);
      setNotes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await createProjectNote(orgId, projectId, body.trim(), currentUserId);
      setBody('');
      await loadNotes();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteProjectNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" /></div>;
  }

  return (
    <div className="p-6 space-y-4">
      {canEdit && (
        <div className="flex gap-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
            }}
          />
          <button
            onClick={handleAdd}
            disabled={saving || !body.trim()}
            className="self-end px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 group">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center">
                  <span className="text-xs text-slate-300">
                    {note.created_by_user?.name?.charAt(0) || '?'}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-white font-medium">{note.created_by_user?.name || 'Unknown'}</span>
                  <span className="text-xs text-slate-500 ml-2">{timeAgo(note.created_at)}</span>
                </div>
              </div>
              {(note.created_by === currentUserId) && (
                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-wrap pl-9">{note.body}</p>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">No notes yet</div>
        )}
      </div>
    </div>
  );
}
