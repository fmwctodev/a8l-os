import { useMemo } from 'react';
import { Clock, Video, MapPin, ExternalLink, Calendar as CalendarIcon } from 'lucide-react';
import type { GoogleCalendarEvent } from '../../../types';
import { formatTimeRange } from '../../../utils/calendarViewUtils';

interface GoogleEventBlockProps {
  event: GoogleCalendarEvent;
  onClick: () => void;
  compact?: boolean;
  style?: React.CSSProperties;
}

export function GoogleEventBlock({ event, onClick, compact = false, style }: GoogleEventBlockProps) {
  const isFree = event.transparency === 'transparent';

  const timeDisplay = useMemo(
    () => formatTimeRange(event.start_time, event.end_time),
    [event.start_time, event.end_time]
  );

  const hasVideoLink = !!(event.hangout_link || event.conference_data);

  if (compact) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={style}
        className={`w-full text-left px-2 py-1 rounded text-xs truncate border-l-2 hover:opacity-80 transition-opacity ${
          isFree
            ? 'bg-teal-500/10 border-l-teal-500/50 text-teal-400/70 border-dashed'
            : 'bg-teal-500/20 border-l-teal-500 text-teal-300'
        }`}
      >
        <span className="font-medium">{event.summary || '(No title)'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={style}
      className={`absolute left-1 right-1 px-2 py-1 rounded-md border-l-4 hover:opacity-90 transition-opacity overflow-hidden text-left ${
        isFree
          ? 'bg-teal-500/10 border-l-teal-500/50 border-dashed'
          : 'bg-teal-500/20 border-l-teal-500'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium truncate ${isFree ? 'text-teal-400/70' : 'text-teal-300'}`}>
            {event.summary || '(No title)'}
          </p>
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
          {!event.location && hasVideoLink && (
            <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
              <Video className="w-3 h-3 flex-shrink-0" />
              Google Meet
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-1">
          {event.html_link && (
            <ExternalLink className="w-3 h-3 text-teal-500/60" />
          )}
          <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center">
            <CalendarIcon className="w-3 h-3 text-teal-400" />
          </div>
        </div>
      </div>
    </button>
  );
}
