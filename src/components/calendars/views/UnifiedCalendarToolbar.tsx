import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import type { CalendarViewType } from '../../../utils/calendarViewUtils';
import { addDays, addWeeks, addMonths } from '../../../utils/calendarViewUtils';

interface UnifiedCalendarToolbarProps {
  date: Date;
  viewType: CalendarViewType;
  onDateChange: (date: Date) => void;
  onViewTypeChange: (viewType: CalendarViewType) => void;
  onNewAppointment: () => void;
  onManageViewToggle: () => void;
  isManageViewOpen: boolean;
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
  onManageViewToggle,
  isManageViewOpen,
}: UnifiedCalendarToolbarProps) {
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const monthYearLabel = date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
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

        <button
          onClick={onNewAppointment}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white text-sm font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>
    </div>
  );
}
