import { supabase } from '../lib/supabase';
import type { ReportSchedule, ReportScheduleCadence, ReportScheduleRecipients } from '../types';

export async function getSchedulesByReportId(reportId: string): Promise<ReportSchedule[]> {
  const { data, error } = await supabase
    .from('report_schedules')
    .select(`
      *,
      created_by_user:users!report_schedules_created_by_fkey(id, name, email, avatar_url)
    `)
    .eq('report_id', reportId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching schedules:', error);
    throw new Error('Failed to fetch schedules');
  }

  return data || [];
}

export async function getScheduleById(scheduleId: string): Promise<ReportSchedule | null> {
  const { data, error } = await supabase
    .from('report_schedules')
    .select(`
      *,
      report:reports(*),
      created_by_user:users!report_schedules_created_by_fkey(id, name, email, avatar_url)
    `)
    .eq('id', scheduleId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching schedule:', error);
    throw new Error('Failed to fetch schedule');
  }

  return data;
}

function calculateNextRun(
  cadence: ReportScheduleCadence,
  timeOfDay: string,
  timezone: string,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null
): Date {
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  const next = new Date();
  next.setHours(hours, minutes, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  switch (cadence) {
    case 'daily':
      break;

    case 'weekly':
      if (dayOfWeek !== null && dayOfWeek !== undefined) {
        const currentDay = next.getDay();
        const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
        if (daysUntilTarget === 0 && next <= now) {
          next.setDate(next.getDate() + 7);
        } else {
          next.setDate(next.getDate() + daysUntilTarget);
        }
      }
      break;

    case 'monthly':
      if (dayOfMonth !== null && dayOfMonth !== undefined) {
        next.setDate(dayOfMonth);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        if (dayOfMonth > lastDay) {
          next.setDate(lastDay);
        }
      }
      break;
  }

  return next;
}

export async function createSchedule(
  organizationId: string,
  reportId: string,
  userId: string,
  data: {
    cadence: ReportScheduleCadence;
    day_of_week?: number;
    day_of_month?: number;
    time_of_day: string;
    timezone: string;
    recipients: ReportScheduleRecipients;
    enabled?: boolean;
  }
): Promise<ReportSchedule> {
  const nextRunAt = calculateNextRun(
    data.cadence,
    data.time_of_day,
    data.timezone,
    data.day_of_week,
    data.day_of_month
  );

  const { data: schedule, error } = await supabase
    .from('report_schedules')
    .insert({
      organization_id: organizationId,
      report_id: reportId,
      created_by: userId,
      cadence: data.cadence,
      day_of_week: data.day_of_week ?? null,
      day_of_month: data.day_of_month ?? null,
      time_of_day: data.time_of_day,
      timezone: data.timezone,
      recipients: data.recipients,
      enabled: data.enabled ?? true,
      next_run_at: nextRunAt.toISOString(),
    })
    .select(`
      *,
      created_by_user:users!report_schedules_created_by_fkey(id, name, email, avatar_url)
    `)
    .single();

  if (error) {
    console.error('Error creating schedule:', error);
    throw new Error('Failed to create schedule');
  }

  return schedule;
}

export async function updateSchedule(
  scheduleId: string,
  data: {
    cadence?: ReportScheduleCadence;
    day_of_week?: number | null;
    day_of_month?: number | null;
    time_of_day?: string;
    timezone?: string;
    recipients?: ReportScheduleRecipients;
    enabled?: boolean;
  }
): Promise<ReportSchedule> {
  const current = await getScheduleById(scheduleId);
  if (!current) {
    throw new Error('Schedule not found');
  }

  const cadence = data.cadence ?? current.cadence;
  const timeOfDay = data.time_of_day ?? current.time_of_day;
  const timezone = data.timezone ?? current.timezone;
  const dayOfWeek = data.day_of_week !== undefined ? data.day_of_week : current.day_of_week;
  const dayOfMonth = data.day_of_month !== undefined ? data.day_of_month : current.day_of_month;

  const nextRunAt = calculateNextRun(cadence, timeOfDay, timezone, dayOfWeek, dayOfMonth);

  const { data: schedule, error } = await supabase
    .from('report_schedules')
    .update({
      ...data,
      next_run_at: nextRunAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .select(`
      *,
      created_by_user:users!report_schedules_created_by_fkey(id, name, email, avatar_url)
    `)
    .single();

  if (error) {
    console.error('Error updating schedule:', error);
    throw new Error('Failed to update schedule');
  }

  return schedule;
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  const { error } = await supabase
    .from('report_schedules')
    .delete()
    .eq('id', scheduleId);

  if (error) {
    console.error('Error deleting schedule:', error);
    throw new Error('Failed to delete schedule');
  }
}

export async function toggleSchedule(scheduleId: string, enabled: boolean): Promise<ReportSchedule> {
  return updateSchedule(scheduleId, { enabled });
}

export async function getActiveSchedules(organizationId: string): Promise<ReportSchedule[]> {
  const { data, error } = await supabase
    .from('report_schedules')
    .select(`
      *,
      report:reports(id, name, data_source),
      created_by_user:users!report_schedules_created_by_fkey(id, name, email)
    `)
    .eq('organization_id', organizationId)
    .eq('enabled', true)
    .order('next_run_at', { ascending: true });

  if (error) {
    console.error('Error fetching active schedules:', error);
    throw new Error('Failed to fetch active schedules');
  }

  return data || [];
}

export async function getUserEmailsForSchedule(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, email')
    .in('id', userIds);

  if (error) {
    console.error('Error fetching user emails:', error);
    throw new Error('Failed to fetch user emails');
  }

  return (data || []).reduce((acc, user) => {
    acc[user.id] = user.email;
    return acc;
  }, {} as Record<string, string>);
}
