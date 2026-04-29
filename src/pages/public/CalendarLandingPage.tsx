import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, AlertCircle } from 'lucide-react';

interface AppointmentTypeInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  location_type: string;
}

interface CalendarInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export function CalendarLandingPage() {
  const { calendarSlug } = useParams<{ calendarSlug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === '1';
  const tzParam = searchParams.get('tz');
  const embedQuery = isEmbed
    ? `?embed=1${tzParam ? `&tz=${encodeURIComponent(tzParam)}` : ''}`
    : '';
  const [calendarInfo, setCalendarInfo] = useState<CalendarInfo | null>(null);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentTypeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-api`;

  useEffect(() => {
    loadCalendarTypes();
  }, [calendarSlug]);

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
  }, [isEmbed, appointmentTypes, isLoading]);

  const loadCalendarTypes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiUrl}/calendar-types?calendar_slug=${calendarSlug}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setCalendarInfo(data.calendar);
      setAppointmentTypes(data.appointment_types || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking page');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !error && appointmentTypes.length > 0 && calendarSlug) {
      navigate(`/book/${calendarSlug}/${appointmentTypes[0].slug}${embedQuery}`, {
        replace: true,
      });
    }
  }, [isLoading, error, appointmentTypes, calendarSlug, embedQuery, navigate]);

  const outerClass = isEmbed
    ? 'bg-slate-950 p-4'
    : 'min-h-screen bg-slate-950 py-12 px-4';

  if (isLoading) {
    return (
      <div ref={rootRef} className={outerClass}>
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 animate-pulse mx-auto mb-4" />
            <div className="h-7 w-48 rounded bg-slate-800 animate-pulse mx-auto mb-2" />
            <div className="h-4 w-72 rounded bg-slate-800 animate-pulse mx-auto" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-slate-900 border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !calendarInfo) {
    return (
      <div ref={rootRef} className={isEmbed ? 'bg-slate-950 p-8' : 'min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4'}>
        <div className="flex flex-col items-center text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Booking Unavailable</h1>
          <p className="text-slate-400">{error || 'This booking page is not available'}</p>
        </div>
      </div>
    );
  }

  if (appointmentTypes.length === 0) {
    return (
      <div ref={rootRef} className={isEmbed ? 'bg-slate-950 p-8' : 'min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4'}>
        <div className="flex flex-col items-center text-center max-w-md">
          <Calendar className="w-12 h-12 text-slate-600 mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Booking Unavailable</h1>
          <p className="text-slate-400">
            This calendar isn't accepting bookings yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={outerClass}>
      <div className="max-w-md mx-auto flex items-center justify-center min-h-[200px]">
        <div className="text-center text-slate-500 text-sm">Loading booking…</div>
      </div>
    </div>
  );
}
