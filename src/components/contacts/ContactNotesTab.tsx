import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createNote, updateNote, deleteNote, toggleNotePin } from '../../services/contactNotes';
import type { ContactNote, ContactNoteMetadata } from '../../types';
import {
  Plus,
  Edit2,
  Trash2,
  Pin,
  Loader2,
  MessageSquare,
  Video,
  ExternalLink,
  FileText,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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

  const isMeetNote = (note: ContactNote) => note.source_type === 'google_meet';

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
        {notes.map((note) =>
          isMeetNote(note) ? (
            <MeetNoteCard
              key={note.id}
              note={note}
              canModify={canModifyNote(note)}
              onTogglePin={() => handleTogglePin(note)}
              onDelete={() => handleDelete(note.id)}
            />
          ) : (
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
          )
        )}
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

interface MeetNoteCardProps {
  note: ContactNote;
  canModify: boolean;
  onTogglePin: () => void;
  onDelete: () => void;
}

function MeetNoteCard({ note, canModify, onTogglePin, onDelete }: MeetNoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const meta = note.metadata as ContactNoteMetadata | null;

  const hasRecording = !!meta?.drive_urls?.recording;
  const hasTranscript = !!meta?.drive_urls?.transcript;
  const hasGeminiNotes = !!meta?.drive_urls?.gemini_notes;
  const hasCalendarLink = !!meta?.calendar_html_link;

  const attendeeCount = meta?.attendees?.length || 0;
  const durationMinutes = meta?.duration_minutes;

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        note.is_pinned
          ? 'border-amber-500/30 bg-slate-800/60'
          : 'border-teal-500/20 bg-gradient-to-r from-slate-800/70 to-teal-950/20'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
              <Video className="w-4 h-4 text-teal-400" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-white truncate">
                {note.title || 'Google Meet Note'}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-teal-400/80 font-medium">
                  Auto-generated from Google Meet
                </span>
                {note.is_pinned && <Pin className="w-3 h-3 text-amber-400" />}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {canModify && (
              <>
                <button
                  onClick={onTogglePin}
                  className={`p-1.5 rounded transition-colors ${
                    note.is_pinned
                      ? 'text-amber-400 hover:bg-amber-500/10'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                  }`}
                  title={note.is_pinned ? 'Unpin' : 'Pin'}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(note.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          {durationMinutes && (
            <span>{durationMinutes} min</span>
          )}
          {attendeeCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {attendeeCount} attendee{attendeeCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {hasRecording && (
            <a
              href={meta!.drive_urls!.recording!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-400 text-xs font-medium hover:bg-teal-500/20 transition-colors"
            >
              <Video className="w-3 h-3" />
              Recording
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {hasTranscript && (
            <a
              href={meta!.drive_urls!.transcript!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-400 text-xs font-medium hover:bg-sky-500/20 transition-colors"
            >
              <FileText className="w-3 h-3" />
              Transcript
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {hasGeminiNotes && (
            <a
              href={meta!.drive_urls!.gemini_notes!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
            >
              <FileText className="w-3 h-3" />
              Gemini Notes
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {hasCalendarLink && (
            <a
              href={meta!.calendar_html_link!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-500/10 text-slate-400 text-xs font-medium hover:bg-slate-500/20 transition-colors"
            >
              <Calendar className="w-3 h-3" />
              Event
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 mt-3 text-xs text-slate-400 hover:text-slate-300 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Show meeting details
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-700/50 px-4 py-3">
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {note.content}
          </p>
        </div>
      )}
    </div>
  );
}
