import { supabase } from '../lib/supabase';
import type { ProjectTask, ProjectTaskStatus } from '../types';
import { logProjectActivity } from './projectActivityLog';

const TASK_SELECT = `
  *,
  assigned_user:users!project_tasks_assigned_user_id_fkey(*),
  created_by_user:users!project_tasks_created_by_fkey(*)
`;

export async function getTasksByProject(projectId: string): Promise<ProjectTask[]> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select(TASK_SELECT)
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProjectTask[];
}

export async function getTaskById(taskId: string): Promise<ProjectTask | null> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select(TASK_SELECT)
    .eq('id', taskId)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectTask | null;
}

export interface CreateTaskInput {
  org_id: string;
  project_id: string;
  parent_task_id?: string | null;
  assigned_user_id?: string | null;
  title: string;
  description?: string | null;
  priority?: string;
  due_date?: string | null;
  depends_on_task_id?: string | null;
  created_by: string;
}

export async function createTask(
  input: CreateTaskInput,
  actorUserId: string
): Promise<ProjectTask> {
  const { data: existing } = await supabase
    .from('project_tasks')
    .select('sort_order')
    .eq('project_id', input.project_id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('project_tasks')
    .insert({
      org_id: input.org_id,
      project_id: input.project_id,
      parent_task_id: input.parent_task_id ?? null,
      assigned_user_id: input.assigned_user_id ?? null,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? 'medium',
      due_date: input.due_date ?? null,
      depends_on_task_id: input.depends_on_task_id ?? null,
      sort_order: nextOrder,
      created_by: input.created_by,
    })
    .select(TASK_SELECT)
    .single();

  if (error) throw error;

  await logProjectActivity({
    org_id: input.org_id,
    project_id: input.project_id,
    event_type: 'task_created',
    summary: `Task "${input.title}" created`,
    payload: { task_id: data.id },
    actor_user_id: actorUserId,
  });

  await recalculateProgress(input.project_id);

  return data as ProjectTask;
}

export async function updateTask(
  id: string,
  updates: Partial<ProjectTask>,
  actorUserId: string
): Promise<ProjectTask> {
  const existing = await getTaskById(id);
  if (!existing) throw new Error('Task not found');

  const updateData: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  delete updateData.id;
  delete updateData.org_id;
  delete updateData.project_id;
  delete updateData.created_by;
  delete updateData.created_at;
  delete updateData.assigned_user;
  delete updateData.created_by_user;
  delete updateData.subtasks;
  delete updateData.dependency;

  if (updates.status === 'completed' && existing.status !== 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('project_tasks')
    .update(updateData)
    .eq('id', id)
    .select(TASK_SELECT)
    .single();

  if (error) throw error;

  if (updates.assigned_user_id && updates.assigned_user_id !== existing.assigned_user_id) {
    await logProjectActivity({
      org_id: existing.org_id,
      project_id: existing.project_id,
      event_type: 'task_assigned',
      summary: `Task "${existing.title}" reassigned`,
      payload: { task_id: id, to_user_id: updates.assigned_user_id },
      actor_user_id: actorUserId,
    });
  }

  if (updates.status === 'completed' && existing.status !== 'completed') {
    await logProjectActivity({
      org_id: existing.org_id,
      project_id: existing.project_id,
      event_type: 'task_completed',
      summary: `Task "${existing.title}" completed`,
      payload: { task_id: id },
      actor_user_id: actorUserId,
    });
  }

  await recalculateProgress(existing.project_id);

  return data as ProjectTask;
}

export async function completeTask(
  id: string,
  actorUserId: string
): Promise<ProjectTask> {
  return updateTask(id, { status: 'completed' as ProjectTaskStatus } as Partial<ProjectTask>, actorUserId);
}

export async function deleteTask(id: string): Promise<void> {
  const task = await getTaskById(id);
  const { error } = await supabase.from('project_tasks').delete().eq('id', id);
  if (error) throw error;
  if (task) {
    await recalculateProgress(task.project_id);
  }
}

export async function getSubtasks(parentTaskId: string): Promise<ProjectTask[]> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select(TASK_SELECT)
    .eq('parent_task_id', parentTaskId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProjectTask[];
}

async function recalculateProgress(projectId: string): Promise<void> {
  const { data: tasks, error } = await supabase
    .from('project_tasks')
    .select('status')
    .eq('project_id', projectId)
    .is('parent_task_id', null);

  if (error) return;
  if (!tasks || tasks.length === 0) return;

  const nonCancelled = tasks.filter((t) => t.status !== 'cancelled');
  if (nonCancelled.length === 0) return;

  const completed = nonCancelled.filter((t) => t.status === 'completed').length;
  const percent = Math.round((completed / nonCancelled.length) * 100);

  await supabase
    .from('projects')
    .update({ progress_percent: percent, updated_at: new Date().toISOString() })
    .eq('id', projectId);
}
