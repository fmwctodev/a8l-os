import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Clock,
  Calendar as CalendarIcon,
  User as UserIcon,
  Video,
  Phone,
  MapPin,
  Link as LinkIcon,
  Mail,
  FileText,
  Check,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import type { Appointment, AppointmentStatus } from '../../../types';
import { formatTimeRange, getStatusColor } from '../../../utils/calendarViewUtils';

interface AppointmentDetailsModalProps {
  appointment: Appointment;
  onClose: () => void;
  onStatusChange: (status: AppointmentStatus) => Promise<void>;
  onEdit: () => void;
  canEdit: boolean;
}

export function AppointmentDetailsModal({
  appointment,
  onClose,
  onStatusChange,
  onEdit,
  canEdit,
}: AppointmentDetailsModalProps) {
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);

  const contactName = useMemo(() => {
    if (appointment.contact) {
      return `${appointment.contact.first_name} ${appointment.contact.last_name}`;
    }
    return appointment.answers?.name || 'Guest';
  }, [appointment.contact, appointment.answers]);

  const timeDisplay = useMemo(
    () => formatTimeRange(appointment.start_at_utc, appointment.end_at_utc),
    [appointment.start_at_utc, appointment.end_at_utc]
  );

  const dateDisplay = useMemo(() => {
    return new Date(appointment.start_at_utc).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [appointment.start_at_utc]);

  const statusColors = useMemo(() => getStatusColor(appointment.status), [appointment.status]);

  const getLocationIcon = () => {
    switch (appointment.appointment_type?.location_type) {
      case 'google_meet':
      case 'zoom':
        return <Video className="w-4 h-4" />;
      case 'phone':
        return <Phone className="w-4 h-4" />;
      case 'in_person':
        return <MapPin className="w-4 h-4" />;
      default:
        return <LinkIcon className="w-4 h-4" />;
    }
  };

  const getLocationLabel = () => {
    const type = appointment.appointment_type;
    if (!type) return 'Unknown';

    switch (type.location_type) {
      case 'google_meet':
        return 'Google Meet';
      case 'zoom':
        return 'Zoom';
      case 'phone':
        return type.location_value?.phone_number || 'Phone Call';
      case 'in_person':
        return type.location_value?.address || 'In Person';
      default:
        return type.location_value?.custom_link || 'Custom';
    }
  };

  const handleStatusChange = async (newStatus: AppointmentStatus) => {
    setIsUpdating(true);
    try {
      await onStatusChange(newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const statusLabel = {
    scheduled: 'Scheduled',
    completed: 'Completed',
    canceled: 'Canceled',
    no_show: 'No Show',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-slate-900 rounded-xl border border-slate-700 w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors.bg} ${statusColors.text}`}
            >
              {statusLabel[appointment.status]}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && appointment.status === 'scheduled' && (
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-sm font-medium"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white text-lg font-semibold flex-shrink-0">
              {contactName[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-white truncate">{contactName}</h2>
              {appointment.contact?.email && (
                <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                  <Mail className="w-4 h-4" />
                  {appointment.contact.email}
                </p>
              )}
              {appointment.contact && (
                <button
                  onClick={() => navigate(`/contacts/${appointment.contact!.id}`)}
                  className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Contact
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <CalendarIcon className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-white font-medium">{dateDisplay}</p>
                <p className="text-sm text-slate-400">{timeDisplay}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-white">
                  {appointment.appointment_type?.name || 'Appointment'}
                </p>
                <p className="text-sm text-slate-400">
                  {appointment.appointment_type?.duration_minutes || 30} minutes
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              {getLocationIcon()}
              <div>
                <p className="text-white">{getLocationLabel()}</p>
                {appointment.google_meet_link && (
                  <a
                    href={appointment.google_meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Join Meeting
                  </a>
                )}
              </div>
            </div>

            {appointment.assigned_user && (
              <div className="flex items-start gap-3">
                <UserIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-white">{appointment.assigned_user.name}</p>
                  <p className="text-sm text-slate-400">Assigned</p>
                </div>
              </div>
            )}

            {appointment.notes && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-400 mb-1">Notes</p>
                  <p className="text-white text-sm">{appointment.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {canEdit && appointment.status === 'scheduled' && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl">
            <p className="text-xs text-slate-400 mb-3">Update Status</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusChange('completed')}
                disabled={isUpdating}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Complete
              </button>
              <button
                onClick={() => handleStatusChange('no_show')}
                disabled={isUpdating}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
              >
                <AlertTriangle className="w-4 h-4" />
                No Show
              </button>
              <button
                onClick={() => handleStatusChange('canceled')}
                disabled={isUpdating}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
