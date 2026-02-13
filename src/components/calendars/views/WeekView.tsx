import { useEffect, useRef, useMemo } from 'react';
import type { CalendarDisplayItem } from '../../../types';
import {
  generateTimeSlots,
  getWeekDays,
  getAppointmentPosition,
  getCurrentTimePosition,
  isSameDay,
  formatDateString,
} from '../../../utils/calendarViewUtils';
import { AppointmentBlock } from './AppointmentBlock';
import { GoogleEventBlock } from './GoogleEventBlock';

interface WeekViewProps {
  date: Date;
  items: CalendarDisplayItem[];
  onItemClick: (item: CalendarDisplayItem) => void;
  onDayClick: (date: Date) => void;
  startHour?: number;
  endHour?: number;
}

export function WeekView({
  date,
  items,
  onItemClick,
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

  const { allDayByDay, timedByDay } = useMemo(() => {
    const allDay: Record<string, CalendarDisplayItem[]> = {};
    const timed: Record<string, CalendarDisplayItem[]> = {};

    weekDays.forEach((day) => {
      allDay[day.dateString] = [];
      timed[day.dateString] = [];
    });

    items.forEach((item) => {
      const itemDate = new Date(item.startTime);
      const dateKey = formatDateString(itemDate);
      if (!allDay[dateKey] && !timed[dateKey]) return;

      if (item.allDay) {
        if (allDay[dateKey]) allDay[dateKey].push(item);
      } else {
        if (timed[dateKey]) timed[dateKey].push(item);
      }
    });

    return { allDayByDay: allDay, timedByDay: timed };
  }, [items, weekDays]);

  const hasAllDayEvents = useMemo(
    () => Object.values(allDayByDay).some((arr) => arr.length > 0),
    [allDayByDay]
  );

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

      {hasAllDayEvents && (
        <div className="flex-shrink-0 border-b border-slate-700">
          <div className="grid grid-cols-8">
            <div className="w-16 flex items-center justify-end pr-2">
              <span className="text-xs text-slate-500">All day</span>
            </div>
            {weekDays.map((day) => (
              <div
                key={`allday-${day.dateString}`}
                className={`border-l border-slate-700 p-1 space-y-0.5 min-h-[32px] ${
                  day.isToday ? 'bg-cyan-500/5' : ''
                }`}
              >
                {allDayByDay[day.dateString]?.map((item) => (
                  <WeekItemBlock key={item.id} item={item} onItemClick={onItemClick} compact />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

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
                  {timedByDay[day.dateString]?.map((item) => {
                    const position = getAppointmentPosition(
                      item.startTime,
                      item.endTime,
                      startHour
                    );

                    return (
                      <WeekItemBlock
                        key={item.id}
                        item={item}
                        onItemClick={onItemClick}
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

function WeekItemBlock({
  item,
  onItemClick,
  compact,
  style,
}: {
  item: CalendarDisplayItem;
  onItemClick: (item: CalendarDisplayItem) => void;
  compact?: boolean;
  style?: React.CSSProperties;
}) {
  if (item.source === 'crm' && item.originalAppointment) {
    return (
      <AppointmentBlock
        appointment={item.originalAppointment}
        onClick={() => onItemClick(item)}
        compact={compact}
        style={style}
      />
    );
  }

  if (item.source === 'google' && item.originalGoogleEvent) {
    return (
      <GoogleEventBlock
        event={item.originalGoogleEvent}
        onClick={() => onItemClick(item)}
        compact={compact}
        style={style}
      />
    );
  }

  if (item.source === 'blocked') {
    if (compact) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
          className="w-full text-left px-2 py-1 rounded text-xs truncate bg-slate-500/20 text-slate-400 border-l-2 border-l-slate-500 hover:opacity-80 transition-opacity"
        >
          <span className="font-medium">{item.title}</span>
        </button>
      );
    }

    return (
      <button
        onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
        style={style}
        className="absolute left-1 right-1 px-2 py-1 rounded-md border-l-4 border-l-slate-500 bg-slate-500/15 hover:opacity-90 transition-opacity overflow-hidden text-left"
      >
        <p className="text-sm font-medium text-slate-400 truncate">{item.title}</p>
        <p className="text-xs text-slate-500 truncate">Blocked</p>
      </button>
    );
  }

  return null;
}
