import { useState, useMemo } from 'react';
import {
  X, Calendar as CalendarIcon, Clock, MapPin, Video, ExternalLink,
  Users, Edit3, Trash2, Save, Loader2, AlertTriangle,
} from 'lucide-react';
import type { GoogleCalendarEvent } from '../../../types';
import { formatTimeRange } from '../../../utils/calendarViewUtils';
import { updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from '../../../services/googleCalendarEvents';

interface GoogleEventDetailModalProps {
  event: GoogleCalendarEvent;
  onClose: () => void;
  onUpdated: () => void;
  canEdit?: boolean;
}

export function GoogleEventDetailModal({
  event,
  onClose,
  onUpdated,
  canEdit = true,
}: GoogleEventDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editSummary, setEditSummary] = useState(event.summary || '');
  const [editDescription, setEditDescription] = useState(event.description || '');
  const [editLocation, setEditLocation] = useState(event.location || '');
  const [editStartDate, setEditStartDate] = useState(
    new Date(event.start_time).toISOString().slice(0, 16)
  );
  const [editEndDate, setEditEndDate] = useState(
    new Date(event.end_time).toISOString().slice(0, 16)
  );

  const timeDisplay = useMemo(
    () => formatTimeRange(event.start_time, event.end_time),
    [event.start_time, event.end_time]
  );

  const dateDisplay = useMemo(() => {
    const start = new Date(event.start_time);
    if (event.all_day) {
      return start.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
    }
    return start.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  }, [event.start_time, event.all_day]);

  const meetLink = event.hangout_link || null;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await updateGoogleCalendarEvent(event.id, {
        summary: editSummary,
        description: editDescription,
        location: editLocation,
        start_time: new Date(editStartDate).toISOString(),
        end_time: new Date(editEndDate).toISOString(),
        all_day: event.all_day,
        timezone: event.timezone,
      });
      setIsEditing(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteGoogleCalendarEvent(event.id);
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
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <CalendarIcon className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {isEditing ? 'Edit Event' : 'Google Calendar Event'}
              </h3>
              <p className="text-xs text-teal-400">Synced from Google Calendar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
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
                <input
                  type="text"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">End</label>
                  <input
                    type="datetime-local"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="Add location..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  placeholder="Add description..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <h4 className="text-xl font-semibold text-white">
                  {event.summary || '(No title)'}
                </h4>
                {event.transparency === 'transparent' && (
                  <span className="inline-block mt-1 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                    Free
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white">{dateDisplay}</p>
                    {!event.all_day && (
                      <p className="text-sm text-slate-400">{timeDisplay}</p>
                    )}
                    {event.all_day && (
                      <p className="text-sm text-slate-400">All day</p>
                    )}
                  </div>
                </div>

                {event.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-white">{event.location}</p>
                  </div>
                )}

                {meetLink && (
                  <div className="flex items-start gap-3">
                    <Video className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <a
                      href={meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-teal-400 hover:text-teal-300 underline"
                    >
                      Join Google Meet
                    </a>
                  </div>
                )}

                {event.description && (
                  <div className="pt-2 border-t border-slate-800">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">
                      {event.description}
                    </p>
                  </div>
                )}

                {event.organizer_email && (
                  <div className="flex items-start gap-3 pt-2 border-t border-slate-800">
                    <Users className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Organizer</p>
                      <p className="text-sm text-white">
                        {event.organizer_display_name || event.organizer_email}
                      </p>
                    </div>
                  </div>
                )}

                {event.attendees && event.attendees.length > 0 && (
                  <div className="pt-2 border-t border-slate-800">
                    <p className="text-xs text-slate-500 mb-2">
                      Attendees ({event.attendees.length})
                    </p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {event.attendees.map((att, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                            <span className="text-xs text-slate-400">
                              {(att.displayName || att.email || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">
                              {att.displayName || att.email}
                            </p>
                            {att.responseStatus && att.responseStatus !== 'needsAction' && (
                              <p className={`text-xs ${
                                att.responseStatus === 'accepted' ? 'text-emerald-400' :
                                att.responseStatus === 'declined' ? 'text-red-400' :
                                'text-amber-400'
                              }`}>
                                {att.responseStatus}
                              </p>
                            )}
                          </div>
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
            <p className="text-sm text-red-300 mb-3">
              This will permanently delete the event from Google Calendar. Are you sure?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between p-4 border-t border-slate-800">
          <div className="flex items-center gap-2">
            {event.html_link && (
              <a
                href={event.html_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 hover:text-white transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Google
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </>
            ) : canEdit ? (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-red-400 text-sm hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
