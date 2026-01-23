import { supabase } from '../lib/supabase';
import type {
  Appointment,
  AppointmentStatus,
  AppointmentAnswers,
  AppointmentFilters,
  User,
} from '../types';
import { logAudit } from './audit';
import { addTimelineEvent } from './contactTimeline';
import { publishEvent } from './eventOutbox';

export interface CreateAppointmentData {
  calendar_id: string;
  appointment_type_id: string;
  contact_id?: string | null;
  assigned_user_id?: string | null;
  start_at_utc: string;
  end_at_utc: string;
  visitor_timezone: string;
  answers: AppointmentAnswers;
  source: 'booking' | 'manual';
  google_meet_link?: string | null;
  notes?: string | null;
}

export interface UpdateAppointmentData {
  assigned_user_id?: string | null;
  start_at_utc?: string;
  end_at_utc?: string;
  status?: AppointmentStatus;
  notes?: string | null;
  google_meet_link?: string | null;
}

export async function getAppointments(
  organizationId: string,
  filters: AppointmentFilters = {}
): Promise<Appointment[]> {
  let query = supabase
    .from('appointments')
    .select(`
      *,
      calendar:calendars(id, name, slug, type),
      appointment_type:appointment_types(id, name, duration_minutes, location_type),
      contact:contacts(id, first_name, last_name, email, phone),
      assigned_user:users!appointments_assigned_user_id_fkey(id, name, email, avatar_url)
    `)
    .eq('org_id', organizationId)
    .order('start_at_utc', { ascending: true });

  if (filters.calendarId) {
    query = query.eq('calendar_id', filters.calendarId);
  }

  if (filters.assignedUserId) {
    query = query.eq('assigned_user_id', filters.assignedUserId);
  }

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters.startDate) {
    query = query.gte('start_at_utc', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('start_at_utc', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

export async function getVisibleAppointments(
  organizationId: string,
  currentUser: User,
  filters: AppointmentFilters = {}
): Promise<Appointment[]> {
  const { data: userWithRole } = await supabase
    .from('users')
    .select('role:roles(name, hierarchy_level)')
    .eq('id', currentUser.id)
    .maybeSingle();

  const roleName = userWithRole?.role?.name?.toLowerCase() || 'user';
  const isAdmin = roleName === 'superadmin' || roleName === 'admin';
  const isManager = roleName === 'manager';

  let query = supabase
    .from('appointments')
    .select(`
      *,
      calendar:calendars(id, name, slug, type, department_id, owner_user_id),
      appointment_type:appointment_types(id, name, duration_minutes, location_type, location_value),
      contact:contacts(id, first_name, last_name, email, phone),
      assigned_user:users!appointments_assigned_user_id_fkey(id, name, email, avatar_url)
    `)
    .eq('org_id', organizationId)
    .order('start_at_utc', { ascending: true });

  if (filters.calendarId) {
    query = query.eq('calendar_id', filters.calendarId);
  }

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters.startDate) {
    query = query.gte('start_at_utc', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('start_at_utc', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!data) return [];

  if (isAdmin) {
    return data;
  }

  if (isManager && currentUser.department_id) {
    return data.filter((apt) => {
      if (apt.assigned_user_id === currentUser.id) return true;
      const calendar = apt.calendar as { department_id?: string | null } | null;
      if (calendar?.department_id === currentUser.department_id) return true;
      return false;
    });
  }

  return data.filter((apt) => apt.assigned_user_id === currentUser.id);
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      calendar:calendars(*),
      appointment_type:appointment_types(*),
      contact:contacts(id, first_name, last_name, email, phone),
      assigned_user:users!appointments_assigned_user_id_fkey(id, name, email, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAppointmentByRescheduleToken(
  token: string
): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      calendar:calendars(*),
      appointment_type:appointment_types(*)
    `)
    .eq('reschedule_token', token)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAppointmentByCancelToken(
  token: string
): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      calendar:calendars(*),
      appointment_type:appointment_types(*)
    `)
    .eq('cancel_token', token)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createAppointment(
  organizationId: string,
  appointmentData: CreateAppointmentData,
  currentUser?: User
): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      org_id: organizationId,
      calendar_id: appointmentData.calendar_id,
      appointment_type_id: appointmentData.appointment_type_id,
      contact_id: appointmentData.contact_id || null,
      assigned_user_id: appointmentData.assigned_user_id || null,
      start_at_utc: appointmentData.start_at_utc,
      end_at_utc: appointmentData.end_at_utc,
      visitor_timezone: appointmentData.visitor_timezone,
      answers: appointmentData.answers,
      source: appointmentData.source,
      google_meet_link: appointmentData.google_meet_link || null,
      notes: appointmentData.notes || null,
      status: 'scheduled',
      history: [{ action: 'created', timestamp: new Date().toISOString() }],
    })
    .select()
    .single();

  if (error) throw error;

  if (currentUser) {
    await logAudit({
      userId: currentUser.id,
      action: 'create',
      entityType: 'appointment',
      entityId: data.id,
      afterState: data,
    });
  }

  if (appointmentData.contact_id) {
    await addTimelineEvent(
      appointmentData.contact_id,
      currentUser?.id || null,
      'appointment_booked',
      {
        appointment_id: data.id,
        start_time: appointmentData.start_at_utc,
        assigned_user_id: appointmentData.assigned_user_id,
      }
    );

    try {
      await publishEvent(
        organizationId,
        'appointment_booked',
        'appointment',
        data.id,
        appointmentData.contact_id,
        {
          appointment_id: data.id,
          calendar_id: appointmentData.calendar_id,
          start_time: appointmentData.start_at_utc,
          source: appointmentData.source,
        }
      );
    } catch {
    }
  }

  return data;
}

export async function updateAppointment(
  id: string,
  updates: UpdateAppointmentData,
  currentUser: User
): Promise<Appointment> {
  const { data: before } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const historyEntry: Record<string, unknown> = {
    action: 'updated',
    timestamp: new Date().toISOString(),
    updated_by: currentUser.id,
  };

  if (updates.start_at_utc && before?.start_at_utc !== updates.start_at_utc) {
    historyEntry.action = 'rescheduled';
    historyEntry.previous_start = before?.start_at_utc;
    historyEntry.previous_end = before?.end_at_utc;
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({
      ...updates,
      history: [...(before?.history || []), historyEntry],
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'update',
    entityType: 'appointment',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  if (before?.contact_id && historyEntry.action === 'rescheduled') {
    await addTimelineEvent(before.contact_id, currentUser.id, 'appointment_rescheduled', {
      appointment_id: id,
      old_time: before.start_at_utc,
      new_time: updates.start_at_utc,
    });
  }

  return data;
}

export async function rescheduleAppointment(
  id: string,
  newStartUtc: string,
  newEndUtc: string,
  currentUser?: User
): Promise<Appointment> {
  const { data: before } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const historyEntry = {
    action: 'rescheduled',
    timestamp: new Date().toISOString(),
    previous_start: before?.start_at_utc,
    previous_end: before?.end_at_utc,
  };

  const { data, error } = await supabase
    .from('appointments')
    .update({
      start_at_utc: newStartUtc,
      end_at_utc: newEndUtc,
      history: [...(before?.history || []), historyEntry],
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  if (currentUser) {
    await logAudit({
      userId: currentUser.id,
      action: 'reschedule',
      entityType: 'appointment',
      entityId: id,
      beforeState: before,
      afterState: data,
    });
  }

  if (before?.contact_id) {
    await addTimelineEvent(
      before.contact_id,
      currentUser?.id || null,
      'appointment_rescheduled',
      {
        appointment_id: id,
        old_time: before.start_at_utc,
        new_time: newStartUtc,
      }
    );

    try {
      await publishEvent(
        data.org_id,
        'appointment_rescheduled',
        'appointment',
        id,
        before.contact_id,
        {
          appointment_id: id,
          old_start_time: before.start_at_utc,
          new_start_time: newStartUtc,
        }
      );
    } catch {
    }
  }

  return data;
}

export async function cancelAppointment(
  id: string,
  reason?: string,
  currentUser?: User
): Promise<Appointment> {
  const { data: before } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const historyEntry = {
    action: 'canceled',
    timestamp: new Date().toISOString(),
    reason: reason || undefined,
  };

  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      history: [...(before?.history || []), historyEntry],
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  if (currentUser) {
    await logAudit({
      userId: currentUser.id,
      action: 'cancel',
      entityType: 'appointment',
      entityId: id,
      beforeState: before,
      afterState: data,
    });
  }

  if (before?.contact_id) {
    await addTimelineEvent(
      before.contact_id,
      currentUser?.id || null,
      'appointment_canceled',
      {
        appointment_id: id,
        reason,
      }
    );

    try {
      await publishEvent(
        data.org_id,
        'appointment_canceled',
        'appointment',
        id,
        before.contact_id,
        {
          appointment_id: id,
          reason,
          start_time: before.start_at_utc,
        }
      );
    } catch {
    }
  }

  return data;
}

export async function completeAppointment(
  id: string,
  currentUser: User
): Promise<Appointment> {
  return updateAppointment(id, { status: 'completed' }, currentUser);
}

export async function markNoShow(id: string, currentUser: User): Promise<Appointment> {
  return updateAppointment(id, { status: 'no_show' }, currentUser);
}

export async function getUpcomingAppointmentsForUser(
  userId: string,
  limit: number = 10
): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      calendar:calendars(id, name),
      appointment_type:appointment_types(id, name, duration_minutes),
      contact:contacts(id, first_name, last_name, email)
    `)
    .eq('assigned_user_id', userId)
    .eq('status', 'scheduled')
    .gte('start_at_utc', new Date().toISOString())
    .order('start_at_utc', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getAppointmentCountForDateRange(
  calendarId: string,
  userId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const { count, error } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('calendar_id', calendarId)
    .eq('assigned_user_id', userId)
    .eq('status', 'scheduled')
    .gte('start_at_utc', startDate)
    .lt('start_at_utc', endDate);

  if (error) throw error;
  return count || 0;
}
