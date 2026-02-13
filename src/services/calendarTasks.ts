import { supabase } from '../lib/supabase';
import type { CalendarTask, CalendarTaskFilters, TaskPriority, User } from '../types';
import { logAudit } from './audit';
import { syncTaskToGoogle } from './googleCalendarOutboundSync';

export interface CreateCalendarTaskData {
  calendar_id: string;
  title: string;
  description?: string | null;
  due_at_utc: string;
  duration_minutes?: number;
  priority?: TaskPriority;
  assigned_user_id?: string;
}

export interface UpdateCalendarTaskData {
  title?: string;
  description?: string | null;
  due_at_utc?: string;
  duration_minutes?: number;
  priority?: TaskPriority;
  status?: 'pending' | 'in_progress' | 'completed';
}

const SELECT_FIELDS = `
  *,
  calendar:calendars(id, name, slug, type),
  user:users!calendar_tasks_user_id_fkey(id, name, email, avatar_url)
`;

export async function getCalendarTasks(
  organizationId: string,
  filters: CalendarTaskFilters = {}
): Promise<CalendarTask[]> {
  let query = supabase
    .from('calendar_tasks')
    .select(SELECT_FIELDS)
    .eq('org_id', organizationId)
    .order('due_at_utc', { ascending: true });

  if (filters.calendarId) query = query.eq('calendar_id', filters.calendarId);
  if (filters.calendarIds?.length) query = query.in('calendar_id', filters.calendarIds);
  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.userIds?.length) query = query.in('user_id', filters.userIds);
  if (filters.startDate) query = query.gte('due_at_utc', filters.startDate);
  if (filters.endDate) query = query.lte('due_at_utc', filters.endDate);
  if (filters.completed !== undefined) query = query.eq('completed', filters.completed);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCalendarTaskById(id: string): Promise<CalendarTask | null> {
  const { data, error } = await supabase
    .from('calendar_tasks')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCalendarTask(
  organizationId: string,
  taskData: CreateCalendarTaskData,
  currentUser: User
): Promise<CalendarTask> {
  const { data, error } = await supabase
    .from('calendar_tasks')
    .insert({
      org_id: organizationId,
      calendar_id: taskData.calendar_id,
      user_id: taskData.assigned_user_id || currentUser.id,
      title: taskData.title,
      description: taskData.description || null,
      due_at_utc: taskData.due_at_utc,
      duration_minutes: taskData.duration_minutes || 30,
      priority: taskData.priority || 'medium',
      status: 'pending',
      completed: false,
      created_by: currentUser.id,
    })
    .select(SELECT_FIELDS)
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'calendar_task.created',
    entityType: 'calendar_task',
    entityId: data.id,
    afterState: data,
  });

  syncTaskToGoogle(data.id, 'create').catch(() => {});

  return data;
}

export async function updateCalendarTask(
  id: string,
  updates: UpdateCalendarTaskData,
  currentUser: User
): Promise<CalendarTask> {
  const existing = await getCalendarTaskById(id);
  if (!existing) throw new Error('Calendar task not found');

  const updatePayload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (updates.status === 'completed' && !existing.completed) {
    updatePayload.completed = true;
    updatePayload.completed_at = new Date().toISOString();
  } else if (updates.status && updates.status !== 'completed' && existing.completed) {
    updatePayload.completed = false;
    updatePayload.completed_at = null;
  }

  const { data, error } = await supabase
    .from('calendar_tasks')
    .update(updatePayload)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'calendar_task.updated',
    entityType: 'calendar_task',
    entityId: id,
    beforeState: existing,
    afterState: data,
  });

  syncTaskToGoogle(id, 'update').catch(() => {});

  return data;
}

export async function completeCalendarTask(
  id: string,
  currentUser: User
): Promise<CalendarTask> {
  return updateCalendarTask(id, { status: 'completed' }, currentUser);
}

export async function reopenCalendarTask(
  id: string,
  currentUser: User
): Promise<CalendarTask> {
  return updateCalendarTask(id, { status: 'pending' }, currentUser);
}

export async function deleteCalendarTask(
  id: string,
  currentUser: User
): Promise<void> {
  const existing = await getCalendarTaskById(id);
  if (!existing) throw new Error('Calendar task not found');

  const { error } = await supabase
    .from('calendar_tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'calendar_task.deleted',
    entityType: 'calendar_task',
    entityId: id,
    beforeState: existing,
  });

  syncTaskToGoogle(id, 'delete').catch(() => {});
}
