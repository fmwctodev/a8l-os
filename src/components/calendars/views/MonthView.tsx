import { useMemo } from 'react';
import type { Appointment } from '../../../types';
import { getMonthGrid, formatDateString, isSameDay } from '../../../utils/calendarViewUtils';
import { AppointmentBlock } from './AppointmentBlock';

interface MonthViewProps {
  date: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onDayClick: (date: Date) => void;
}

const MAX_VISIBLE_APPOINTMENTS = 3;

export function MonthView({ date, appointments, onAppointmentClick, onDayClick }: MonthViewProps) {
  const monthGrid = useMemo(() => getMonthGrid(date), [date]);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const appointmentsByDay = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};

    appointments.forEach((apt) => {
      const aptDate = new Date(apt.start_at_utc);
      const dateKey = formatDateString(aptDate);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(apt);
    });

    Object.keys(grouped).forEach((key) => {
      grouped[key].sort(
        (a, b) => new Date(a.start_at_utc).getTime() - new Date(b.start_at_utc).getTime()
      );
    });

    return grouped;
  }, [appointments]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 grid grid-cols-7 border-b border-slate-700">
        {dayNames.map((name) => (
          <div key={name} className="py-2 text-center text-xs font-medium text-slate-400">
            {name}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-rows-5 md:grid-rows-6 min-h-0">
        {monthGrid.slice(0, 6).map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-slate-800 min-h-0">
            {week.map((day) => {
              const dayAppointments = appointmentsByDay[day.dateString] || [];
              const visibleAppointments = dayAppointments.slice(0, MAX_VISIBLE_APPOINTMENTS);
              const hiddenCount = dayAppointments.length - MAX_VISIBLE_APPOINTMENTS;

              return (
                <button
                  key={day.dateString}
                  onClick={() => onDayClick(day.date)}
                  className={`relative p-1 border-r border-slate-800 text-left hover:bg-slate-800/50 transition-colors overflow-hidden ${
                    !day.isCurrentMonth ? 'bg-slate-900/50' : ''
                  } ${day.isToday ? 'bg-cyan-500/10' : ''}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 text-sm rounded-full ${
                        day.isToday
                          ? 'bg-cyan-500 text-white font-semibold'
                          : day.isCurrentMonth
                            ? 'text-white'
                            : 'text-slate-500'
                      }`}
                    >
                      {day.dayOfMonth}
                    </span>
                    {dayAppointments.length > 0 && (
                      <span className="text-xs text-slate-500">{dayAppointments.length}</span>
                    )}
                  </div>

                  <div className="space-y-0.5 overflow-hidden">
                    {visibleAppointments.map((appointment) => (
                      <AppointmentBlock
                        key={appointment.id}
                        appointment={appointment}
                        onClick={() => onAppointmentClick(appointment)}
                        compact
                      />
                    ))}
                    {hiddenCount > 0 && (
                      <p className="text-xs text-slate-500 pl-2">+{hiddenCount} more</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
