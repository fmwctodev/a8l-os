import { supabase } from '../lib/supabase';

export type ScheduledTriggerCadence = 'daily' | 'weekly' | 'monthly' | 'custom_cron';
export type ReEnrollmentPolicy = 'never' | 'always' | 'after_completion';

export interface FilterRule {
  field: string;
  operator: string;
  value: unknown;
}

export interface FilterConfig {
  logic?: 'and' | 'or';
  rules?: FilterRule[];
}

export interface WorkflowScheduledTrigger {
  id: string;
  org_id: string;
  workflow_id: string;
  name: string;
  cadence: ScheduledTriggerCadence;
  time_of_day: string;
  timezone: string;
  day_of_week: number | null;
  day_of_month: number | null;
  cron_expression: string | null;
  filter_config: FilterConfig;
  re_enrollment_policy: ReEnrollmentPolicy;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledTriggerRun {
  id: string;
  org_id: string;
  trigger_id: string;
  started_at: string;
  completed_at: string | null;
  contacts_matched: number;
  contacts_enrolled: number;
  contacts_skipped: number;
  status: string;
  error_details: { errors?: string[] } | null;
  created_at: string;
}

export interface CreateScheduledTriggerInput {
  workflow_id: string;
  name: string;
  cadence: ScheduledTriggerCadence;
  time_of_day: string;
  timezone?: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  cron_expression?: string | null;
  filter_config?: FilterConfig;
  re_enrollment_policy?: ReEnrollmentPolicy;
}

export interface UpdateScheduledTriggerInput {
  name?: string;
  cadence?: ScheduledTriggerCadence;
  time_of_day?: string;
  timezone?: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  cron_expression?: string | null;
  filter_config?: FilterConfig;
  re_enrollment_policy?: ReEnrollmentPolicy;
  is_active?: boolean;
}

export async function createScheduledTrigger(
  orgId: string,
  input: CreateScheduledTriggerInput
): Promise<WorkflowScheduledTrigger> {
  const nextRunAt = calculateNextRunAt({
    cadence: input.cadence,
    time_of_day: input.time_of_day,
    timezone: input.timezone || 'UTC',
    day_of_week: input.day_of_week ?? null,
    day_of_month: input.day_of_month ?? null,
  });

  const { data, error } = await supabase
    .from('workflow_scheduled_triggers')
    .insert({
      org_id: orgId,
      workflow_id: input.workflow_id,
      name: input.name,
      cadence: input.cadence,
      time_of_day: input.time_of_day,
      timezone: input.timezone || 'UTC',
      day_of_week: input.day_of_week ?? null,
      day_of_month: input.day_of_month ?? null,
      cron_expression: input.cron_expression ?? null,
      filter_config: input.filter_config || {},
      re_enrollment_policy: input.re_enrollment_policy || 'never',
      is_active: false,
      next_run_at: nextRunAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateScheduledTrigger(
  triggerId: string,
  input: UpdateScheduledTriggerInput
): Promise<WorkflowScheduledTrigger> {
  const updates: Record<string, unknown> = { ...input };

  if (input.cadence || input.time_of_day || input.timezone ||
      input.day_of_week !== undefined || input.day_of_month !== undefined) {
    const { data: current } = await supabase
      .from('workflow_scheduled_triggers')
      .select('cadence, time_of_day, timezone, day_of_week, day_of_month')
      .eq('id', triggerId)
      .single();

    if (current) {
      const nextRunAt = calculateNextRunAt({
        cadence: input.cadence || current.cadence,
        time_of_day: input.time_of_day || current.time_of_day,
        timezone: input.timezone || current.timezone,
        day_of_week: input.day_of_week !== undefined ? input.day_of_week : current.day_of_week,
        day_of_month: input.day_of_month !== undefined ? input.day_of_month : current.day_of_month,
      });
      updates.next_run_at = nextRunAt.toISOString();
    }
  }

  const { data, error } = await supabase
    .from('workflow_scheduled_triggers')
    .update(updates)
    .eq('id', triggerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteScheduledTrigger(triggerId: string): Promise<void> {
  const { error } = await supabase
    .from('workflow_scheduled_triggers')
    .delete()
    .eq('id', triggerId);

  if (error) throw error;
}

export async function getScheduledTrigger(triggerId: string): Promise<WorkflowScheduledTrigger | null> {
  const { data, error } = await supabase
    .from('workflow_scheduled_triggers')
    .select('*')
    .eq('id', triggerId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getScheduledTriggersForWorkflow(
  workflowId: string
): Promise<WorkflowScheduledTrigger[]> {
  const { data, error } = await supabase
    .from('workflow_scheduled_triggers')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function pauseScheduledTrigger(triggerId: string): Promise<WorkflowScheduledTrigger> {
  const { data, error } = await supabase
    .from('workflow_scheduled_triggers')
    .update({ is_active: false })
    .eq('id', triggerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function resumeScheduledTrigger(triggerId: string): Promise<WorkflowScheduledTrigger> {
  const { data: current } = await supabase
    .from('workflow_scheduled_triggers')
    .select('cadence, time_of_day, timezone, day_of_week, day_of_month')
    .eq('id', triggerId)
    .single();

  if (!current) throw new Error('Trigger not found');

  const nextRunAt = calculateNextRunAt({
    cadence: current.cadence,
    time_of_day: current.time_of_day,
    timezone: current.timezone,
    day_of_week: current.day_of_week,
    day_of_month: current.day_of_month,
  });

  const { data, error } = await supabase
    .from('workflow_scheduled_triggers')
    .update({
      is_active: true,
      next_run_at: nextRunAt.toISOString(),
    })
    .eq('id', triggerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getScheduledTriggerHistory(
  triggerId: string,
  limit = 20,
  offset = 0
): Promise<ScheduledTriggerRun[]> {
  const { data, error } = await supabase
    .from('workflow_scheduled_trigger_runs')
    .select('*')
    .eq('trigger_id', triggerId)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export function previewSchedule(
  config: {
    cadence: ScheduledTriggerCadence;
    time_of_day: string;
    timezone?: string;
    day_of_week?: number | null;
    day_of_month?: number | null;
  },
  count = 5
): Date[] {
  const dates: Date[] = [];
  let current = calculateNextRunAt({
    cadence: config.cadence,
    time_of_day: config.time_of_day,
    timezone: config.timezone || 'UTC',
    day_of_week: config.day_of_week ?? null,
    day_of_month: config.day_of_month ?? null,
  });

  for (let i = 0; i < count; i++) {
    dates.push(new Date(current));
    current = calculateNextRunAtFrom(current, {
      cadence: config.cadence,
      time_of_day: config.time_of_day,
      timezone: config.timezone || 'UTC',
      day_of_week: config.day_of_week ?? null,
      day_of_month: config.day_of_month ?? null,
    });
  }

  return dates;
}

function calculateNextRunAt(config: {
  cadence: string;
  time_of_day: string;
  timezone: string;
  day_of_week: number | null;
  day_of_month: number | null;
}): Date {
  return calculateNextRunAtFrom(new Date(), config);
}

function calculateNextRunAtFrom(
  from: Date,
  config: {
    cadence: string;
    time_of_day: string;
    timezone: string;
    day_of_week: number | null;
    day_of_month: number | null;
  }
): Date {
  const [hours, minutes] = config.time_of_day.split(':').map(Number);
  const next = new Date(from);
  next.setHours(hours, minutes, 0, 0);

  switch (config.cadence) {
    case 'daily': {
      if (next <= from) {
        next.setDate(next.getDate() + 1);
      }
      break;
    }

    case 'weekly': {
      const targetDay = config.day_of_week ?? 1;
      const currentDay = from.getDay();
      let daysToAdd = targetDay - currentDay;

      if (daysToAdd < 0 || (daysToAdd === 0 && next <= from)) {
        daysToAdd += 7;
      }

      next.setDate(from.getDate() + daysToAdd);
      break;
    }

    case 'monthly': {
      const targetDayOfMonth = config.day_of_month ?? 1;
      next.setDate(targetDayOfMonth);

      if (next <= from) {
        next.setMonth(next.getMonth() + 1);
      }

      const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      if (targetDayOfMonth > lastDayOfMonth) {
        next.setDate(lastDayOfMonth);
      }
      break;
    }

    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
}

export const FILTER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'in_last_days', label: 'In the last X days' },
  { value: 'not_in_last_days', label: 'Not in the last X days' },
];

export const TAG_OPERATORS = [
  { value: 'includes', label: 'Includes any of' },
  { value: 'excludes', label: 'Excludes all of' },
  { value: 'includes_all', label: 'Includes all of' },
];

export const CONTACT_FILTER_FIELDS = [
  { value: 'status', label: 'Status', type: 'select' },
  { value: 'owner_id', label: 'Owner', type: 'user' },
  { value: 'department_id', label: 'Department', type: 'department' },
  { value: 'tags', label: 'Tags', type: 'tags' },
  { value: 'lead_score', label: 'Lead Score', type: 'number' },
  { value: 'created_at', label: 'Created Date', type: 'date' },
  { value: 'last_activity_at', label: 'Last Activity', type: 'date' },
  { value: 'source', label: 'Source', type: 'text' },
  { value: 'company', label: 'Company', type: 'text' },
  { value: 'city', label: 'City', type: 'text' },
  { value: 'state', label: 'State', type: 'text' },
  { value: 'country', label: 'Country', type: 'text' },
];

export const CADENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom_cron', label: 'Custom (Cron)' },
];

export const DAY_OF_WEEK_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const RE_ENROLLMENT_OPTIONS = [
  { value: 'never', label: 'Never re-enroll', description: 'Contact can only be enrolled once ever' },
  { value: 'always', label: 'Allow re-enrollment', description: 'Re-enroll if no active enrollment exists' },
  { value: 'after_completion', label: 'After completion', description: 'Re-enroll only after previous enrollment completes' },
];
