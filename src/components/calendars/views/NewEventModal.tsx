import { useState } from 'react';
import {
  X, Loader2, CalendarDays, MapPin, Video, Users, Plus, Trash2,
} from 'lucide-react';
import type { Calendar } from '../../../types';
import { createCalendarEvent } from '../../../services/calendarEvents';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateString } from '../../../utils/calendarViewUtils';

interface NewEventModalProps {
  calendar: Calendar;
  calendars?: Calendar[];
  preselectedDate?: Date;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewEventModal({
  calendar: initialCalendar,
  calendars,
  preselectedDate,
  onClose,
  onSuccess,
}: NewEventModalProps) {
  const { user: currentUser } = useAuth();
  const [selectedCalendarId, setSelectedCalendarId] = useState(initialCalendar.id);
  const calendar = calendars?.find(c => c.id === selectedCalendarId) || initialCalendar;
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultDate = formatDateString(preselectedDate || new Date());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState(defaultDate);
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [generateMeet, setGenerateMeet] = useState(false);
  const [attendees, setAttendees] = useState<{ email: string; name: string }[]>([]);
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('');

  const addAttendee = () => {
    if (!newAttendeeEmail.trim() || !newAttendeeEmail.includes('@')) return;
    if (attendees.some(a => a.email === newAttendeeEmail.trim())) return;
    setAttendees(prev => [...prev, { email: newAttendeeEmail.trim(), name: '' }]);
    setNewAttendeeEmail('');
  };

  const removeAttendee = (email: string) => {
    setAttendees(prev => prev.filter(a => a.email !== email));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!currentUser) return;

    setIsSaving(true);
    setError(null);

    try {
      const startUtc = allDay
        ? `${startDate}T00:00:00.000Z`
        : new Date(`${startDate}T${startTime}`).toISOString();
      const endUtc = allDay
        ? `${endDate}T23:59:59.999Z`
        : new Date(`${endDate}T${endTime}`).toISOString();

      await createCalendarEvent(
        calendar.org_id,
        {
          calendar_id: calendar.id,
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          start_at_utc: startUtc,
          end_at_utc: endUtc,
          all_day: allDay,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          attendees,
          generate_meet: generateMeet,
        },
        currentUser
      );

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setIsSaving(false);
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
            <h3 className="text-lg font-semibold text-white">New Event</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Meeting name..."
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {calendars && calendars.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Calendar</label>
              <select
                value={selectedCalendarId}
                onChange={e => setSelectedCalendarId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {calendars.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={e => setAllDay(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-300">All day</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {!allDay && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {!allDay && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Add location..."
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={generateMeet}
                onChange={e => setGenerateMeet(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
              />
              <Video className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm text-slate-300">Add Google Meet</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Add description..."
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              <Users className="w-3.5 h-3.5 inline mr-1" />
              Attendees
            </label>
            {attendees.length > 0 && (
              <div className="space-y-1 mb-2">
                {attendees.map(att => (
                  <div key={att.email} className="flex items-center justify-between px-2 py-1 rounded bg-slate-800">
                    <span className="text-sm text-slate-300">{att.email}</span>
                    <button onClick={() => removeAttendee(att.email)} className="p-0.5 hover:text-red-400 text-slate-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="email"
                value={newAttendeeEmail}
                onChange={e => setNewAttendeeEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAttendee())}
                placeholder="email@example.com"
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addAttendee}
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !title.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Event
          </button>
        </div>
      </div>
    </div>
  );
}
