export type CalendarViewType = 'day' | 'week' | 'month';

export interface TimeSlot {
  hour: number;
  label: string;
}

export interface DayInfo {
  date: Date;
  dayOfMonth: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  dateString: string;
}

export interface WeekDay {
  date: Date;
  dayName: string;
  dayOfMonth: number;
  isToday: boolean;
  dateString: string;
}

export function getStartOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getEndOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const result = new Date(start);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function generateTimeSlots(startHour: number = 6, endHour: number = 22): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    const isPM = hour >= 12;
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    slots.push({
      hour,
      label: `${displayHour}${isPM ? 'PM' : 'AM'}`,
    });
  }
  return slots;
}

export function getWeekDays(date: Date): WeekDay[] {
  const startOfWeek = getStartOfWeek(date);
  const today = new Date();
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return Array.from({ length: 7 }, (_, i) => {
    const currentDate = addDays(startOfWeek, i);
    return {
      date: currentDate,
      dayName: dayNames[i],
      dayOfMonth: currentDate.getDate(),
      isToday: isSameDay(currentDate, today),
      dateString: formatDateString(currentDate),
    };
  });
}

export function getMonthGrid(date: Date): DayInfo[][] {
  const startOfMonth = getStartOfMonth(date);
  const endOfMonth = getEndOfMonth(date);
  const startOfGrid = getStartOfWeek(startOfMonth);
  const today = new Date();
  const weeks: DayInfo[][] = [];

  let currentDate = new Date(startOfGrid);
  const endOfGrid = getEndOfWeek(endOfMonth);

  while (currentDate <= endOfGrid) {
    const week: DayInfo[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        date: new Date(currentDate),
        dayOfMonth: currentDate.getDate(),
        isToday: isSameDay(currentDate, today),
        isCurrentMonth: currentDate.getMonth() === date.getMonth(),
        dateString: formatDateString(currentDate),
      });
      currentDate = addDays(currentDate, 1);
    }
    weeks.push(week);
  }

  return weeks;
}

export function getDateRangeLabel(date: Date, viewType: CalendarViewType): string {
  const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

  if (viewType === 'day') {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (viewType === 'week') {
    const startOfWeek = getStartOfWeek(date);
    const endOfWeek = getEndOfWeek(date);

    const startMonth = startOfWeek.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' });
    const year = endOfWeek.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${year}`;
    }
    return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${year}`;
  }

  return date.toLocaleDateString('en-US', options);
}

export function getAppointmentPosition(
  startTime: string,
  endTime: string,
  startHour: number = 6
): { top: number; height: number } {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const gridStartMinutes = startHour * 60;

  const pixelsPerMinute = 64 / 60;

  const top = (startMinutes - gridStartMinutes) * pixelsPerMinute;
  const height = (endMinutes - startMinutes) * pixelsPerMinute;

  return { top: Math.max(0, top), height: Math.max(16, height) };
}

export function formatTimeRange(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function getStatusColor(status: string): {
  bg: string;
  border: string;
  text: string;
} {
  switch (status) {
    case 'scheduled':
      return {
        bg: 'bg-cyan-500/20',
        border: 'border-l-cyan-500',
        text: 'text-cyan-400',
      };
    case 'completed':
      return {
        bg: 'bg-emerald-500/20',
        border: 'border-l-emerald-500',
        text: 'text-emerald-400',
      };
    case 'canceled':
      return {
        bg: 'bg-slate-500/20',
        border: 'border-l-slate-500',
        text: 'text-slate-400',
      };
    case 'no_show':
      return {
        bg: 'bg-red-500/20',
        border: 'border-l-red-500',
        text: 'text-red-400',
      };
    default:
      return {
        bg: 'bg-slate-500/20',
        border: 'border-l-slate-500',
        text: 'text-slate-400',
      };
  }
}

export function getCurrentTimePosition(startHour: number = 6): number {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const gridStartMinutes = startHour * 60;
  const pixelsPerMinute = 64 / 60;
  return (currentMinutes - gridStartMinutes) * pixelsPerMinute;
}

export function getDateRangeForView(
  date: Date,
  viewType: CalendarViewType
): { startDate: string; endDate: string } {
  let start: Date;
  let end: Date;

  switch (viewType) {
    case 'day':
      start = getStartOfDay(date);
      end = getEndOfDay(date);
      break;
    case 'week':
      start = getStartOfWeek(date);
      end = getEndOfWeek(date);
      break;
    case 'month':
      start = getStartOfWeek(getStartOfMonth(date));
      end = getEndOfWeek(getEndOfMonth(date));
      break;
    default:
      start = getStartOfDay(date);
      end = getEndOfDay(date);
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}
