import { supabase } from '../lib/supabase';
import type {
  CreateTaskConfig,
  AssignTaskConfig,
  MarkTaskCompleteConfig,
} from '../types/workflowActions';

export interface TaskActionContext {
  orgId: string;
  contactId: string;
  enrollmentId: string;
  actorUserId?: string;
  contextData?: Record<string, unknown>;
}

export interface TaskActionResult {
  success: boolean;
  taskId?: string;
  error?: string;
  data?: Record<string, unknown>;
}

async function resolveAssignee(
  orgId: string,
  config: { assigneeType: string; assigneeId?: string },
  contactId: string
): Promise<string | null> {
  if (config.assigneeType === 'specific_user' && config.assigneeId) {
    return config.assigneeId;
  }

  if (config.assigneeType === 'contact_owner') {
    const { data: contact } = await supabase
      .from('contacts')
      .select('assigned_user_id')
      .eq('id', contactId)
      .maybeSingle();

    return contact?.assigned_user_id || null;
  }

  if (config.assigneeType === 'round_robin') {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('last_assigned_at', { ascending: true, nullsFirst: true })
      .limit(1);

    if (users && users.length > 0) {
      await supabase
        .from('users')
        .update({ last_assigned_at: new Date().toISOString() })
        .eq('id', users[0].id);

      return users[0].id;
    }
  }

  if (config.assigneeType === 'least_busy') {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'active');

    if (users && users.length > 0) {
      const { data: counts } = await supabase
        .from('contact_tasks')
        .select('assigned_user_id')
        .eq('org_id', orgId)
        .eq('status', 'pending')
        .in('assigned_user_id', users.map(u => u.id));

      const countMap = new Map<string, number>();
      users.forEach(u => countMap.set(u.id, 0));
      counts?.forEach(t => {
        if (t.assigned_user_id) {
          countMap.set(t.assigned_user_id, (countMap.get(t.assigned_user_id) || 0) + 1);
        }
      });

      let leastBusyUser = users[0].id;
      let minCount = countMap.get(users[0].id) || 0;

      for (const user of users) {
        const count = countMap.get(user.id) || 0;
        if (count < minCount) {
          minCount = count;
          leastBusyUser = user.id;
        }
      }

      return leastBusyUser;
    }
  }

  return null;
}

async function resolveTaskId(
  source: 'most_recent' | 'specific_id',
  context: TaskActionContext,
  specificId?: string
): Promise<string | null> {
  if (source === 'specific_id' && specificId) {
    return specificId;
  }

  if (source === 'most_recent') {
    const { data } = await supabase
      .from('contact_tasks')
      .select('id')
      .eq('org_id', context.orgId)
      .eq('contact_id', context.contactId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.id || null;
  }

  return null;
}

export async function createTask(
  config: CreateTaskConfig,
  context: TaskActionContext
): Promise<TaskActionResult> {
  try {
    const assignedUserId = await resolveAssignee(
      context.orgId,
      {
        assigneeType: config.assigneeType,
        assigneeId: config.assigneeId,
      },
      context.contactId
    );

    let dueDate: string;
    if (config.dueType === 'absolute' && config.dueDate) {
      dueDate = config.dueDate;
      if (config.dueTime) {
        dueDate = `${config.dueDate}T${config.dueTime}`;
      }
    } else if (config.dueDays !== undefined) {
      const date = new Date();
      date.setDate(date.getDate() + config.dueDays);
      if (config.dueTime) {
        const [hours, minutes] = config.dueTime.split(':').map(Number);
        date.setHours(hours, minutes, 0, 0);
      }
      dueDate = date.toISOString();
    } else {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      dueDate = date.toISOString();
    }

    const opportunityId = config.linkedToOpportunity
      ? (context.contextData?.opportunityId as string | undefined)
      : null;

    const { data: task, error } = await supabase
      .from('contact_tasks')
      .insert({
        org_id: context.orgId,
        contact_id: context.contactId,
        opportunity_id: opportunityId,
        title: config.title,
        description: config.description,
        status: 'pending',
        priority: config.priority,
        due_date: dueDate,
        assigned_user_id: assignedUserId,
        reminder_minutes: config.reminderMinutes,
        created_by_user_id: context.actorUserId,
        metadata: {
          created_by_workflow: true,
          enrollment_id: context.enrollmentId,
        },
      })
      .select()
      .single();

    if (error) throw error;

    if (assignedUserId) {
      await supabase.from('inbox_events').insert({
        org_id: context.orgId,
        user_id: assignedUserId,
        event_type: 'task_assigned',
        title: 'New Task Assigned',
        body: config.title,
        metadata: { task_id: task.id, contact_id: context.contactId },
        read: false,
      });
    }

    return {
      success: true,
      taskId: task.id,
      data: { task },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create task',
    };
  }
}

export async function assignTask(
  config: AssignTaskConfig,
  context: TaskActionContext
): Promise<TaskActionResult> {
  try {
    const taskId = await resolveTaskId(config.taskSource, context, config.taskId);

    if (!taskId) {
      return { success: false, error: 'Task not found' };
    }

    const newAssigneeId = await resolveAssignee(
      context.orgId,
      {
        assigneeType: config.assigneeType,
        assigneeId: config.assigneeId,
      },
      context.contactId
    );

    if (!newAssigneeId) {
      return { success: false, error: 'Could not resolve assignee' };
    }

    const { data: task, error } = await supabase
      .from('contact_tasks')
      .update({ assigned_user_id: newAssigneeId })
      .eq('id', taskId)
      .select('*, assigned_user:users!assigned_user_id(id, name, email)')
      .single();

    if (error) throw error;

    await supabase.from('inbox_events').insert({
      org_id: context.orgId,
      user_id: newAssigneeId,
      event_type: 'task_assigned',
      title: 'Task Assigned to You',
      body: task.title,
      metadata: { task_id: taskId, contact_id: context.contactId },
      read: false,
    });

    return {
      success: true,
      taskId,
      data: { task },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign task',
    };
  }
}

export async function markTaskComplete(
  config: MarkTaskCompleteConfig,
  context: TaskActionContext
): Promise<TaskActionResult> {
  try {
    const taskId = await resolveTaskId(config.taskSource, context, config.taskId);

    if (!taskId) {
      return { success: false, error: 'Task not found' };
    }

    const { data: task, error } = await supabase
      .from('contact_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_notes: config.completionNotes,
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('contact_timeline').insert({
      contact_id: context.contactId,
      user_id: context.actorUserId,
      event_type: 'task_completed',
      event_data: {
        summary: 'Task Completed',
        description: task.title,
        metadata: {
          task_id: taskId,
          completed_by_workflow: true,
          enrollment_id: context.enrollmentId,
        },
      }
    });

    return {
      success: true,
      taskId,
      data: { task },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete task',
    };
  }
}
