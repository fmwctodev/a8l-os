import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Clock, Video, Phone, MapPin, AlertCircle, ChevronRight } from 'lucide-react';

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

  const getLocationIcon = (locationType: string) => {
    switch (locationType) {
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

  const getLocationText = (locationType: string) => {
    switch (locationType) {
      case 'google_meet':
        return 'Google Meet';
      case 'zoom':
        return 'Zoom';
      case 'phone':
        return 'Phone call';
      case 'in_person':
        return 'In-person';
      default:
        return '';
    }
  };

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
        <div className="flex flex-col items-center text-center">
          <Calendar className="w-12 h-12 text-slate-600 mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">No Appointment Types</h1>
          <p className="text-slate-400">There are no bookable appointment types available.</p>
        </div>
      </div>
    );
  }

  if (appointmentTypes.length === 1) {
    navigate(`/book/${calendarSlug}/${appointmentTypes[0].slug}${embedQuery}`, {
      replace: true,
    });
    return null;
  }

  return (
    <div ref={rootRef} className={outerClass}>
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-semibold text-white mb-2">{calendarInfo.name}</h1>
          {calendarInfo.description && (
            <p className="text-slate-400">{calendarInfo.description}</p>
          )}
        </div>

        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 text-center">
          Select an appointment type
        </p>

        <div className="space-y-3">
          {appointmentTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => navigate(`/book/${calendarSlug}/${type.slug}${embedQuery}`)}
              className="w-full bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-5 text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-lg group-hover:text-cyan-400 transition-colors">
                    {type.name}
                  </h3>
                  {type.description && (
                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">{type.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {type.duration_minutes} min
                    </span>
                    {type.location_type && (
                      <span className="flex items-center gap-1.5">
                        {getLocationIcon(type.location_type)}
                        {getLocationText(type.location_type)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors ml-4 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
