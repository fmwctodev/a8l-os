import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  AlertCircle,
  Video,
  Phone,
  MapPin,
  XCircle,
  Check,
  ArrowLeft,
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
  };
}

type Step = 'confirm' | 'done';

export default function CancelAppointmentPage() {
  const { token } = useParams<{ token: string }>();

  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('confirm');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadyCanceled, setAlreadyCanceled] = useState(false);

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-api`;

  useEffect(() => {
    loadAppointment();
  }, [token]);

  const loadAppointment = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const response = await fetch(
        `${apiUrl}/appointment?cancel_token=${encodeURIComponent(token)}`
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const appt = data.appointment as AppointmentInfo;
      setAppointment(appt);

      if (appt.status === 'canceled') {
        setAlreadyCanceled(true);
        setStep('done');
      } else if (new Date(appt.start_at_utc) < new Date()) {
        throw new Error(
          'This appointment has already passed and cannot be canceled.'
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'This cancel link is invalid or has expired.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!token) return;
    try {
      setIsSubmitting(true);
      const response = await fetch(`${apiUrl}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason: reason.trim() || undefined }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tz = appointment?.visitor_timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatTime = (isoString: string) =>
    new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
    });

  const formatDate = (isoString: string) =>
    new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: tz,
    });

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
          Cannot Cancel
        </h1>
        <p className="text-slate-400 text-center max-w-md">
          {error || 'This cancel link is invalid or has expired.'}
        </p>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
            <div
              className={`w-16 h-16 rounded-full ${
                alreadyCanceled ? 'bg-slate-800' : 'bg-green-500/20'
              } flex items-center justify-center mx-auto mb-6`}
            >
              {alreadyCanceled ? (
                <XCircle className="w-8 h-8 text-slate-400" />
              ) : (
                <Check className="w-8 h-8 text-green-400" />
              )}
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">
              {alreadyCanceled
                ? 'Already Canceled'
                : 'Appointment Canceled'}
            </h1>
            <p className="text-slate-400 mb-6">
              {alreadyCanceled
                ? `This ${appointment.appointment_type.name} was already canceled.`
                : `Your ${appointment.appointment_type.name} has been canceled.`}
            </p>

            <div className="bg-slate-800 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center gap-3 mb-3">
                <CalendarIcon className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-slate-300 font-medium">
                    {formatDate(appointment.start_at_utc)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatTime(appointment.start_at_utc)} -{' '}
                    {formatTime(appointment.end_at_utc)}
                  </p>
                </div>
              </div>
            </div>

            <Link
              to={`/book/${appointment.calendar.slug}`}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white hover:from-cyan-600 hover:to-teal-700 transition-colors"
            >
              Book a new time
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">
            Cancel appointment
          </p>
          <h1 className="text-2xl font-semibold text-white mb-1">
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

          <div className="bg-slate-800 rounded-lg p-4 my-6">
            <div className="flex items-center gap-3">
              <CalendarIcon className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-white font-medium">
                  {formatDate(appointment.start_at_utc)}
                </p>
                <p className="text-sm text-slate-400">
                  {formatTime(appointment.start_at_utc)} -{' '}
                  {formatTime(appointment.end_at_utc)}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Let us know why you're canceling..."
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Cancel appointment'
              )}
            </button>
            <Link
              to={`/book/${appointment.calendar.slug}`}
              className="w-full inline-flex items-center justify-center gap-1 px-4 py-2 text-slate-400 hover:text-white text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Keep my appointment
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
