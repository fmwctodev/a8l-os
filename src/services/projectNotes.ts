import { supabase } from '../lib/supabase';
import type { ProjectNote } from '../types';
import { logProjectActivity } from './projectActivityLog';

export async function getProjectNotes(projectId: string): Promise<ProjectNote[]> {
  const { data, error } = await supabase
    .from('project_notes')
    .select('*, created_by_user:users!project_notes_created_by_fkey(id, name, avatar_url)')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectNote[];
}

export async function createProjectNote(
  orgId: string,
  projectId: string,
  body: string,
  actorUserId: string
): Promise<ProjectNote> {
  const { data, error } = await supabase
    .from('project_notes')
    .insert({
      org_id: orgId,
      project_id: projectId,
      body,
      created_by: actorUserId,
    })
    .select('*, created_by_user:users!project_notes_created_by_fkey(id, name, avatar_url)')
    .single();

  if (error) throw error;

  await logProjectActivity({
    org_id: orgId,
    project_id: projectId,
    event_type: 'note_added',
    summary: 'Note added',
    payload: { note_id: data.id },
    actor_user_id: actorUserId,
  });

  return data as ProjectNote;
}

export async function updateProjectNote(
  id: string,
  body: string
): Promise<ProjectNote> {
  const { data, error } = await supabase
    .from('project_notes')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, created_by_user:users!project_notes_created_by_fkey(id, name, avatar_url)')
    .single();

  if (error) throw error;
  return data as ProjectNote;
}

export async function deleteProjectNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('project_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
