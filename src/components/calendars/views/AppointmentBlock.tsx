import { useMemo } from 'react';
import { Clock, User as UserIcon, Video, Phone, MapPin, Link as LinkIcon } from 'lucide-react';
import type { Appointment } from '../../../types';
import { getStatusColor, formatTimeRange } from '../../../utils/calendarViewUtils';

interface AppointmentBlockProps {
  appointment: Appointment;
  onClick: () => void;
  compact?: boolean;
  style?: React.CSSProperties;
}

export function AppointmentBlock({ appointment, onClick, compact = false, style }: AppointmentBlockProps) {
  const colors = useMemo(() => getStatusColor(appointment.status), [appointment.status]);

  const contactName = useMemo(() => {
    if (appointment.contact) {
      return `${appointment.contact.first_name} ${appointment.contact.last_name}`;
    }
    return appointment.answers?.name || appointment.notes || 'Guest';
  }, [appointment.contact, appointment.answers, appointment.notes]);

  const timeDisplay = useMemo(
    () => formatTimeRange(appointment.start_at_utc, appointment.end_at_utc),
    [appointment.start_at_utc, appointment.end_at_utc]
  );

  const getLocationIcon = () => {
    switch (appointment.appointment_type?.location_type) {
      case 'google_meet':
      case 'zoom':
        return <Video className="w-3 h-3" />;
      case 'phone':
        return <Phone className="w-3 h-3" />;
      case 'in_person':
        return <MapPin className="w-3 h-3" />;
      default:
        return <LinkIcon className="w-3 h-3" />;
    }
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        style={style}
        className={`w-full text-left px-2 py-1 rounded text-xs truncate ${colors.bg} ${colors.text} hover:opacity-80 transition-opacity border-l-2 ${colors.border}`}
      >
        <span className="font-medium">{contactName}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      style={style}
      className={`absolute left-1 right-1 px-2 py-1 rounded-md border-l-4 ${colors.bg} ${colors.border} hover:opacity-90 transition-opacity overflow-hidden text-left`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium truncate ${colors.text}`}>{contactName}</p>
          <p className="text-xs text-slate-400 truncate flex items-center gap-1">
            <Clock className="w-3 h-3 flex-shrink-0" />
            {timeDisplay}
          </p>
          {appointment.appointment_type && (
            <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
              {getLocationIcon()}
              {appointment.appointment_type.name}
            </p>
          )}
        </div>
        {appointment.assigned_user && (
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
            {appointment.assigned_user.avatar_url ? (
              <img
                src={appointment.assigned_user.avatar_url}
                alt={appointment.assigned_user.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-xs text-white font-medium">
                {appointment.assigned_user.name?.[0] || <UserIcon className="w-3 h-3" />}
              </span>
            )}
          </div>
        )}
      </div>
      {appointment.notes && appointment.contact && (
        <p className="text-xs text-slate-500 truncate mt-1 italic">{appointment.notes}</p>
      )}
    </button>
  );
}
