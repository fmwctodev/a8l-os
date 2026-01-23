import { supabase } from '../lib/supabase';
import type {
  AvailabilitySlot,
  AvailabilityRule,
  AppointmentType,
  Calendar,
  CalendarMember,
  DaySchedule,
  DateOverride,
  TimeRange,
} from '../types';

interface AvailabilityParams {
  calendarId: string;
  appointmentTypeId: string;
  startDate: string;
  endDate: string;
  visitorTimezone: string;
}

interface BusyBlock {
  userId: string;
  start: Date;
  end: Date;
}

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export async function getAvailableSlots(params: AvailabilityParams): Promise<AvailabilitySlot[]> {
  const { calendarId, appointmentTypeId, startDate, endDate, visitorTimezone } = params;

  const { data: appointmentType } = await supabase
    .from('appointment_types')
    .select('*')
    .eq('id', appointmentTypeId)
    .single();

  if (!appointmentType) throw new Error('Appointment type not found');

  const { data: calendar } = await supabase
    .from('calendars')
    .select(`
      *,
      members:calendar_members(*, user:users(id, name))
    `)
    .eq('id', calendarId)
    .single();

  if (!calendar) throw new Error('Calendar not found');

  const { data: availabilityRules } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('calendar_id', calendarId);

  const rules = availabilityRules || [];

  const eligibleUserIds = getEligibleUserIds(calendar);
  const busyBlocks = await getBusyBlocks(calendar, startDate, endDate);

  const slots: AvailabilitySlot[] = [];
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const now = new Date();
  const minNoticeTime = new Date(now.getTime() + appointmentType.min_notice_minutes * 60 * 1000);

  for (let date = new Date(startDateObj); date <= endDateObj; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = DAYS_OF_WEEK[date.getDay()];

    const daySlots = generateDaySlotsForCalendar(
      date,
      dateStr,
      dayOfWeek,
      calendar,
      rules,
      appointmentType,
      eligibleUserIds,
      busyBlocks,
      minNoticeTime,
      visitorTimezone
    );

    slots.push(...daySlots);
  }

  return slots;
}

function getEligibleUserIds(calendar: Calendar): string[] {
  if (calendar.type === 'user' && calendar.owner_user_id) {
    return [calendar.owner_user_id];
  }

  const members = (calendar.members as CalendarMember[]) || [];
  return members.filter((m) => m.active).map((m) => m.user_id);
}

async function getBusyBlocks(
  calendar: Calendar,
  startDate: string,
  endDate: string
): Promise<BusyBlock[]> {
  const busyBlocks: BusyBlock[] = [];
  const eligibleUserIds = getEligibleUserIds(calendar);

  const { data: existingAppointments } = await supabase
    .from('appointments')
    .select('assigned_user_id, start_at_utc, end_at_utc')
    .eq('calendar_id', calendar.id)
    .eq('status', 'scheduled')
    .gte('start_at_utc', startDate)
    .lte('start_at_utc', endDate);

  for (const apt of existingAppointments || []) {
    if (apt.assigned_user_id) {
      busyBlocks.push({
        userId: apt.assigned_user_id,
        start: new Date(apt.start_at_utc),
        end: new Date(apt.end_at_utc),
      });
    }
  }

  const { data: googleConnections } = await supabase
    .from('google_calendar_connections')
    .select('user_id, selected_calendar_ids')
    .in('user_id', eligibleUserIds);

  for (const _conn of googleConnections || []) {
  }

  return busyBlocks;
}

