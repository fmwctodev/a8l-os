import { supabase } from '../lib/supabase';
import type { AIReportSchedule, ReportScope } from '../types/aiReports';

const SCHEDULE_SELECT = `
  *,
  user:users!ai_report_schedules_user_id_fkey(id, name, email, avatar_url),
  original_report:ai_reports(id, report_name, report_category)
`;

export async function getSchedules(organizationId: string): Promise<AIReportSchedule[]> {
  const { data, error } = await supabase
    .from('ai_report_schedules')
    .select(SCHEDULE_SELECT)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as AIReportSchedule[];
}

export async function getSchedulesByReportId(reportId: string): Promise<AIReportSchedule[]> {
  const { data, error } = await supabase
    .from('ai_report_schedules')
    .select(SCHEDULE_SELECT)
    .eq('original_report_id', reportId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as AIReportSchedule[];
}

export async function createSchedule(
  organizationId: string,
  userId: string,
  params: {
    reportId?: string;
    cadenceDays: number;
    reportNameTemplate: string;
    scope: ReportScope;
    promptTemplate: string;
    planTemplate?: Record<string, unknown>;
  }
): Promise<AIReportSchedule> {
  const nextRunAt = new Date(Date.now() + params.cadenceDays * 86400000).toISOString();

  const { data, error } = await supabase
    .from('ai_report_schedules')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      original_report_id: params.reportId || null,
      cadence_days: params.cadenceDays,
      next_run_at: nextRunAt,
      is_active: true,
      report_name_template: params.reportNameTemplate,
      scope: params.scope,
      prompt_template: params.promptTemplate,
      report_plan_template_json: params.planTemplate || {},
    })
    .select(SCHEDULE_SELECT)
    .single();

  if (error) throw error;
  return data as AIReportSchedule;
}

export async function updateSchedule(
  scheduleId: string,
  params: {
    cadenceDays?: number;
    isActive?: boolean;
    reportNameTemplate?: string;
    promptTemplate?: string;
  }
): Promise<AIReportSchedule> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (params.cadenceDays !== undefined) {
    updates.cadence_days = params.cadenceDays;
    updates.next_run_at = new Date(Date.now() + params.cadenceDays * 86400000).toISOString();
  }
  if (params.isActive !== undefined) updates.is_active = params.isActive;
  if (params.reportNameTemplate !== undefined) updates.report_name_template = params.reportNameTemplate;
  if (params.promptTemplate !== undefined) updates.prompt_template = params.promptTemplate;

  const { data, error } = await supabase
    .from('ai_report_schedules')
    .update(updates)
    .eq('id', scheduleId)
    .select(SCHEDULE_SELECT)
    .single();

  if (error) throw error;
  return data as AIReportSchedule;
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_report_schedules')
    .delete()
    .eq('id', scheduleId);

  if (error) throw error;
}

export async function toggleSchedule(scheduleId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('ai_report_schedules')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', scheduleId);

  if (error) throw error;
}

export const CADENCE_OPTIONS = [
  { value: 7, label: 'Every 7 days' },
  { value: 14, label: 'Every 14 days' },
  { value: 30, label: 'Every 30 days' },
  { value: 60, label: 'Every 60 days' },
  { value: 90, label: 'Every 90 days' },
] as const;
