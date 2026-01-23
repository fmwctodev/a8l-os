import { useEffect, useRef, useMemo } from 'react';
import type { Appointment } from '../../../types';
import {
  generateTimeSlots,
  getWeekDays,
  getAppointmentPosition,
  getCurrentTimePosition,
  isSameDay,
  formatDateString,
} from '../../../utils/calendarViewUtils';
import { AppointmentBlock } from './AppointmentBlock';

interface WeekViewProps {
  date: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onDayClick: (date: Date) => void;
  startHour?: number;
  endHour?: number;
}

export function WeekView({
  date,
  appointments,
  onAppointmentClick,
  onDayClick,
  startHour = 6,
  endHour = 22,
}: WeekViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeSlots = useMemo(() => generateTimeSlots(startHour, endHour), [startHour, endHour]);
  const weekDays = useMemo(() => getWeekDays(date), [date]);

  const today = useMemo(() => new Date(), []);
  const isCurrentWeek = useMemo(
    () => weekDays.some((d) => isSameDay(d.date, today)),
    [weekDays, today]
  );
  const currentTimePosition = useMemo(
    () => (isCurrentWeek ? getCurrentTimePosition(startHour) : null),
    [isCurrentWeek, startHour]
  );

  const appointmentsByDay = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};
    weekDays.forEach((day) => {
      grouped[day.dateString] = [];
    });

    appointments.forEach((apt) => {
      const aptDate = new Date(apt.start_at_utc);
      const dateKey = formatDateString(aptDate);
      if (grouped[dateKey]) {
        grouped[dateKey].push(apt);
      }
    });

    return grouped;
  }, [appointments, weekDays]);

  useEffect(() => {
    if (containerRef.current && isCurrentWeek) {
      const scrollTarget = Math.max(0, getCurrentTimePosition(startHour) - 100);
      containerRef.current.scrollTop = scrollTarget;
    }
  }, [isCurrentWeek, startHour]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-slate-700">
        <div className="grid grid-cols-8">
          <div className="w-16" />
          {weekDays.map((day) => (
            <button
              key={day.dateString}
              onClick={() => onDayClick(day.date)}
              className={`py-3 text-center border-l border-slate-700 hover:bg-slate-800/50 transition-colors ${
                day.isToday ? 'bg-cyan-500/10' : ''
              }`}
            >
              <p className="text-xs text-slate-400">{day.dayName}</p>
              <p
                className={`text-lg font-semibold ${
                  day.isToday ? 'text-cyan-400' : 'text-white'
                }`}
              >
                {day.dayOfMonth}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: `${(endHour - startHour + 1) * 64}px` }}>
          <div className="grid grid-cols-8 h-full">
            <div className="w-16 relative">
              {timeSlots.map((slot, index) => (
                <div
                  key={slot.hour}
                  className="absolute right-0 left-0"
                  style={{ top: `${index * 64}px` }}
                >
                  <span className="absolute right-2 -top-2 text-xs text-slate-500">
                    {slot.label}
                  </span>
                </div>
              ))}
            </div>

            {weekDays.map((day) => (
              <div
                key={day.dateString}
                className={`relative border-l border-slate-700 ${
                  day.isToday ? 'bg-cyan-500/5' : ''
                }`}
              >
                {timeSlots.map((slot, index) => (
                  <div
                    key={slot.hour}
                    className="absolute left-0 right-0 border-t border-slate-800"
                    style={{ top: `${index * 64}px`, height: '64px' }}
                  />
                ))}

                <div className="absolute inset-0 px-0.5">
                  {appointmentsByDay[day.dateString]?.map((appointment) => {
                    const position = getAppointmentPosition(
                      appointment.start_at_utc,
                      appointment.end_at_utc,
                      startHour
                    );

                    return (
                      <AppointmentBlock
                        key={appointment.id}
                        appointment={appointment}
                        onClick={() => onAppointmentClick(appointment)}
                        style={{
                          top: `${position.top}px`,
                          height: `${position.height}px`,
                          minHeight: '20px',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {isCurrentWeek && currentTimePosition !== null && currentTimePosition >= 0 && (
            <div
              className="absolute left-16 right-0 z-10 pointer-events-none"
              style={{ top: `${currentTimePosition}px` }}
            >
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
