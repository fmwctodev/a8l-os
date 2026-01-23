import type { User, Calendar, AppointmentType, UserWithDetails } from '../types';

export function canManageCalendar(
  user: UserWithDetails | null,
  calendar: Calendar
): boolean {
  if (!user) return false;

  if (user.permissions.includes('calendars.manage_all')) {
    return true;
  }

  if (
    user.permissions.includes('calendars.manage_department') &&
    calendar.department_id &&
    calendar.department_id === user.department_id
  ) {
    return true;
  }

  if (
    user.permissions.includes('calendars.manage_own') &&
    calendar.type === 'user' &&
    calendar.owner_user_id === user.id
  ) {
    return true;
  }

  return false;
}

export function canManageAppointmentType(
  user: UserWithDetails | null,
  appointmentType: AppointmentType,
  calendar: Calendar | null
): boolean {
  if (!user || !calendar) return false;

  if (user.permissions.includes('appointment_types.manage_all')) {
    return true;
  }

  if (
    user.permissions.includes('appointment_types.manage_department') &&
    calendar.department_id &&
    calendar.department_id === user.department_id
  ) {
    return true;
  }

  if (
    user.permissions.includes('appointment_types.manage_own') &&
    calendar.type === 'user' &&
    calendar.owner_user_id === user.id
  ) {
    return true;
  }

  return false;
}

export function canManageAvailability(
  user: UserWithDetails | null,
  calendar: Calendar
): boolean {
  if (!user) return false;

  if (user.permissions.includes('availability.manage_department')) {
    if (calendar.department_id && calendar.department_id === user.department_id) {
      return true;
    }
    if (user.permissions.includes('calendars.manage_all')) {
      return true;
    }
  }

  if (
    user.permissions.includes('availability.manage_own') &&
    calendar.type === 'user' &&
    calendar.owner_user_id === user.id
  ) {
    return true;
  }

  return false;
}

export function getManageableCalendars(
  user: UserWithDetails | null,
  allCalendars: Calendar[]
): Calendar[] {
  if (!user) return [];

  return allCalendars.filter((calendar) => canManageCalendar(user, calendar));
}

export function isCalendarOwner(user: User | null, calendar: Calendar): boolean {
  if (!user) return false;
  return calendar.type === 'user' && calendar.owner_user_id === user.id;
}

export function isInSameDepartment(user: User | null, calendar: Calendar): boolean {
  if (!user || !user.department_id || !calendar.department_id) return false;
  return user.department_id === calendar.department_id;
}

export function canViewCalendar(
  user: UserWithDetails | null,
  calendar: Calendar
): boolean {
  if (!user) return false;

  if (user.permissions.includes('calendars.view')) {
    if (user.permissions.includes('calendars.manage_all')) {
      return true;
    }

    if (
      user.permissions.includes('calendars.manage_department') &&
      calendar.department_id &&
      calendar.department_id === user.department_id
    ) {
      return true;
    }

    if (calendar.type === 'user' && calendar.owner_user_id === user.id) {
      return true;
    }

    if (
      calendar.type === 'team' &&
      calendar.members?.some((m) => m.user_id === user.id)
    ) {
      return true;
    }
  }

  return false;
}

export function getViewableCalendars(
  user: UserWithDetails | null,
  allCalendars: Calendar[]
): Calendar[] {
  if (!user) return [];

  if (user.permissions.includes('calendars.manage_all')) {
    return allCalendars;
  }

  return allCalendars.filter((calendar) => canViewCalendar(user, calendar));
}

export function canDeleteCalendar(
  user: UserWithDetails | null,
  calendar: Calendar
): boolean {
  return canManageCalendar(user, calendar);
}

export function canToggleCalendarStatus(
  user: UserWithDetails | null,
  calendar: Calendar
): boolean {
  return canManageCalendar(user, calendar);
}
