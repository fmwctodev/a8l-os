import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Drawer } from '../layouts/Drawer';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../services/activityLog';

interface BookAppointmentDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface Calendar {
  id: string;
  name: string;
}

interface AppointmentType {
  id: string;
  name: string;
  duration_minutes: number;
  color: string;
}

interface User {
  id: string;
  name: string;
}

export function BookAppointmentDrawer({ open, onClose, onSuccess }: BookAppointmentDrawerProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user?.organization_id) {
      fetchCalendars();
      fetchUsers();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow.toISOString().split('T')[0]);
      setSelectedTime('09:00');
    }
  }, [open, user?.organization_id]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setContacts([]);
      setSelectedContact(null);
      setSelectedCalendar('');
      setSelectedType('');
      setSelectedDate('');
      setSelectedTime('');
      setAssignedTo('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (selectedCalendar) {
      fetchAppointmentTypes(selectedCalendar);
    }
  }, [selectedCalendar]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 && user?.organization_id) {
        searchContacts();
      } else {
        setContacts([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.organization_id]);

  async function fetchCalendars() {
    const { data } = await supabase
      .from('calendars')
      .select('id, name')
      .eq('organization_id', user?.organization_id)
      .eq('is_active', true)
      .order('name');

    if (data) {
      setCalendars(data);
      if (data.length > 0) {
        setSelectedCalendar(data[0].id);
      }
    }
  }

  async function fetchAppointmentTypes(calendarId: string) {
    const { data } = await supabase
      .from('appointment_types')
      .select('id, name, duration_minutes, color')
      .eq('calendar_id', calendarId)
      .eq('is_active', true)
      .order('name');

    if (data) {
      setAppointmentTypes(data);
      if (data.length > 0) {
        setSelectedType(data[0].id);
      }
    }
  }

  async function fetchUsers() {
    const { data } = await supabase
      .from('users')
      .select('id, name')
      .eq('organization_id', user?.organization_id)
      .eq('status', 'active')
      .order('name');

    if (data) {
      setUsers(data);
      if (user) {
        setAssignedTo(user.id);
      }
    }
  }

  async function searchContacts() {
    setSearching(true);
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('organization_id', user?.organization_id)
      .eq('status', 'active')
      .or(
        `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
      )
      .limit(10);

    setContacts(data || []);
    setSearching(false);
  }

  async function handleSubmit() {
    if (
      !user ||
      !user.organization_id ||
      !selectedContact ||
      !selectedCalendar ||
      !selectedType ||
      !selectedDate ||
      !selectedTime
    )
      return;

    setLoading(true);
    setError(null);

    try {
      const appointmentType = appointmentTypes.find((t) => t.id === selectedType);
      const durationMinutes = appointmentType?.duration_minutes || 30;

      const startDateTime = new Date(`${selectedDate}T${selectedTime}`);
      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          organization_id: user.organization_id,
          calendar_id: selectedCalendar,
          appointment_type_id: selectedType,
          contact_id: selectedContact.id,
          assigned_to: assignedTo || user.id,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'scheduled',
          notes,
          created_by_id: user.id,
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      await logActivity({
        organizationId: user.organization_id,
        userId: user.id,
        eventType: 'appointment_booked',
        entityType: 'appointment',
        entityId: appointment.id,
        contactId: selectedContact.id,
        summary: `Booked appointment with ${selectedContact.first_name} ${selectedContact.last_name}`.trim(),
        payload: {
          calendar_id: selectedCalendar,
          appointment_type_id: selectedType,
          start_time: startDateTime.toISOString(),
        },
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  }

  const timeSlots = [];
  for (let hour = 8; hour <= 18; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const label = new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
      timeSlots.push({ value: time, label });
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Book Appointment"
      subtitle="Schedule a new appointment"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              loading ||
              !selectedContact ||
              !selectedCalendar ||
              !selectedType ||
              !selectedDate ||
              !selectedTime
            }
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Booking...' : 'Book Appointment'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Contact <span className="text-red-400">*</span>
          </label>
          {selectedContact ? (
            <div className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">
                  {selectedContact.first_name} {selectedContact.last_name}
                </p>
                <p className="text-xs text-slate-400">{selectedContact.email || 'No email'}</p>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
              {(contacts.length > 0 || searching) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="p-3 text-sm text-slate-400">Searching...</div>
                  ) : (
                    contacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => {
                          setSelectedContact(contact);
                          setSearchQuery('');
                          setContacts([]);
                        }}
                        className="w-full p-3 text-left hover:bg-slate-700 transition-colors"
                      >
                        <p className="text-sm font-medium text-white">
                          {contact.first_name} {contact.last_name}
                        </p>
                        <p className="text-xs text-slate-400">{contact.email || 'No email'}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Calendar <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedCalendar}
            onChange={(e) => setSelectedCalendar(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            {calendars.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Appointment Type <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            {appointmentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} ({type.duration_minutes} min)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Time <span className="text-red-400">*</span>
            </label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            >
              {timeSlots.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Assigned To</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add any notes for this appointment..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
          />
        </div>
      </div>
    </Drawer>
  );
}
