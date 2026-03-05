import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';
import type { SocialPostComment, SocialPostCommentPost, SocialCommentFilters } from '../types';

export async function getCommentPosts(
  orgId: string,
  filters: SocialCommentFilters = {}
): Promise<SocialPostCommentPost[]> {
  let query = supabase
    .from('social_post_comment_posts')
    .select(`
      *,
      comments:social_post_comments (
        id, late_comment_id, author_name, author_handle, author_avatar_url,
        text, like_count, reply_count, is_reply, hidden, has_private_reply,
        platform, actioned_at, comment_created_at, created_at
      )
    `)
    .eq('organization_id', orgId)
    .order('last_comment_at', { ascending: false });

  if (filters.platform) {
    query = query.eq('platform', filters.platform);
  }

  if (filters.lateAccountId) {
    query = query.eq('late_account_id', filters.lateAccountId);
  }

  if (filters.startDate) {
    query = query.gte('last_comment_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('last_comment_at', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as SocialPostCommentPost[];
}

export async function getCommentsForPost(
  orgId: string,
  latePostId: string
): Promise<SocialPostComment[]> {
  const { data, error } = await supabase
    .from('social_post_comments')
    .select('*')
    .eq('organization_id', orgId)
    .eq('late_post_id', latePostId)
    .order('comment_created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as SocialPostComment[];
}

export async function syncComments(orgId: string): Promise<{
  posts_synced: number;
  comments_synced: number;
  accounts_processed: number;
  errors: string[];
}> {
  const result = await callEdgeFunction('late-inbox-comments-sync', {
    method: 'POST',
    body: { org_id: orgId },
  });
  return result as {
    posts_synced: number;
    comments_synced: number;
    accounts_processed: number;
    errors: string[];
  };
}

export async function hideComment(
  orgId: string,
  lateCommentId: string,
  lateAccountId: string
): Promise<void> {
  await callEdgeFunction('late-inbox-comments-sync', {
    method: 'POST',
    body: {
      org_id: orgId,
      action: 'hide',
      late_comment_id: lateCommentId,
      late_account_id: lateAccountId,
    },
  });

  await supabase
    .from('social_post_comments')
    .update({ hidden: true, updated_at: new Date().toISOString() })
    .eq('organization_id', orgId)
    .eq('late_comment_id', lateCommentId);
}

export async function replyToComment(
  orgId: string,
  lateCommentId: string,
  latePostId: string,
  lateAccountId: string,
  replyText: string
): Promise<void> {
  await callEdgeFunction('late-inbox-comments-sync', {
    method: 'POST',
    body: {
      org_id: orgId,
      action: 'reply',
      late_comment_id: lateCommentId,
      late_post_id: latePostId,
      late_account_id: lateAccountId,
      reply_text: replyText,
    },
  });
}

export async function markCommentActioned(
  orgId: string,
  commentId: string,
  userId: string
): Promise<void> {
  await supabase
    .from('social_post_comments')
    .update({
      actioned_at: new Date().toISOString(),
      actioned_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', orgId)
    .eq('id', commentId);
}

export async function getLastCommentsSyncedAt(
  orgId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('late_connections')
    .select('last_comments_synced_at')
    .eq('org_id', orgId)
    .eq('status', 'connected')
    .not('last_comments_synced_at', 'is', null)
    .order('last_comments_synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.last_comments_synced_at || null;
}
