import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Video,
  Phone,
  MapPin,
  Check,
  ArrowLeft,
  Download,
} from 'lucide-react';

interface AppointmentInfo {
  id: string;
  status: string;
  start_at_utc: string;
  end_at_utc: string;
  visitor_timezone: string;
  google_meet_link: string | null;
  calendar: { id: string; name: string; slug: string };
  appointment_type: {
    id: string;
    name: string;
    duration_minutes: number;
    location_type: string;
    location_value: string | null;
  };
}

interface AvailabilitySlot {
  start: string;
  end: string;
  eligible_user_ids: string[];
}

type Step = 'select' | 'confirm' | 'success';

export default function RescheduleAppointmentPage() {
  const { token } = useParams<{ token: string }>();

  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visitorTimezone, setVisitorTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-api`;

  useEffect(() => {
    loadAppointment();
  }, [token]);

  useEffect(() => {
    if (appointment && step === 'select') {
      loadAvailability();
    }
  }, [appointment, currentMonth, visitorTimezone, step]);

  const loadAppointment = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const response = await fetch(
        `${apiUrl}/appointment?reschedule_token=${encodeURIComponent(token)}`
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const appt = data.appointment as AppointmentInfo;

      if (appt.status !== 'scheduled') {
        throw new Error(
          appt.status === 'canceled'
            ? 'This appointment has already been canceled.'
            : 'This appointment can no longer be rescheduled.'
        );
      }
      if (new Date(appt.start_at_utc) < new Date()) {
        throw new Error('This appointment has already passed.');
      }

      setAppointment(appt);
      setVisitorTimezone(
        appt.visitor_timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      setCurrentMonth(new Date());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'This reschedule link is invalid or has expired.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailability = async () => {
    if (!appointment) return;
    const startDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    );
    const endDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    );
    try {
      const response = await fetch(
        `${apiUrl}/availability?calendar_id=${appointment.calendar.id}&type_id=${appointment.appointment_type.id}&start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&timezone=${visitorTimezone}`
      );
      const data = await response.json();
      setSlots(data.slots || []);
    } catch (err) {
      console.error('Failed to load availability:', err);
    }
  };

  const handleSubmit = async () => {
    if (!appointment || !selectedSlot || !token) return;
    try {
      setIsSubmitting(true);
      const response = await fetch(`${apiUrl}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_start_utc: selectedSlot.start,
          new_end_utc: selectedSlot.end,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setAppointment({
        ...appointment,
        start_at_utc: data.appointment.start_at_utc,
        end_at_utc: data.appointment.end_at_utc,
      });
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSlotsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return slots.filter((s) => s.start.startsWith(dateStr));
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  };

  const isDateAvailable = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return slots.some((s) => s.start.startsWith(dateStr));
  };

  const getLocationIcon = () => {
    switch (appointment?.appointment_type.location_type) {
      case 'google_meet':
      case 'zoom':
        return <Video className="w-4 h-4" />;
      case 'phone':
        return <Phone className="w-4 h-4" />;
      case 'in_person':
        return <MapPin className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const formatSlotTime = (isoString: string) =>
    new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: visitorTimezone,
    });

  const formatDate = (isoString: string) =>
    new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: visitorTimezone,
    });

  const generateICS = () => {
    if (!appointment) return;
    const formatICSDate = (dateStr: string) =>
      new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CRM//Booking//EN
BEGIN:VEVENT
UID:${appointment.id}@booking
DTSTAMP:${formatICSDate(new Date().toISOString())}
DTSTART:${formatICSDate(appointment.start_at_utc)}
DTEND:${formatICSDate(appointment.end_at_utc)}
SUMMARY:${appointment.appointment_type.name}
DESCRIPTION:${appointment.google_meet_link ? `Join: ${appointment.google_meet_link}` : ''}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'appointment.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">
          Cannot Reschedule
        </h1>
        <p className="text-slate-400 text-center max-w-md">
          {error || 'This reschedule link is invalid or has expired.'}
        </p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">
              Appointment Rescheduled
            </h1>
            <p className="text-slate-400 mb-6">
              Your {appointment.appointment_type.name} has been moved
            </p>

            <div className="bg-slate-800 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center gap-3 mb-3">
                <CalendarIcon className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-white font-medium">
                    {formatDate(appointment.start_at_utc)}
                  </p>
                  <p className="text-sm text-slate-400">
                    {formatSlotTime(appointment.start_at_utc)} -{' '}
                    {formatSlotTime(appointment.end_at_utc)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-cyan-400" />
                <p className="text-slate-300">
                  {appointment.appointment_type.duration_minutes} minutes
                </p>
              </div>
              {appointment.google_meet_link && (
                <div className="flex items-center gap-3 mt-3">
                  <Video className="w-5 h-5 text-cyan-400" />
                  <a
                    href={appointment.google_meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Join Google Meet
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={generateICS}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Add to Calendar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm' && selectedSlot) {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
            <button
              onClick={() => setStep('select')}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <h1 className="text-2xl font-semibold text-white mb-1">
              Confirm Reschedule
            </h1>
            <p className="text-slate-400 mb-6">
              {appointment.appointment_type.name}
            </p>

            <div className="space-y-3 mb-6">
              <div className="bg-slate-800/50 border border-slate-800 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  From
                </p>
                <p className="text-slate-300">
                  {formatDate(appointment.start_at_utc)}
                </p>
                <p className="text-sm text-slate-400">
                  {formatSlotTime(appointment.start_at_utc)} -{' '}
                  {formatSlotTime(appointment.end_at_utc)}
                </p>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                <p className="text-xs font-medium text-cyan-500 uppercase tracking-wider mb-1">
                  To
                </p>
                <p className="text-white">
                  {formatDate(selectedSlot.start)}
                </p>
                <p className="text-sm text-slate-300">
                  {formatSlotTime(selectedSlot.start)} -{' '}
                  {formatSlotTime(selectedSlot.end)}
                </p>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Confirm New Time'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <p className="text-xs font-medium text-cyan-400 uppercase tracking-wider mb-2">
              Reschedule
            </p>
            <h1 className="text-2xl font-semibold text-white">
              {appointment.appointment_type.name}
            </h1>
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {appointment.appointment_type.duration_minutes} min
              </span>
              <span className="flex items-center gap-1.5">
                {getLocationIcon()}
                {appointment.appointment_type.location_type}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Current time
              </p>
              <p className="text-slate-300">
                {formatDate(appointment.start_at_utc)} at{' '}
                {formatSlotTime(appointment.start_at_utc)}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">
                  {currentMonth.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentMonth(
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() - 1,
                          1
                        )
                      )
                    }
                    className="p-1 rounded hover:bg-slate-800 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-400" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentMonth(
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() + 1,
                          1
                        )
                      )
                    }
                    className="p-1 rounded hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div
                    key={day}
                    className="text-xs font-medium text-slate-500 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth(currentMonth).map((day, i) => {
                  if (!day) return <div key={i} />;
                  const isAvailable = isDateAvailable(day);
                  const isSelected =
                    selectedDate?.toDateString() === day.toDateString();
                  const isPast =
                    day < new Date(new Date().setHours(0, 0, 0, 0));

                  return (
                    <button
                      key={i}
                      onClick={() =>
                        isAvailable && !isPast && setSelectedDate(day)
                      }
                      disabled={!isAvailable || isPast}
                      className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-cyan-500 text-white'
                          : isAvailable && !isPast
                          ? 'hover:bg-slate-800 text-white'
                          : 'text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Timezone
                </label>
                <select
                  value={visitorTimezone}
                  onChange={(e) => setVisitorTimezone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value={visitorTimezone}>{visitorTimezone}</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>

            <div className="p-6">
              {selectedDate ? (
                <>
                  <h3 className="text-lg font-medium text-white mb-4">
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {getSlotsForDate(selectedDate).map((slot) => (
                      <button
                        key={slot.start}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setStep('confirm');
                        }}
                        className="w-full px-4 py-3 rounded-lg border bg-slate-800 border-slate-700 text-white hover:border-slate-600 text-left transition-colors"
                      >
                        {formatSlotTime(slot.start)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <CalendarIcon className="w-12 h-12 text-slate-600 mb-4" />
                  <p className="text-slate-400">
                    Select a date to see available times
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
