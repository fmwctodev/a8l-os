import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
  Download,
  ArrowLeft,
} from 'lucide-react';

interface CollectiveMember {
  name: string;
  initials: string;
}

interface CalendarInfo {
  id: string;
  name: string;
  slug: string;
  is_collective?: boolean;
  collective_members?: CollectiveMember[];
}

interface AppointmentTypeInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  location_type: string;
  questions: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
  }>;
  booking_window_days: number;
}

interface AvailabilitySlot {
  start: string;
  end: string;
  eligible_user_ids: string[];
}

interface BookingResult {
  id: string;
  start_at_utc: string;
  end_at_utc: string;
  reschedule_token: string;
  cancel_token: string;
  google_meet_link: string | null;
}

export function BookingPage() {
  const { calendarSlug, typeSlug } = useParams<{
    calendarSlug: string;
    typeSlug: string;
  }>();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === '1';
  const tzParam = searchParams.get('tz');

  const [calendarInfo, setCalendarInfo] = useState<CalendarInfo | null>(null);
  const [appointmentType, setAppointmentType] = useState<AppointmentTypeInfo | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [step, setStep] = useState<'date' | 'form' | 'confirmation'>('date');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  const [formData, setFormData] = useState<Record<string, string>>({
    name: '',
    email: '',
    phone: '',
  });
  const [visitorTimezone, setVisitorTimezone] = useState(
    tzParam || Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isEmbed) return;

    const postHeight = () => {
      const height = rootRef.current?.scrollHeight ?? document.body.scrollHeight;
      window.parent?.postMessage(
        { type: 'booking-widget:height', height },
        '*'
      );
    };

    postHeight();
    const observer = new ResizeObserver(() => postHeight());
    if (rootRef.current) observer.observe(rootRef.current);
    window.addEventListener('resize', postHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', postHeight);
    };
  }, [isEmbed, step, selectedDate, slots, bookingResult]);

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-api`;

  useEffect(() => {
    loadCalendarInfo();
  }, [calendarSlug, typeSlug]);

  useEffect(() => {
    if (calendarInfo && appointmentType) {
      loadAvailability();
    }
  }, [calendarInfo, appointmentType, currentMonth]);

  const loadCalendarInfo = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${apiUrl}/calendar?calendar_slug=${calendarSlug}&type_slug=${typeSlug}`
      );
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setCalendarInfo(data.calendar);
      setAppointmentType(data.appointment_type);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking page');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailability = async () => {
    if (!calendarInfo || !appointmentType) return;

    const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    try {
      const response = await fetch(
        `${apiUrl}/availability?calendar_id=${calendarInfo.id}&type_id=${appointmentType.id}&start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&timezone=${visitorTimezone}`
      );
      const data = await response.json();
      setSlots(data.slots || []);
    } catch (err) {
      console.error('Failed to load availability:', err);
    }
  };

  const handleSubmitBooking = async () => {
    if (!calendarInfo || !appointmentType || !selectedSlot) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`${apiUrl}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendar_id: calendarInfo.id,
          appointment_type_id: appointmentType.id,
          start_utc: selectedSlot.start,
          end_utc: selectedSlot.end,
          visitor_timezone: visitorTimezone,
          answers: formData,
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setBookingResult(data.appointment);
      setStep('confirmation');

      if (isEmbed) {
        window.parent?.postMessage(
          { type: 'booking-widget:booked', appointment: data.appointment },
          '*'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment');
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

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  };

  const isDateAvailable = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return slots.some((s) => s.start.startsWith(dateStr));
  };

  const getLocationIcon = () => {
    switch (appointmentType?.location_type) {
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

  const getLocationText = () => {
    switch (appointmentType?.location_type) {
      case 'google_meet':
        return 'Google Meet video call';
      case 'zoom':
        return 'Zoom video call';
      case 'phone':
        return 'Phone call';
      case 'in_person':
        return 'In-person meeting';
      default:
        return '';
    }
  };

  const formatSlotTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: visitorTimezone,
    });
  };

  const generateICS = () => {
    if (!bookingResult || !appointmentType) return;

    const formatICSDate = (dateStr: string) => {
      return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CRM//Booking//EN
BEGIN:VEVENT
UID:${bookingResult.id}@booking
DTSTAMP:${formatICSDate(new Date().toISOString())}
DTSTART:${formatICSDate(bookingResult.start_at_utc)}
DTEND:${formatICSDate(bookingResult.end_at_utc)}
SUMMARY:${appointmentType.name}
DESCRIPTION:${bookingResult.google_meet_link ? `Join: ${bookingResult.google_meet_link}` : ''}
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

  const outerClass = isEmbed
    ? 'bg-slate-950 p-4'
    : 'min-h-screen bg-slate-950 py-12 px-4';

  if (isLoading) {
    return (
      <div
        ref={rootRef}
        className={
          isEmbed
            ? 'bg-slate-950 flex items-center justify-center p-12'
            : 'min-h-screen bg-slate-950 flex items-center justify-center'
        }
      >
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error || !calendarInfo || !appointmentType) {
    return (
      <div
        ref={rootRef}
        className={
          isEmbed
            ? 'bg-slate-950 flex flex-col items-center justify-center p-8'
            : 'min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4'
        }
      >
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">Booking Unavailable</h1>
        <p className="text-slate-400">{error || 'This booking page is not available'}</p>
      </div>
    );
  }

  if (step === 'confirmation' && bookingResult) {
    return (
      <div ref={rootRef} className={outerClass}>
        <div className="max-w-md mx-auto">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">Booking Confirmed</h1>
            <p className="text-slate-400 mb-6">
              Your {appointmentType.name} has been scheduled
            </p>

            <div className="bg-slate-800 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center gap-3 mb-3">
                <CalendarIcon className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-white font-medium">
                    {new Date(bookingResult.start_at_utc).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-slate-400">
                    {formatSlotTime(bookingResult.start_at_utc)} -{' '}
                    {formatSlotTime(bookingResult.end_at_utc)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-cyan-400" />
                <p className="text-slate-300">{appointmentType.duration_minutes} minutes</p>
              </div>
              {bookingResult.google_meet_link && (
                <div className="flex items-center gap-3 mt-3">
                  <Video className="w-5 h-5 text-cyan-400" />
                  <a
                    href={bookingResult.google_meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Join Google Meet
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={generateICS}
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Add to Calendar
              </button>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`/appointments/reschedule/${bookingResult.reschedule_token}`}
                  target={isEmbed ? '_blank' : undefined}
                  rel={isEmbed ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm"
                >
                  Reschedule
                </a>
                <a
                  href={`/appointments/cancel/${bookingResult.cancel_token}`}
                  target={isEmbed ? '_blank' : undefined}
                  rel={isEmbed ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30 transition-colors text-sm"
                >
                  Cancel
                </a>
              </div>
              <p className="text-xs text-slate-500">
                A confirmation email has been sent to {formData.email}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={outerClass}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-2xl font-semibold text-white">{appointmentType.name}</h1>
            {appointmentType.description && (
              <p className="text-slate-400 mt-1">{appointmentType.description}</p>
            )}
            <div className="flex items-center gap-4 mt-4 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {appointmentType.duration_minutes} min
              </span>
              <span className="flex items-center gap-1.5">
                {getLocationIcon()}
                {getLocationText()}
              </span>
            </div>
            {calendarInfo.is_collective && calendarInfo.collective_members && calendarInfo.collective_members.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Meeting with</p>
                <div className="flex flex-wrap gap-3">
                  {calendarInfo.collective_members.map((member, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-xs font-bold text-white">
                        {member.initials}
                      </div>
                      <span className="text-sm text-slate-300">{member.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {step === 'date' && (
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
                          new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                        )
                      }
                      className="p-1 rounded hover:bg-slate-800 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-slate-400" />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentMonth(
                          new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
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
                    <div key={day} className="text-xs font-medium text-slate-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth(currentMonth).map((day, i) => {
                    if (!day) {
                      return <div key={i} />;
                    }

                    const isAvailable = isDateAvailable(day);
                    const isSelected =
                      selectedDate?.toDateString() === day.toDateString();
                    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

                    return (
                      <button
                        key={i}
                        onClick={() => isAvailable && !isPast && setSelectedDate(day)}
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
                    <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                      {Intl.DateTimeFormat().resolvedOptions().timeZone} (detected)
                    </option>
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
                            setStep('form');
                          }}
                          className={`w-full px-4 py-3 rounded-lg border text-left transition-colors ${
                            selectedSlot?.start === slot.start
                              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                              : 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
                          }`}
                        >
                          {formatSlotTime(slot.start)}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <CalendarIcon className="w-12 h-12 text-slate-600 mb-4" />
                    <p className="text-slate-400">Select a date to see available times</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'form' && selectedSlot && (
            <div className="p-6">
              <button
                onClick={() => setStep('date')}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-white mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="bg-slate-800 rounded-lg p-4 mb-6">
                <p className="text-white font-medium">
                  {selectedDate?.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-slate-400">
                  {formatSlotTime(selectedSlot.start)} - {formatSlotTime(selectedSlot.end)}
                </p>
              </div>

              <div className="space-y-4">
                {appointmentType.questions.map((q) => (
                  <div key={q.id}>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      {q.label} {q.required && '*'}
                    </label>
                    {q.type === 'textarea' ? (
                      <textarea
                        value={formData[q.id] || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, [q.id]: e.target.value })
                        }
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                      />
                    ) : q.type === 'select' ? (
                      <select
                        value={formData[q.id] || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, [q.id]: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">Select...</option>
                        {q.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : q.type === 'checkbox' ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData[q.id] === 'true'}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [q.id]: e.target.checked ? 'true' : 'false',
                            })
                          }
                          className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className="text-slate-300">{q.label}</span>
                      </label>
                    ) : (
                      <input
                        type={q.id === 'email' ? 'email' : q.id === 'phone' ? 'tel' : 'text'}
                        value={formData[q.id] || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, [q.id]: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleSubmitBooking}
                disabled={
                  isSubmitting ||
                  !formData.name ||
                  !formData.email ||
                  appointmentType.questions.some((q) => q.required && !formData[q.id])
                }
                className="w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Confirm Booking'
                )}
              </button>
            </div>
          )}
        </div>

        {!isEmbed && (
          <p className="text-center text-slate-500 text-sm mt-6">
            Powered by Your CRM
          </p>
        )}
      </div>
    </div>
  );
}
