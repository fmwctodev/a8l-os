import { useMemo } from 'react';
import type { CalendarDisplayItem } from '../../../types';
import { getMonthGrid, formatDateString } from '../../../utils/calendarViewUtils';
import { AppointmentBlock } from './AppointmentBlock';
import { GoogleEventBlock } from './GoogleEventBlock';

interface MonthViewProps {
  date: Date;
  items: CalendarDisplayItem[];
  onItemClick: (item: CalendarDisplayItem) => void;
  onDayClick: (date: Date) => void;
}

const MAX_VISIBLE_ITEMS = 3;

export function MonthView({ date, items, onItemClick, onDayClick }: MonthViewProps) {
  const monthGrid = useMemo(() => getMonthGrid(date), [date]);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const itemsByDay = useMemo(() => {
    const grouped: Record<string, CalendarDisplayItem[]> = {};

    items.forEach((item) => {
      const itemDate = new Date(item.startTime);
      const dateKey = formatDateString(itemDate);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(item);
    });

    Object.keys(grouped).forEach((key) => {
      grouped[key].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });

    return grouped;
  }, [items]);

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
              const dayItems = itemsByDay[day.dateString] || [];
              const visibleItems = dayItems.slice(0, MAX_VISIBLE_ITEMS);
              const hiddenCount = dayItems.length - MAX_VISIBLE_ITEMS;

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
                    {dayItems.length > 0 && (
                      <span className="text-xs text-slate-500">{dayItems.length}</span>
                    )}
                  </div>

                  <div className="space-y-0.5 overflow-hidden">
                    {visibleItems.map((item) => (
                      <MonthItemBlock key={item.id} item={item} onItemClick={onItemClick} />
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

function MonthItemBlock({
  item,
  onItemClick,
}: {
  item: CalendarDisplayItem;
  onItemClick: (item: CalendarDisplayItem) => void;
}) {
  if (item.source === 'crm' && item.originalAppointment) {
    return (
      <AppointmentBlock
        appointment={item.originalAppointment}
        onClick={() => onItemClick(item)}
        compact
      />
    );
  }

  if (item.source === 'google' && item.originalGoogleEvent) {
    return (
      <GoogleEventBlock
        event={item.originalGoogleEvent}
        onClick={() => onItemClick(item)}
        compact
      />
    );
  }

  if (item.source === 'blocked') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
        className="w-full text-left px-2 py-1 rounded text-xs truncate bg-slate-500/20 text-slate-400 border-l-2 border-l-slate-500 hover:opacity-80 transition-opacity"
      >
        <span className="font-medium">{item.title}</span>
      </button>
    );
  }

  return null;
}
