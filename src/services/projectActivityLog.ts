import { supabase } from '../lib/supabase';
import type { ProjectActivityEvent, ProjectActivityEventType } from '../types';

export interface LogActivityInput {
  org_id: string;
  project_id: string;
  event_type: ProjectActivityEventType;
  summary: string;
  payload?: Record<string, unknown>;
  actor_user_id?: string | null;
}

export async function logProjectActivity(input: LogActivityInput): Promise<void> {
  const { error } = await supabase.from('project_activity_log').insert({
    org_id: input.org_id,
    project_id: input.project_id,
    event_type: input.event_type,
    summary: input.summary,
    payload: input.payload ?? {},
    actor_user_id: input.actor_user_id ?? null,
  });

  if (error) {
    console.error('Failed to log project activity:', error);
  }
}

export async function getProjectTimeline(
  projectId: string,
  eventTypeFilter?: ProjectActivityEventType
): Promise<ProjectActivityEvent[]> {
  let query = supabase
    .from('project_activity_log')
    .select('*, actor:users!project_activity_log_actor_user_id_fkey(id, name, avatar_url)')
    .eq('project_id', projectId);

  if (eventTypeFilter) {
    query = query.eq('event_type', eventTypeFilter);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectActivityEvent[];
}
