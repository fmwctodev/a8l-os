import { supabase } from '../lib/supabase';
import type { ProjectChangeRequestComment } from '../types';

export async function getComments(
  changeRequestId: string,
  includeInternal: boolean
): Promise<ProjectChangeRequestComment[]> {
  let query = supabase
    .from('project_change_request_comments')
    .select('*, author_user:users!project_change_request_comments_author_user_id_fkey(id, name, avatar_url)')
    .eq('change_request_id', changeRequestId);

  if (!includeInternal) {
    query = query.eq('is_internal', false);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectChangeRequestComment[];
}

export async function addComment(params: {
  changeRequestId: string;
  orgId: string;
  body: string;
  isInternal: boolean;
  authorType: 'user' | 'client' | 'system';
  authorUserId?: string;
  authorName?: string;
}): Promise<ProjectChangeRequestComment> {
  const { data, error } = await supabase
    .from('project_change_request_comments')
    .insert({
      change_request_id: params.changeRequestId,
      org_id: params.orgId,
      body: params.body,
      is_internal: params.isInternal,
      author_type: params.authorType,
      author_user_id: params.authorUserId ?? null,
      author_name: params.authorName ?? null,
    })
    .select('*, author_user:users!project_change_request_comments_author_user_id_fkey(id, name, avatar_url)')
    .single();

  if (error) throw error;
  return data as ProjectChangeRequestComment;
}

export async function updateComment(
  id: string,
  body: string
): Promise<ProjectChangeRequestComment> {
  const { data, error } = await supabase
    .from('project_change_request_comments')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, author_user:users!project_change_request_comments_author_user_id_fkey(id, name, avatar_url)')
    .single();

  if (error) throw error;
  return data as ProjectChangeRequestComment;
}
