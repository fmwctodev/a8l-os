import { useEffect, useRef, useMemo } from 'react';
import type { CalendarDisplayItem } from '../../../types';
import {
  generateTimeSlots,
  getAppointmentPosition,
  getCurrentTimePosition,
  isSameDay,
} from '../../../utils/calendarViewUtils';
import { AppointmentBlock } from './AppointmentBlock';
import { GoogleEventBlock } from './GoogleEventBlock';
import { EventBlock } from './EventBlock';
import { TaskBlock } from './TaskBlock';

interface DayViewProps {
  date: Date;
  items: CalendarDisplayItem[];
  onItemClick: (item: CalendarDisplayItem) => void;
  startHour?: number;
  endHour?: number;
}

export function DayView({
  date,
  items,
  onItemClick,
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

  const { allDayItems, timedItems } = useMemo(() => {
    const allDay: CalendarDisplayItem[] = [];
    const timed: CalendarDisplayItem[] = [];

    items.forEach((item) => {
      const itemDate = new Date(item.startTime);
      if (!isSameDay(itemDate, date)) return;
      if (item.allDay) {
        allDay.push(item);
      } else {
        timed.push(item);
      }
    });

    return { allDayItems: allDay, timedItems: timed };
  }, [items, date]);

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

      {allDayItems.length > 0 && (
        <div className="flex-shrink-0 border-b border-slate-700 px-4 py-2">
          <p className="text-xs text-slate-500 mb-1.5">All day</p>
          <div className="space-y-1">
            {allDayItems.map((item) => (
              <DayItemBlock key={item.id} item={item} onItemClick={onItemClick} compact />
            ))}
          </div>
        </div>
      )}

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
            {timedItems.map((item) => {
              const position = getAppointmentPosition(
                item.startTime,
                item.endTime,
                startHour
              );

              return (
                <DayItemBlock
                  key={item.id}
                  item={item}
                  onItemClick={onItemClick}
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

function DayItemBlock({
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

  if (item.source === 'event' && item.originalCalendarEvent) {
    return (
      <EventBlock
        event={item.originalCalendarEvent}
        onClick={() => onItemClick(item)}
        compact={compact}
        style={style}
      />
    );
  }

  if (item.source === 'task' && item.originalCalendarTask) {
    return (
      <TaskBlock
        task={item.originalCalendarTask}
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
