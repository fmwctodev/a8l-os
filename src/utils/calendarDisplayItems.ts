import type {
  Appointment, GoogleCalendarEvent, BlockedSlot,
  CalendarEvent, CalendarTask, CalendarDisplayItem,
} from '../types';

export function appointmentToDisplayItem(apt: Appointment): CalendarDisplayItem {
  const contactName = apt.contact
    ? `${apt.contact.first_name} ${apt.contact.last_name}`
    : apt.answers?.name || 'Guest';

  return {
    id: apt.id,
    title: contactName,
    startTime: apt.start_at_utc,
    endTime: apt.end_at_utc,
    allDay: false,
    source: 'crm',
    originalAppointment: apt,
  };
}

export function googleEventToDisplayItem(evt: GoogleCalendarEvent): CalendarDisplayItem {
  return {
    id: evt.id,
    title: evt.summary || '(No title)',
    startTime: evt.start_time,
    endTime: evt.end_time,
    allDay: evt.all_day,
    source: 'google',
    originalGoogleEvent: evt,
  };
}

export function blockedSlotToDisplayItem(slot: BlockedSlot): CalendarDisplayItem {
  return {
    id: slot.id,
    title: slot.title || 'Blocked',
    startTime: slot.start_at_utc,
    endTime: slot.end_at_utc,
    allDay: slot.all_day,
    source: 'blocked',
    originalBlockedSlot: slot,
  };
}

export function calendarEventToDisplayItem(evt: CalendarEvent): CalendarDisplayItem {
  return {
    id: evt.id,
    title: evt.title,
    startTime: evt.start_at_utc,
    endTime: evt.end_at_utc,
    allDay: evt.all_day,
    source: 'event',
    originalCalendarEvent: evt,
  };
}

export function calendarTaskToDisplayItem(task: CalendarTask): CalendarDisplayItem {
  const endTime = new Date(
    new Date(task.due_at_utc).getTime() + (task.duration_minutes || 30) * 60000
  ).toISOString();

  return {
    id: task.id,
    title: task.title,
    startTime: task.due_at_utc,
    endTime,
    allDay: false,
    source: 'task',
    originalCalendarTask: task,
  };
}

export function mergeDisplayItems(
  appointments: Appointment[],
  googleEvents: GoogleCalendarEvent[],
  blockedSlots: BlockedSlot[],
  calendarEvents: CalendarEvent[] = [],
  calendarTasks: CalendarTask[] = []
): CalendarDisplayItem[] {
  const items: CalendarDisplayItem[] = [
    ...appointments.map(appointmentToDisplayItem),
    ...googleEvents.map(googleEventToDisplayItem),
    ...blockedSlots.map(blockedSlotToDisplayItem),
    ...calendarEvents.map(calendarEventToDisplayItem),
    ...calendarTasks.map(calendarTaskToDisplayItem),
  ];

  items.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  return items;
}
