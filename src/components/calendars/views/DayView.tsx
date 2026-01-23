import { useEffect, useRef, useMemo } from 'react';
import type { Appointment } from '../../../types';
import {
  generateTimeSlots,
  getAppointmentPosition,
  getCurrentTimePosition,
  isSameDay,
} from '../../../utils/calendarViewUtils';
import { AppointmentBlock } from './AppointmentBlock';

interface DayViewProps {
  date: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  startHour?: number;
  endHour?: number;
}

export function DayView({
  date,
  appointments,
  onAppointmentClick,
  startHour = 6,
  endHour = 22,
}: DayViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeSlots = useMemo(() => generateTimeSlots(startHour, endHour), [startHour, endHour]);

  const isToday = useMemo(() => isSameDay(date, new Date()), [date]);
  const currentTimePosition = useMemo(
    () => (isToday ? getCurrentTimePosition(startHour) : null),
    [isToday, startHour]
  );

  const dayAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.start_at_utc);
      return isSameDay(aptDate, date);
    });
  }, [appointments, date]);

  useEffect(() => {
    if (containerRef.current && isToday) {
      const scrollTarget = Math.max(0, getCurrentTimePosition(startHour) - 100);
      containerRef.current.scrollTop = scrollTarget;
    }
  }, [isToday, startHour]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-slate-700 py-3 px-4">
        <div className={`text-center ${isToday ? 'text-cyan-400' : 'text-white'}`}>
          <p className="text-sm text-slate-400">
            {date.toLocaleDateString('en-US', { weekday: 'long' })}
          </p>
          <p className="text-2xl font-semibold">{date.getDate()}</p>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: `${(endHour - startHour + 1) * 64}px` }}>
          {timeSlots.map((slot, index) => (
            <div
              key={slot.hour}
              className="absolute left-0 right-0 border-t border-slate-800"
              style={{ top: `${index * 64}px`, height: '64px' }}
            >
              <span className="absolute left-2 -top-2.5 text-xs text-slate-500 bg-slate-900 px-1">
                {slot.label}
              </span>
            </div>
          ))}

          {isToday && currentTimePosition !== null && currentTimePosition >= 0 && (
            <div
              className="absolute left-0 right-0 z-10 pointer-events-none"
              style={{ top: `${currentTimePosition}px` }}
            >
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            </div>
          )}

          <div className="absolute left-16 right-2 top-0 bottom-0">
            {dayAppointments.map((appointment) => {
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
                    minHeight: '24px',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
