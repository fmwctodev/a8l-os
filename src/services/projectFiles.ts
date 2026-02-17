import { supabase } from '../lib/supabase';
import type { ProjectFile } from '../types';
import { logProjectActivity } from './projectActivityLog';

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from('project_files')
    .select('*, uploader:users!project_files_uploaded_by_fkey(id, name, avatar_url)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectFile[];
}

export async function attachFileToProject(
  orgId: string,
  projectId: string,
  fileName: string,
  actorUserId: string,
  options?: {
    drive_file_id?: string;
    google_drive_file_id?: string;
    mime_type?: string;
    size_bytes?: number;
    note?: string;
  }
): Promise<ProjectFile> {
  const { data, error } = await supabase
    .from('project_files')
    .insert({
      org_id: orgId,
      project_id: projectId,
      file_name: fileName,
      drive_file_id: options?.drive_file_id ?? null,
      google_drive_file_id: options?.google_drive_file_id ?? null,
      mime_type: options?.mime_type ?? null,
      size_bytes: options?.size_bytes ?? null,
      uploaded_by: actorUserId,
      note: options?.note ?? null,
    })
    .select('*, uploader:users!project_files_uploaded_by_fkey(id, name, avatar_url)')
    .single();

  if (error) throw error;

  await logProjectActivity({
    org_id: orgId,
    project_id: projectId,
    event_type: 'file_uploaded',
    summary: `File "${fileName}" attached`,
    payload: { file_id: data.id, file_name: fileName },
    actor_user_id: actorUserId,
  });

  return data as ProjectFile;
}

export async function removeProjectFile(
  fileId: string,
  orgId: string,
  projectId: string,
  fileName: string,
  actorUserId: string
): Promise<void> {
  const { error } = await supabase.from('project_files').delete().eq('id', fileId);
  if (error) throw error;

  await logProjectActivity({
    org_id: orgId,
    project_id: projectId,
    event_type: 'file_removed',
    summary: `File "${fileName}" removed`,
    payload: { file_id: fileId, file_name: fileName },
    actor_user_id: actorUserId,
  });
}
