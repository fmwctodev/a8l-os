import { supabase } from '../lib/supabase';
import type {
  AppointmentType,
  AppointmentTypeQuestion,
  AppointmentTypeLocation,
  LocationType,
  User,
} from '../types';
import { logAudit } from './audit';

export interface CreateAppointmentTypeData {
  calendar_id: string;
  name: string;
  slug: string;
  description?: string | null;
  duration_minutes: number;
  location_type: LocationType;
  location_value?: AppointmentTypeLocation;
  questions?: AppointmentTypeQuestion[];
  slot_interval_minutes?: number;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  min_notice_minutes?: number;
  booking_window_days?: number;
  max_per_day?: number | null;
  generate_google_meet?: boolean;
}

export interface UpdateAppointmentTypeData extends Partial<CreateAppointmentTypeData> {
  active?: boolean;
}

export async function getAppointmentTypes(calendarId: string): Promise<AppointmentType[]> {
  const { data, error } = await supabase
    .from('appointment_types')
    .select('*')
    .eq('calendar_id', calendarId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAppointmentTypeById(id: string): Promise<AppointmentType | null> {
  const { data, error } = await supabase
    .from('appointment_types')
    .select(`
      *,
      calendar:calendars(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAppointmentTypeBySlug(
  calendarId: string,
  slug: string
): Promise<AppointmentType | null> {
  const { data, error } = await supabase
    .from('appointment_types')
    .select(`
      *,
      calendar:calendars(*)
    `)
    .eq('calendar_id', calendarId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createAppointmentType(
  organizationId: string,
  typeData: CreateAppointmentTypeData,
  currentUser: User
): Promise<AppointmentType> {
  const { data, error } = await supabase
    .from('appointment_types')
    .insert({
      org_id: organizationId,
      calendar_id: typeData.calendar_id,
      name: typeData.name,
      slug: typeData.slug,
      description: typeData.description || null,
      duration_minutes: typeData.duration_minutes,
      location_type: typeData.location_type,
      location_value: typeData.location_value || {},
      questions: typeData.questions || [],
      slot_interval_minutes: typeData.slot_interval_minutes || 15,
      buffer_before_minutes: typeData.buffer_before_minutes || 0,
      buffer_after_minutes: typeData.buffer_after_minutes || 0,
      min_notice_minutes: typeData.min_notice_minutes || 60,
      booking_window_days: typeData.booking_window_days || 30,
      max_per_day: typeData.max_per_day || null,
      generate_google_meet: typeData.generate_google_meet ?? true,
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'create',
    entityType: 'appointment_type',
    entityId: data.id,
    afterState: data,
  });

  return data;
}

export async function updateAppointmentType(
  id: string,
  updates: UpdateAppointmentTypeData,
  currentUser: User
): Promise<AppointmentType> {
  const { data: before } = await supabase
    .from('appointment_types')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('appointment_types')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'update',
    entityType: 'appointment_type',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data;
}

export async function deleteAppointmentType(id: string, currentUser: User): Promise<void> {
  const { data: before } = await supabase
    .from('appointment_types')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('appointment_types').delete().eq('id', id);
  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'delete',
    entityType: 'appointment_type',
    entityId: id,
    beforeState: before,
  });
}

export async function toggleAppointmentTypeActive(
  id: string,
  active: boolean,
  currentUser: User
): Promise<AppointmentType> {
  return updateAppointmentType(id, { active }, currentUser);
}

export function generateAppointmentTypeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getDefaultQuestions(): AppointmentTypeQuestion[] {
  return [
    {
      id: 'name',
      label: 'Your Name',
      type: 'text',
      required: true,
    },
    {
      id: 'email',
      label: 'Email Address',
      type: 'text',
      required: true,
    },
    {
      id: 'phone',
      label: 'Phone Number',
      type: 'text',
      required: false,
    },
  ];
}

export async function duplicateAppointmentType(
  id: string,
  newName: string,
  currentUser: User
): Promise<AppointmentType> {
  const original = await getAppointmentTypeById(id);
  if (!original) throw new Error('Appointment type not found');

  const newSlug = generateAppointmentTypeSlug(newName);

  const { data: calendar } = await supabase
    .from('calendars')
    .select('org_id')
    .eq('id', original.calendar_id)
    .single();

  if (!calendar) throw new Error('Calendar not found');

  const { data, error } = await supabase
    .from('appointment_types')
    .insert({
      org_id: calendar.org_id,
      calendar_id: original.calendar_id,
      name: newName,
      slug: newSlug,
      description: original.description,
      duration_minutes: original.duration_minutes,
      location_type: original.location_type,
      location_value: original.location_value,
      questions: original.questions,
      slot_interval_minutes: original.slot_interval_minutes,
      buffer_before_minutes: original.buffer_before_minutes,
      buffer_after_minutes: original.buffer_after_minutes,
      min_notice_minutes: original.min_notice_minutes,
      booking_window_days: original.booking_window_days,
      max_per_day: original.max_per_day,
      generate_google_meet: original.generate_google_meet,
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'duplicate',
    entityType: 'appointment_type',
    entityId: data.id,
    beforeState: { original_id: original.id },
    afterState: data,
  });

  return data;
}
