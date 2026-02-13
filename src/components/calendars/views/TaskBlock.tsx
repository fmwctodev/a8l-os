import { useMemo } from 'react';
import { Clock, CheckSquare, Check, Flag } from 'lucide-react';
import type { CalendarTask, TaskPriority } from '../../../types';

interface TaskBlockProps {
  task: CalendarTask;
  onClick: () => void;
  compact?: boolean;
  style?: React.CSSProperties;
}

const PRIORITY_ACCENT: Record<TaskPriority, string> = {
  low: 'border-l-slate-400',
  medium: 'border-l-amber-500',
  high: 'border-l-red-500',
};

export function TaskBlock({ task, onClick, compact = false, style }: TaskBlockProps) {
  const timeDisplay = useMemo(() => {
    const d = new Date(task.due_at_utc);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, [task.due_at_utc]);

  if (compact) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={style}
        className={`w-full text-left px-2 py-1 rounded text-xs truncate bg-amber-500/20 border-l-2 hover:opacity-80 transition-opacity ${
          task.completed ? 'text-slate-500 line-through border-l-emerald-500' : `text-amber-300 ${PRIORITY_ACCENT[task.priority]}`
        }`}
      >
        <span className="font-medium">{task.title}</span>
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={style}
      className={`absolute left-1 right-1 px-2 py-1 rounded-md border-l-4 hover:opacity-90 transition-opacity overflow-hidden text-left ${
        task.completed
          ? 'bg-emerald-500/10 border-l-emerald-500'
          : `bg-amber-500/15 ${PRIORITY_ACCENT[task.priority]}`
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium truncate ${task.completed ? 'text-slate-500 line-through' : 'text-amber-300'}`}>
            {task.title}
          </p>
          <p className="text-xs text-slate-400 truncate flex items-center gap-1">
            <Clock className="w-3 h-3 flex-shrink-0" />
            {timeDisplay} ({task.duration_minutes}m)
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1">
          {task.completed ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-3 h-3 text-emerald-400" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
              <CheckSquare className="w-3 h-3 text-amber-400" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
