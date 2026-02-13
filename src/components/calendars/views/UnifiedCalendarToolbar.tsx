import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  ChevronDown,
  RefreshCw,
  Loader2,
  CalendarDays,
  CheckSquare,
  Calendar,
} from 'lucide-react';
import type { CalendarViewType } from '../../../utils/calendarViewUtils';
import { addDays, addWeeks, addMonths } from '../../../utils/calendarViewUtils';

interface UnifiedCalendarToolbarProps {
  date: Date;
  viewType: CalendarViewType;
  onDateChange: (date: Date) => void;
  onViewTypeChange: (viewType: CalendarViewType) => void;
  onNewAppointment: () => void;
  onNewEvent?: () => void;
  onNewTask?: () => void;
  onManageViewToggle: () => void;
  isManageViewOpen: boolean;
  hasGoogleConnection?: boolean;
  isSyncing?: boolean;
  onSyncGoogle?: () => void;
}

const VIEW_TYPE_LABELS: Record<CalendarViewType, string> = {
  day: 'Day View',
  week: 'Week View',
  month: 'Month View',
};

export function UnifiedCalendarToolbar({
  date,
  viewType,
  onDateChange,
  onViewTypeChange,
  onNewAppointment,
  onNewEvent,
  onNewTask,
  onManageViewToggle,
  isManageViewOpen,
  hasGoogleConnection = false,
  isSyncing = false,
  onSyncGoogle,
}: UnifiedCalendarToolbarProps) {
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const newDropdownRef = useRef<HTMLDivElement>(null);

  const monthYearLabel = date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
      if (newDropdownRef.current && !newDropdownRef.current.contains(event.target as Node)) {
        setIsNewDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigatePrevious = () => {
    switch (viewType) {
      case 'day':
        onDateChange(addDays(date, -1));
        break;
      case 'week':
        onDateChange(addWeeks(date, -1));
        break;
      case 'month':
        onDateChange(addMonths(date, -1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewType) {
      case 'day':
        onDateChange(addDays(date, 1));
        break;
      case 'week':
        onDateChange(addWeeks(date, 1));
        break;
      case 'month':
        onDateChange(addMonths(date, 1));
        break;
    }
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const handleViewTypeSelect = (type: CalendarViewType) => {
    onViewTypeChange(type);
    setIsViewDropdownOpen(false);
  };

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <button
          onClick={goToToday}
          className="px-4 py-1.5 text-sm font-medium text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
        >
          Today
        </button>

        <div className="flex items-center">
          <button
            onClick={navigatePrevious}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5 text-slate-400" />
          </button>

          <span className="min-w-[180px] text-center text-lg font-medium text-white">
            {monthYearLabel}
          </span>

          <button
            onClick={navigateNext}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
          >
            {VIEW_TYPE_LABELS[viewType]}
            <ChevronDown className="w-4 h-4" />
          </button>

          {isViewDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20">
              {(['day', 'week', 'month'] as CalendarViewType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleViewTypeSelect(type)}
                  className={`w-full px-3 py-2 text-sm text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    viewType === type
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {VIEW_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {hasGoogleConnection && onSyncGoogle && (
          <button
            onClick={onSyncGoogle}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
        )}

        <button
          onClick={onManageViewToggle}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            isManageViewOpen
              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
              : 'text-slate-300 border-slate-600 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Manage View
        </button>

        <div className="relative" ref={newDropdownRef}>
          <button
            onClick={() => setIsNewDropdownOpen(!isNewDropdownOpen)}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white text-sm font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {isNewDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
              <button
                onClick={() => { setIsNewDropdownOpen(false); onNewAppointment(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Calendar className="w-4 h-4 text-cyan-400" />
                Appointment
              </button>
              {onNewEvent && (
                <button
                  onClick={() => { setIsNewDropdownOpen(false); onNewEvent(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <CalendarDays className="w-4 h-4 text-blue-400" />
                  Event
                </button>
              )}
              {onNewTask && (
                <button
                  onClick={() => { setIsNewDropdownOpen(false); onNewTask(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  Task
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
