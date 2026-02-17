import { Link } from 'react-router-dom';
import { Calendar, ChevronRight } from 'lucide-react';
import { Badge } from './Badge';
import type { UpcomingAppointment } from '../../services/dashboard';

interface AppointmentsListProps {
  appointments: UpcomingAppointment[];
  onViewAll?: () => void;
  isLoading?: boolean;
}

function formatAppointmentTime(dateString: string): { date: string; time: string } {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let dateStr = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  if (isToday) dateStr = 'Today';
  else if (isTomorrow) dateStr = 'Tomorrow';

  return { date: dateStr, time: timeStr };
}

const statusVariants = {
  scheduled: 'neutral',
  confirmed: 'success',
  in_progress: 'info',
} as const;

export function AppointmentsList({ appointments, isLoading }: AppointmentsListProps) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-white">Upcoming Appointments</h3>
        <Link
          to="/calendars"
          className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="p-3">
        {isLoading ? (
          <LoadingSkeleton />
        ) : appointments.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-1">
            {appointments.map((appointment) => {
              const { date, time } = formatAppointmentTime(appointment.start_at_utc);
              const contactName = appointment.contact
                ? `${appointment.contact.first_name} ${appointment.contact.last_name}`.trim()
                : 'Unknown';

              return (
                <Link
                  key={appointment.id}
                  to={`/calendars/${appointment.calendar_id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <Calendar className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {contactName || 'Unknown'}
                      </span>
                      <Badge
                        variant={
                          statusVariants[appointment.status as keyof typeof statusVariants] ||
                          'neutral'
                        }
                      >
                        {appointment.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">
                        {appointment.appointment_type?.name ?? ''}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-xs text-slate-500">{appointment.calendar?.name ?? ''}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{time}</p>
                    <p className="text-xs text-slate-500">{date}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-8 text-center">
      <Calendar className="h-10 w-10 text-slate-600 mx-auto mb-3" />
      <p className="text-sm text-slate-500 mb-3">No upcoming appointments</p>
      <Link
        to="/calendars"
        className="inline-flex items-center gap-1 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        View Calendars
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="h-10 w-10 bg-slate-700 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-slate-700 rounded" />
            <div className="h-3 w-1/2 bg-slate-700 rounded" />
          </div>
          <div className="space-y-2 text-right">
            <div className="h-4 w-12 bg-slate-700 rounded ml-auto" />
            <div className="h-3 w-16 bg-slate-700 rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
