import { useMemo } from 'react';
import { Clock, MapPin, Video, CalendarDays } from 'lucide-react';
import type { CalendarEvent } from '../../../types';
import { formatTimeRange } from '../../../utils/calendarViewUtils';

interface EventBlockProps {
  event: CalendarEvent;
  onClick: () => void;
  compact?: boolean;
  style?: React.CSSProperties;
}

export function EventBlock({ event, onClick, compact = false, style }: EventBlockProps) {
  const timeDisplay = useMemo(
    () => formatTimeRange(event.start_at_utc, event.end_at_utc),
    [event.start_at_utc, event.end_at_utc]
  );

  if (compact) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={style}
        className="w-full text-left px-2 py-1 rounded text-xs truncate bg-blue-500/20 text-blue-300 border-l-2 border-l-blue-500 hover:opacity-80 transition-opacity"
      >
        <span className="font-medium">{event.title}</span>
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={style}
      className="absolute left-1 right-1 px-2 py-1 rounded-md border-l-4 border-l-blue-500 bg-blue-500/20 hover:opacity-90 transition-opacity overflow-hidden text-left"
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-blue-300 truncate">{event.title}</p>
          {!event.all_day && (
            <p className="text-xs text-slate-400 truncate flex items-center gap-1">
              <Clock className="w-3 h-3 flex-shrink-0" />
              {timeDisplay}
            </p>
          )}
          {event.location && (
            <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {event.location}
            </p>
          )}
          {!event.location && event.google_meet_link && (
            <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
              <Video className="w-3 h-3 flex-shrink-0" />
              Google Meet
            </p>
          )}
        </div>
        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
          <CalendarDays className="w-3 h-3 text-blue-400" />
        </div>
      </div>
    </button>
  );
}
