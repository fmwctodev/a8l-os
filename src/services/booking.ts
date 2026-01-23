import { supabase } from '../lib/supabase';
import type {
  Appointment,
  AppointmentAnswers,
  Calendar,
  CalendarMember,
  CalendarSettings,
  Contact,
} from '../types';
import { checkSlotAvailability } from './availability';
import { createAppointment } from './appointments';
import { getAppointmentCountForDateRange } from './appointments';

interface BookingData {
  calendarId: string;
  appointmentTypeId: string;
  startUtc: string;
  endUtc: string;
  visitorTimezone: string;
  answers: AppointmentAnswers;
}

interface BookingResult {
  appointment: Appointment;
  contact: Contact | null;
}

export async function submitBooking(
  organizationId: string,
  data: BookingData
): Promise<BookingResult> {
  const { available, eligibleUserIds } = await checkSlotAvailability(
    data.calendarId,
    data.appointmentTypeId,
    data.startUtc,
    data.endUtc
  );

  if (!available || eligibleUserIds.length === 0) {
    throw new Error('Selected time slot is no longer available');
  }

  const { data: calendar } = await supabase
    .from('calendars')
    .select(`
      *,
      members:calendar_members(*)
    `)
    .eq('id', data.calendarId)
    .single();

  if (!calendar) throw new Error('Calendar not found');

  const { data: appointmentType } = await supabase
    .from('appointment_types')
    .select('*')
    .eq('id', data.appointmentTypeId)
    .single();

  if (!appointmentType) throw new Error('Appointment type not found');

  const assignedUserId = await assignUser(
    calendar,
    eligibleUserIds,
    data.startUtc,
    appointmentType.max_per_day
  );

  let contact = await findOrCreateContact(
    organizationId,
    calendar.department_id,
    data.answers
  );

  const appointment = await createAppointment(organizationId, {
    calendar_id: data.calendarId,
    appointment_type_id: data.appointmentTypeId,
    contact_id: contact?.id || null,
    assigned_user_id: assignedUserId,
    start_at_utc: data.startUtc,
    end_at_utc: data.endUtc,
    visitor_timezone: data.visitorTimezone,
    answers: data.answers,
    source: 'booking',
  });

  return { appointment, contact };
}

async function assignUser(
  calendar: Calendar,
  eligibleUserIds: string[],
  startUtc: string,
  maxPerDay: number | null
): Promise<string> {
  if (calendar.type === 'user' && calendar.owner_user_id) {
    return calendar.owner_user_id;
  }

  const members = (calendar.members as CalendarMember[]) || [];
  const activeMembers = members.filter(
    (m) => m.active && eligibleUserIds.includes(m.user_id)
  );

  if (activeMembers.length === 0) {
    throw new Error('No team members available for this time slot');
  }

  if (maxPerDay) {
    const dayStart = startUtc.split('T')[0] + 'T00:00:00.000Z';
    const dayEnd = startUtc.split('T')[0] + 'T23:59:59.999Z';

    const filteredMembers: CalendarMember[] = [];
    for (const member of activeMembers) {
      const count = await getAppointmentCountForDateRange(
        calendar.id,
        member.user_id,
        dayStart,
        dayEnd
      );
      if (count < maxPerDay) {
        filteredMembers.push(member);
      }
    }

    if (filteredMembers.length === 0) {
      throw new Error('All team members have reached their daily booking limit');
    }

    return selectMember(calendar, filteredMembers);
  }

  return selectMember(calendar, activeMembers);
}

function selectMember(calendar: Calendar, members: CalendarMember[]): string {
  const settings = calendar.settings as CalendarSettings;

  if (settings.assignment_mode === 'priority') {
    return selectByPriority(members);
  }

  return selectByWeightedRoundRobin(calendar, members, settings);
}

function selectByPriority(members: CalendarMember[]): string {
  const sorted = [...members].sort((a, b) => b.priority - a.priority);
  return sorted[0].user_id;
}

function selectByWeightedRoundRobin(
  calendar: Calendar,
  members: CalendarMember[],
  settings: CalendarSettings
): string {
  const totalWeight = members.reduce((sum, m) => sum + m.weight, 0);
  const expandedList: string[] = [];

  for (const member of members) {
    for (let i = 0; i < member.weight; i++) {
      expandedList.push(member.user_id);
    }
  }

  const currentIndex = settings.last_assigned_index % expandedList.length;
  const selectedUserId = expandedList[currentIndex];

  supabase
    .from('calendars')
    .update({
      settings: {
        ...settings,
        last_assigned_index: (settings.last_assigned_index + 1) % totalWeight,
      },
    })
    .eq('id', calendar.id)
    .then(() => {});

  return selectedUserId;
}

async function findOrCreateContact(
  organizationId: string,
  departmentId: string | null,
  answers: AppointmentAnswers
): Promise<Contact | null> {
  if (!answers.email && !answers.phone) return null;

  if (answers.email) {
    const { data: existingByEmail } = await supabase
      .from('contacts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('email', answers.email)
      .eq('status', 'active')
      .is('merged_into_contact_id', null)
      .maybeSingle();

    if (existingByEmail) return existingByEmail;
  }

  if (answers.phone) {
    const normalizedPhone = normalizePhone(answers.phone);
    const { data: existingByPhone } = await supabase
      .from('contacts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .is('merged_into_contact_id', null)
      .or(`phone.eq.${normalizedPhone},phone.eq.${answers.phone}`);

    if (existingByPhone && existingByPhone.length > 0) {
      return existingByPhone[0];
    }
  }

  const { data: departments } = await supabase
    .from('departments')
    .select('id')
    .eq('organization_id', organizationId)
    .limit(1);

  const effectiveDepartmentId = departmentId || departments?.[0]?.id;
  if (!effectiveDepartmentId) {
    return null;
  }

  const nameParts = (answers.name || '').trim().split(' ');
  const firstName = nameParts[0] || 'Guest';
  const lastName = nameParts.slice(1).join(' ') || '';

  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      organization_id: organizationId,
      department_id: effectiveDepartmentId,
      first_name: firstName,
      last_name: lastName,
      email: answers.email || null,
      phone: answers.phone ? normalizePhone(answers.phone) : null,
      source: 'booking',
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create contact:', error);
    return null;
  }

  return newContact;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function validateRescheduleToken(token: string): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      calendar:calendars(*),
      appointment_type:appointment_types(*)
    `)
    .eq('reschedule_token', token)
    .eq('status', 'scheduled')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function validateCancelToken(token: string): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      calendar:calendars(*),
      appointment_type:appointment_types(*)
    `)
    .eq('cancel_token', token)
    .eq('status', 'scheduled')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function generateICSFile(appointment: Appointment): string {
  const formatICSDate = (dateStr: string) => {
    return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const startDate = formatICSDate(appointment.start_at_utc);
  const endDate = formatICSDate(appointment.end_at_utc);
  const now = formatICSDate(new Date().toISOString());

  const appointmentType = appointment.appointment_type;
  const summary = appointmentType?.name || 'Appointment';
  const description = appointment.google_meet_link
    ? `Join via Google Meet: ${appointment.google_meet_link}`
    : '';

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CRM//Booking//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${appointment.id}@crm.local
DTSTAMP:${now}
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${summary}
DESCRIPTION:${description}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}
