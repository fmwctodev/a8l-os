import { useState } from 'react';
import {
  X, CalendarDays, Clock, MapPin, Video, Users, Edit3, Trash2,
  Save, Loader2, AlertTriangle,
} from 'lucide-react';
import type { CalendarEvent } from '../../../types';
import { updateCalendarEvent, deleteCalendarEvent } from '../../../services/calendarEvents';
import { useAuth } from '../../../contexts/AuthContext';
import { formatTimeRange } from '../../../utils/calendarViewUtils';

interface EventDetailModalProps {
  event: CalendarEvent;
  onClose: () => void;
  onUpdated: () => void;
}

export function EventDetailModal({ event, onClose, onUpdated }: EventDetailModalProps) {
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState(event.title);
  const [editDescription, setEditDescription] = useState(event.description || '');
  const [editLocation, setEditLocation] = useState(event.location || '');
  const [editStartDate, setEditStartDate] = useState(
    new Date(event.start_at_utc).toISOString().slice(0, 16)
  );
  const [editEndDate, setEditEndDate] = useState(
    new Date(event.end_at_utc).toISOString().slice(0, 16)
  );

  const timeDisplay = formatTimeRange(event.start_at_utc, event.end_at_utc);
  const dateDisplay = new Date(event.start_at_utc).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const canEdit = currentUser?.id === event.user_id ||
    currentUser?.role?.name === 'SuperAdmin' ||
    currentUser?.role?.name === 'Admin';

  const handleSave = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateCalendarEvent(event.id, {
        title: editTitle,
        description: editDescription || null,
        location: editLocation || null,
        start_at_utc: new Date(editStartDate).toISOString(),
        end_at_utc: new Date(editEndDate).toISOString(),
      }, currentUser);
      setIsEditing(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteCalendarEvent(event.id, currentUser);
      onClose();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              {isEditing ? 'Edit Event' : 'Event Details'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="p-4 space-y-4">
          {isEditing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Start</label>
                  <input type="datetime-local" value={editStartDate} onChange={e => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">End</label>
                  <input type="datetime-local" value={editEndDate} onChange={e => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Location</label>
                <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Add location..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} placeholder="Add description..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </>
          ) : (
            <>
              <h4 className="text-xl font-semibold text-white">{event.title}</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white">{dateDisplay}</p>
                    {!event.all_day && <p className="text-sm text-slate-400">{timeDisplay}</p>}
                    {event.all_day && <p className="text-sm text-slate-400">All day</p>}
                  </div>
                </div>
                {event.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-white">{event.location}</p>
                  </div>
                )}
                {event.google_meet_link && (
                  <div className="flex items-start gap-3">
                    <Video className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <a href={event.google_meet_link} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 underline">
                      Join Google Meet
                    </a>
                  </div>
                )}
                {event.description && (
                  <div className="pt-2 border-t border-slate-800">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{event.description}</p>
                  </div>
                )}
                {event.attendees && event.attendees.length > 0 && (
                  <div className="pt-2 border-t border-slate-800">
                    <p className="text-xs text-slate-500 mb-2">
                      <Users className="w-3 h-3 inline mr-1" />
                      Attendees ({event.attendees.length})
                    </p>
                    <div className="space-y-1.5">
                      {event.attendees.map((att, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                            <span className="text-xs text-slate-400">
                              {(att.name || att.email || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm text-white">{att.name || att.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="mx-4 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-300 mb-3">Delete this event? It will also be removed from Google Calendar.</p>
            <div className="flex items-center gap-2">
              <button onClick={handleDelete} disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </>
          ) : canEdit ? (
            <>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-red-400 text-sm hover:bg-red-500/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
