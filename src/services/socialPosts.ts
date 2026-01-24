import { supabase } from '../lib/supabase';
import type {
  SocialPost,
  SocialPostLog,
  SocialPostMedia,
  SocialPostFilters,
  SocialPostStatus,
} from '../types';

export async function getSocialPosts(
  organizationId: string,
  filters?: SocialPostFilters
): Promise<SocialPost[]> {
  let query = supabase
    .from('social_posts')
    .select(`
      *,
      created_by_user:users!social_posts_created_by_fkey(id, name, email, avatar_url),
      approved_by_user:users!social_posts_approved_by_fkey(id, name, email, avatar_url)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.startDate) {
    query = query.gte('scheduled_at_utc', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('scheduled_at_utc', filters.endDate);
  }

  if (filters?.search) {
    query = query.ilike('body', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getSocialPostById(id: string): Promise<SocialPost | null> {
  const { data, error } = await supabase
    .from('social_posts')
    .select(`
      *,
      created_by_user:users!social_posts_created_by_fkey(id, name, email, avatar_url),
      approved_by_user:users!social_posts_approved_by_fkey(id, name, email, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCalendarPosts(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select(`
      *,
      created_by_user:users!social_posts_created_by_fkey(id, name, email, avatar_url)
    `)
    .eq('organization_id', organizationId)
    .gte('scheduled_at_utc', startDate)
    .lte('scheduled_at_utc', endDate)
    .in('status', ['scheduled', 'queued', 'posting', 'posted', 'failed'])
    .order('scheduled_at_utc', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createSocialPost(
  organizationId: string,
  userId: string,
  data: {
    body: string;
    media?: SocialPostMedia[];
    targets: string[];
    scheduledAtUtc?: string;
    scheduledTimezone?: string;
    requiresApproval?: boolean;
    firstComment?: string;
    linkUrl?: string;
    aiGenerated?: boolean;
    aiGenerationId?: string;
  }
): Promise<SocialPost> {
  const status: SocialPostStatus = data.scheduledAtUtc ? 'scheduled' : 'draft';

  const insertData: Record<string, unknown> = {
    organization_id: organizationId,
    created_by: userId,
    body: data.body,
    media: data.media || [],
    targets: data.targets,
    status,
    scheduled_at_utc: data.scheduledAtUtc || null,
    scheduled_timezone: data.scheduledTimezone || 'UTC',
    requires_approval: data.requiresApproval || false,
  };

  if (data.firstComment) {
    insertData.first_comment = data.firstComment;
  }

  if (data.linkUrl) {
    insertData.link_preview = { url: data.linkUrl };
  }

  if (data.aiGenerated) {
    insertData.ai_generated = true;
    if (data.aiGenerationId) {
      insertData.ai_generation_id = data.aiGenerationId;
    }
  }

  const { data: post, error } = await supabase
    .from('social_posts')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;

  await createPostLog(post.id, null, 'created', {});

  if (status === 'scheduled') {
    await createPostLog(post.id, null, 'scheduled', {
      scheduled_at: data.scheduledAtUtc,
    });
  }

  return post;
}

export async function updateSocialPost(
  id: string,
  updates: {
    body?: string;
    media?: SocialPostMedia[];
    targets?: string[];
    scheduledAtUtc?: string;
    scheduledTimezone?: string;
    requiresApproval?: boolean;
    firstComment?: string;
    linkUrl?: string;
  }
): Promise<SocialPost> {
  const updateData: Record<string, unknown> = {};

  if (updates.body !== undefined) updateData.body = updates.body;
  if (updates.media !== undefined) updateData.media = updates.media;
  if (updates.targets !== undefined) updateData.targets = updates.targets;
  if (updates.scheduledAtUtc !== undefined) updateData.scheduled_at_utc = updates.scheduledAtUtc;
  if (updates.scheduledTimezone !== undefined) updateData.scheduled_timezone = updates.scheduledTimezone;
  if (updates.requiresApproval !== undefined) updateData.requires_approval = updates.requiresApproval;
  if (updates.firstComment !== undefined) updateData.first_comment = updates.firstComment;
  if (updates.linkUrl !== undefined) updateData.link_preview = { url: updates.linkUrl };

  const { data, error } = await supabase
    .from('social_posts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function schedulePost(
  id: string,
  scheduledAtUtc: string,
  scheduledTimezone: string = 'UTC'
): Promise<SocialPost> {
  const { data, error } = await supabase
    .from('social_posts')
    .update({
      status: 'scheduled',
      scheduled_at_utc: scheduledAtUtc,
      scheduled_timezone: scheduledTimezone,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await createPostLog(id, null, 'scheduled', { scheduled_at: scheduledAtUtc });

  return data;
}

export async function approvePost(id: string, userId: string): Promise<SocialPost> {
  const { data, error } = await supabase
    .from('social_posts')
    .update({
      approved_by: userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await createPostLog(id, null, 'approved', { approved_by: userId });

  return data;
}

export async function cancelPost(id: string): Promise<SocialPost> {
  const { data, error } = await supabase
    .from('social_posts')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await createPostLog(id, null, 'cancelled', {});

  return data;
}

export async function duplicatePost(
  id: string,
  userId: string
): Promise<SocialPost> {
  const original = await getSocialPostById(id);
  if (!original) throw new Error('Post not found');

  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      organization_id: original.organization_id,
      created_by: userId,
      body: original.body,
      media: original.media,
      targets: original.targets,
      status: 'draft',
      scheduled_timezone: original.scheduled_timezone,
      requires_approval: original.requires_approval,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSocialPost(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_posts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getPostLogs(postId: string): Promise<SocialPostLog[]> {
  const { data, error } = await supabase
    .from('social_post_logs')
    .select(`
      *,
      account:social_accounts(id, provider, display_name, profile_image_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createPostLog(
  postId: string,
  accountId: string | null,
  action: SocialPostLog['action'],
  details: Record<string, unknown>
): Promise<SocialPostLog> {
  const { data, error } = await supabase
    .from('social_post_logs')
    .insert({
      post_id: postId,
      account_id: accountId,
      action,
      details,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function getCharacterLimits(): Record<string, { text: number; title?: number }> {
  return {
    facebook: { text: 63206 },
    instagram: { text: 2200 },
    linkedin: { text: 3000 },
    google_business: { text: 1500 },
    tiktok: { text: 2200 },
    youtube: { text: 5000, title: 100 },
  };
}

export function getMediaRequirements(): Record<string, {
  maxImages: number;
  maxVideoLength: number;
  supportedImageFormats: string[];
  supportedVideoFormats: string[];
}> {
  return {
    facebook: {
      maxImages: 10,
      maxVideoLength: 240,
      supportedImageFormats: ['jpg', 'png', 'gif', 'webp'],
      supportedVideoFormats: ['mp4', 'mov'],
    },
    instagram: {
      maxImages: 10,
      maxVideoLength: 60,
      supportedImageFormats: ['jpg', 'png'],
      supportedVideoFormats: ['mp4', 'mov'],
    },
    linkedin: {
      maxImages: 9,
      maxVideoLength: 600,
      supportedImageFormats: ['jpg', 'png', 'gif'],
      supportedVideoFormats: ['mp4'],
    },
    google_business: {
      maxImages: 10,
      maxVideoLength: 30,
      supportedImageFormats: ['jpg', 'png'],
      supportedVideoFormats: ['mp4'],
    },
    tiktok: {
      maxImages: 0,
      maxVideoLength: 180,
      supportedImageFormats: [],
      supportedVideoFormats: ['mp4', 'webm'],
    },
    youtube: {
      maxImages: 0,
      maxVideoLength: 43200,
      supportedImageFormats: [],
      supportedVideoFormats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'],
    },
  };
}
