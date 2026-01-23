import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Loader2,
  Search,
  Clock,
  Calendar as CalendarIcon,
  User as UserIcon,
  AlertCircle,
} from 'lucide-react';
import type { Calendar, AppointmentType, Contact, AvailabilitySlot, User } from '../../../types';
import { getAppointmentTypes } from '../../../services/appointmentTypes';
import { getContacts } from '../../../services/contacts';
import { getAvailableSlots } from '../../../services/availability';
import { createAppointment } from '../../../services/appointments';
import { useAuth } from '../../../contexts/AuthContext';
import { addDays, formatDateString } from '../../../utils/calendarViewUtils';

interface NewAppointmentModalProps {
  calendar: Calendar;
  calendars?: Calendar[];
  preselectedDate?: Date;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewAppointmentModal({
  calendar: initialCalendar,
  calendars,
  preselectedDate,
  onClose,
  onSuccess,
}: NewAppointmentModalProps) {
  const [selectedCalendarId, setSelectedCalendarId] = useState(initialCalendar.id);
  const calendar = calendars?.find(c => c.id === selectedCalendarId) || initialCalendar;
  const { user: currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);

  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    formatDateString(preselectedDate || new Date())
  );
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [contactSearch, setContactSearch] = useState('');
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);

  const selectedType = useMemo(
    () => appointmentTypes.find((t) => t.id === selectedTypeId),
    [appointmentTypes, selectedTypeId]
  );

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId),
    [contacts, selectedContactId]
  );

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 20);
    const search = contactSearch.toLowerCase();
    return contacts
      .filter(
        (c) =>
          c.first_name.toLowerCase().includes(search) ||
          c.last_name.toLowerCase().includes(search) ||
          c.email?.toLowerCase().includes(search) ||
          c.phone?.includes(search)
      )
      .slice(0, 20);
  }, [contacts, contactSearch]);

  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return availableSlots.filter((slot) => slot.start.startsWith(selectedDate));
  }, [availableSlots, selectedDate]);

  const eligibleUsers = useMemo(() => {
    if (!selectedSlot) return [];
    if (calendar.type === 'user') {
      return calendar.owner ? [calendar.owner] : [];
    }
    return (
      calendar.members
        ?.filter((m) => selectedSlot.eligible_user_ids.includes(m.user_id))
        .map((m) => m.user)
        .filter(Boolean) || []
    );
  }, [selectedSlot, calendar]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (!currentUser?.organization_id) return;

      try {
        setIsLoading(true);
        const [types, contactsData] = await Promise.all([
          getAppointmentTypes(calendar.id),
          getContacts(currentUser.organization_id, {}),
        ]);

        const activeTypes = types.filter((t) => t.active);
        setAppointmentTypes(activeTypes);
        setContacts(contactsData);

        if (activeTypes.length > 0 && !selectedTypeId) {
          setSelectedTypeId(activeTypes[0].id);
        } else if (activeTypes.length > 0 && !activeTypes.some(t => t.id === selectedTypeId)) {
          setSelectedTypeId(activeTypes[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [calendar.id, currentUser?.organization_id, selectedTypeId]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedTypeId || !selectedDate) {
        setAvailableSlots([]);
        return;
      }

      try {
        const startDate = selectedDate;
        const endDate = formatDateString(addDays(new Date(selectedDate), 7));

        const slots = await getAvailableSlots({
          calendarId: calendar.id,
          appointmentTypeId: selectedTypeId,
          startDate,
          endDate,
          visitorTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });

        setAvailableSlots(slots);
        setSelectedSlot(null);
        setSelectedUserId('');
      } catch (err) {
        console.error('Failed to load slots:', err);
      }
    };

    loadSlots();
  }, [calendar.id, selectedTypeId, selectedDate]);

  useEffect(() => {
    if (eligibleUsers.length === 1 && eligibleUsers[0]) {
      setSelectedUserId(eligibleUsers[0].id);
    }
  }, [eligibleUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.organization_id || !selectedSlot || !selectedType) return;

    try {
      setIsSaving(true);
      setError(null);

      let assignedUserId = selectedUserId;
      if (!assignedUserId && selectedSlot.eligible_user_ids.length > 0) {
        assignedUserId = selectedSlot.eligible_user_ids[0];
      }

      const contactData = selectedContact
        ? {
            name: `${selectedContact.first_name} ${selectedContact.last_name}`,
            email: selectedContact.email || '',
            phone: selectedContact.phone || '',
          }
        : { name: 'Walk-in', email: '', phone: '' };

      await createAppointment(
        currentUser.organization_id,
        {
          calendar_id: calendar.id,
          appointment_type_id: selectedTypeId,
          contact_id: selectedContactId || null,
          assigned_user_id: assignedUserId || null,
          start_at_utc: selectedSlot.start,
          end_at_utc: selectedSlot.end,
          visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          answers: contactData,
          source: 'manual',
          notes: notes || null,
        },
        currentUser
      );

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create appointment');
    } finally {
      setIsSaving(false);
    }
  };

  const formatSlotTime = (slot: AvailabilitySlot) => {
    const start = new Date(slot.start);
    return start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-slate-900 rounded-xl border border-slate-700 p-8">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-slate-900 rounded-xl border border-slate-700 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">New Appointment</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {calendars && calendars.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Calendar
                </label>
                <select
                  value={selectedCalendarId}
                  onChange={(e) => {
                    setSelectedCalendarId(e.target.value);
                    setSelectedTypeId('');
                    setSelectedSlot(null);
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                >
                  {calendars.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Appointment Type
              </label>
              <select
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              >
                <option value="">Select type...</option>
                {appointmentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.duration_minutes} min)
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Contact (optional)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={selectedContact ? `${selectedContact.first_name} ${selectedContact.last_name}` : contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setSelectedContactId('');
                    setIsContactDropdownOpen(true);
                  }}
                  onFocus={() => setIsContactDropdownOpen(true)}
                  placeholder="Search contacts..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              {isContactDropdownOpen && filteredContacts.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => {
                        setSelectedContactId(contact.id);
                        setContactSearch('');
                        setIsContactDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-700 transition-colors"
                    >
                      <p className="text-white text-sm">
                        {contact.first_name} {contact.last_name}
                      </p>
                      {contact.email && (
                        <p className="text-xs text-slate-400">{contact.email}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {selectedContact && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContactId('');
                    setContactSearch('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 mt-3 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <CalendarIcon className="w-4 h-4 inline mr-1" />
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={formatDateString(new Date())}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>

            {selectedTypeId && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Available Times
                </label>
                {slotsForSelectedDate.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">
                    No available times for this date. Try another date.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                    {slotsForSelectedDate.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setSelectedUserId('');
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedSlot?.start === slot.start
                            ? 'bg-cyan-500 text-white'
                            : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {formatSlotTime(slot)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedSlot && calendar.type === 'team' && eligibleUsers.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <UserIcon className="w-4 h-4 inline mr-1" />
                  Assign To
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                >
                  <option value="">Select team member...</option>
                  {eligibleUsers.map((user) =>
                    user ? (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ) : null
                  )}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes about this appointment..."
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              />
            </div>
          </div>

          <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex items-center justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !selectedSlot || !selectedTypeId}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Appointment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