function generateDaySlotsForCalendar(
  date: Date,
  dateStr: string,
  dayOfWeek: typeof DAYS_OF_WEEK[number],
  calendar: Calendar,
  rules: AvailabilityRule[],
  appointmentType: AppointmentType,
  eligibleUserIds: string[],
  busyBlocks: BusyBlock[],
  minNoticeTime: Date,
  _visitorTimezone: string
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];

  if (calendar.type === 'user') {
    const rule = rules.find((r) => r.user_id === null) || rules[0];
    if (!rule) return slots;

    const dayRanges = getDayRanges(rule, dateStr, dayOfWeek);
    if (dayRanges.length === 0) return slots;

    const userId = calendar.owner_user_id!;
    const userBusyBlocks = busyBlocks.filter((b) => b.userId === userId);

    for (const range of dayRanges) {
      const rangeSlots = generateSlotsForRange(
        date,
        range,
        appointmentType,
        userBusyBlocks,
        minNoticeTime,
        [userId]
      );
      slots.push(...rangeSlots);
    }
  } else {
    const calendarRule = rules.find((r) => r.user_id === null);
    if (!calendarRule) return slots;

    const dayRanges = getDayRanges(calendarRule, dateStr, dayOfWeek);
    if (dayRanges.length === 0) return slots;

    for (const range of dayRanges) {
      const slotStart = parseTimeToDate(date, range.start);
      const slotEnd = parseTimeToDate(date, range.end);

      let current = new Date(slotStart);
      while (current.getTime() + appointmentType.duration_minutes * 60 * 1000 <= slotEnd.getTime()) {
        const slotEndTime = new Date(current.getTime() + appointmentType.duration_minutes * 60 * 1000);

        if (current < minNoticeTime) {
          current = new Date(current.getTime() + appointmentType.slot_interval_minutes * 60 * 1000);
          continue;
        }

        const availableUserIds: string[] = [];
        for (const userId of eligibleUserIds) {
          const userRule = rules.find((r) => r.user_id === userId);
          const effectiveRule = userRule || calendarRule;

          const userDayRanges = getDayRanges(effectiveRule, dateStr, dayOfWeek);
          const isInUserAvailability = userDayRanges.some((r) => {
            const userStart = parseTimeToDate(date, r.start);
            const userEnd = parseTimeToDate(date, r.end);
            return current >= userStart && slotEndTime <= userEnd;
          });

          if (!isInUserAvailability) continue;

          const userBusyBlocks = busyBlocks.filter((b) => b.userId === userId);
          const bufferBefore = appointmentType.buffer_before_minutes * 60 * 1000;
          const bufferAfter = appointmentType.buffer_after_minutes * 60 * 1000;
          const bufferedStart = new Date(current.getTime() - bufferBefore);
          const bufferedEnd = new Date(slotEndTime.getTime() + bufferAfter);

          const hasConflict = userBusyBlocks.some(
            (b) => bufferedStart < b.end && bufferedEnd > b.start
          );

          if (!hasConflict) {
            availableUserIds.push(userId);
          }
        }

        if (availableUserIds.length > 0) {
          slots.push({
            start: current.toISOString(),
            end: slotEndTime.toISOString(),
            eligible_user_ids: availableUserIds,
          });
        }

        current = new Date(current.getTime() + appointmentType.slot_interval_minutes * 60 * 1000);
      }
    }
  }

  return slots;
}

function getDayRanges(
  rule: AvailabilityRule,
  dateStr: string,
  dayOfWeek: typeof DAYS_OF_WEEK[number]
): TimeRange[] {
  const overrides = (rule.overrides as DateOverride[]) || [];
  const override = overrides.find((o) => o.date === dateStr);

  if (override) {
    if (!override.available) return [];
    return override.ranges || [];
  }

  const schedule = rule.rules as DaySchedule;
  return schedule[dayOfWeek] || [];
}

function generateSlotsForRange(
  date: Date,
  range: TimeRange,
  appointmentType: AppointmentType,
  busyBlocks: BusyBlock[],
  minNoticeTime: Date,
  eligibleUserIds: string[]
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];

  const rangeStart = parseTimeToDate(date, range.start);
  const rangeEnd = parseTimeToDate(date, range.end);

  let current = new Date(rangeStart);
  while (current.getTime() + appointmentType.duration_minutes * 60 * 1000 <= rangeEnd.getTime()) {
    const slotEnd = new Date(current.getTime() + appointmentType.duration_minutes * 60 * 1000);

    if (current < minNoticeTime) {
      current = new Date(current.getTime() + appointmentType.slot_interval_minutes * 60 * 1000);
      continue;
    }

    const bufferBefore = appointmentType.buffer_before_minutes * 60 * 1000;
    const bufferAfter = appointmentType.buffer_after_minutes * 60 * 1000;
    const bufferedStart = new Date(current.getTime() - bufferBefore);
    const bufferedEnd = new Date(slotEnd.getTime() + bufferAfter);

    const hasConflict = busyBlocks.some(
      (b) => bufferedStart < b.end && bufferedEnd > b.start
    );

    if (!hasConflict) {
      slots.push({
        start: current.toISOString(),
        end: slotEnd.toISOString(),
        eligible_user_ids: eligibleUserIds,
      });
    }

    current = new Date(current.getTime() + appointmentType.slot_interval_minutes * 60 * 1000);
  }

  return slots;
}

function parseTimeToDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export async function checkSlotAvailability(
  calendarId: string,
  appointmentTypeId: string,
  startUtc: string,
  endUtc: string
): Promise<{ available: boolean; eligibleUserIds: string[] }> {
  const startDate = startUtc.split('T')[0];
  const endDate = new Date(new Date(startUtc).getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const slots = await getAvailableSlots({
    calendarId,
    appointmentTypeId,
    startDate,
    endDate,
    visitorTimezone: 'UTC',
  });

  const matchingSlot = slots.find(
    (s) => s.start === startUtc && s.end === endUtc
  );

  return {
    available: !!matchingSlot,
    eligibleUserIds: matchingSlot?.eligible_user_ids || [],
  };
}
