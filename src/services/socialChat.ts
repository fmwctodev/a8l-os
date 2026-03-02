import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type {
  SocialAIThread,
  SocialAIMessage,
  SocialAIMessageType,
  SocialAIAttachment,
} from '../types';
import type { MediaAsset } from './mediaGeneration';

export interface MediaJobInfo {
  job_id: string;
  model_id: string;
  model_name: string;
  media_type: 'image' | 'video';
  prompt: string;
  status: string;
  draft_index: number;
  preloadedAssets?: MediaAsset[];
}

/**
 * Media preferences for social chat. Text generation model (GPT-5.2) and image
 * model (Nano Banana 2) are server-controlled and not configurable from the client.
 * Only video model selection is user-facing.
 */
export interface MediaPreferences {
  video_model_id?: string;
  aspect_ratio?: string;
  auto_generate_media?: boolean;
  style_preset_id?: string;
}

export interface SendMessageResult {
  userMessage: SocialAIMessage;
  aiMessage: SocialAIMessage;
  mediaJobs: MediaJobInfo[];
  mediaSkippedReason?: string;
}

export async function getThreads(
  orgId: string,
  userId: string
): Promise<SocialAIThread[]> {
  const { data, error } = await supabase
    .from('social_ai_threads')
    .select('*')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getThreadById(
  threadId: string
): Promise<SocialAIThread | null> {
  const { data, error } = await supabase
    .from('social_ai_threads')
    .select('*')
    .eq('id', threadId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getThreadMessages(
  threadId: string
): Promise<SocialAIMessage[]> {
  const { data, error } = await supabase
    .from('social_ai_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createThread(
  orgId: string,
  userId: string,
  title?: string
): Promise<SocialAIThread> {
  const { data, error } = await supabase
    .from('social_ai_threads')
    .insert({
      organization_id: orgId,
      user_id: userId,
      title: title || 'New conversation',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Send a message to the social AI chat. The text model is locked server-side
 * to GPT-5.2 and cannot be overridden from the request body. Do not add a
 * text model parameter here -- the backend will reject it with a 400.
 */
export async function sendMessage(
  threadId: string,
  content: string,
  messageType: SocialAIMessageType = 'text',
  attachments: SocialAIAttachment[] = [],
  mediaPrefs?: MediaPreferences
): Promise<SendMessageResult> {
  const { data: userMsg, error: userError } = await supabase
    .from('social_ai_messages')
    .insert({
      thread_id: threadId,
      role: 'user',
      content,
      message_type: messageType,
      attachments,
    })
    .select()
    .single();

  if (userError) throw userError;

  let aiResponse: { response?: string; drafts?: unknown[]; media_jobs?: MediaJobInfo[]; media_skipped_reason?: string; model_used?: string };

  try {
    const response = await fetchEdge('ai-social-chat', {
      body: {
        thread_id: threadId,
        content,
        message_type: messageType,
        attachments,
        ...(mediaPrefs?.video_model_id && { video_model_id: mediaPrefs.video_model_id }),
        ...(mediaPrefs?.aspect_ratio && { aspect_ratio: mediaPrefs.aspect_ratio }),
        ...(mediaPrefs?.style_preset_id && { style_preset_id: mediaPrefs.style_preset_id }),
        auto_generate_media: mediaPrefs?.auto_generate_media ?? true,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.msg || `AI chat failed: ${response.status}`);
    }

    aiResponse = await response.json();
  } catch (edgeErr) {
    await supabase
      .from('social_ai_messages')
      .delete()
      .eq('id', userMsg.id);
    throw edgeErr;
  }

  const cleanContent = aiResponse.response || '';
  const drafts = aiResponse.drafts || [];
  const mediaJobs: MediaJobInfo[] = aiResponse.media_jobs || [];

  let fullContent = cleanContent;
  if (drafts.length > 0) {
    const draftBlocks = drafts
      .map((d) => `\n---DRAFT---\n${JSON.stringify(d)}\n---END_DRAFT---`)
      .join('');
    fullContent = cleanContent + draftBlocks;
  }

  const { data: aiMsg, error: aiError } = await supabase
    .from('social_ai_messages')
    .insert({
      thread_id: threadId,
      role: 'assistant',
      content: fullContent,
      message_type: drafts.length > 0 ? 'post_draft' : 'text',
      generated_posts: drafts.length > 0 ? drafts : null,
      metadata: {
        model_used: aiResponse.model_used || 'unknown',
        media_jobs: mediaJobs.length > 0 ? mediaJobs : undefined,
        media_skipped_reason: aiResponse.media_skipped_reason || undefined,
      },
    })
    .select()
    .single();

  if (aiError) throw aiError;

  const titleSnippet = content.slice(0, 60) + (content.length > 60 ? '...' : '');
  await supabase
    .from('social_ai_threads')
    .update({ updated_at: new Date().toISOString(), title: titleSnippet })
    .eq('id', threadId)
    .eq('title', 'New conversation');

  await supabase
    .from('social_ai_threads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', threadId);

  return { userMessage: userMsg, aiMessage: aiMsg, mediaJobs, mediaSkippedReason: aiResponse.media_skipped_reason };
}

export async function archiveThread(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('social_ai_threads')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', threadId);

  if (error) throw error;
}

export async function deleteThread(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('social_ai_threads')
    .delete()
    .eq('id', threadId);

  if (error) throw error;
}

export type PublishMode = 'draft' | 'schedule' | 'post_now';

export interface PublishDraftParams {
  orgId: string;
  userId: string;
  draft: {
    platform: string;
    hook: string;
    body: string;
    cta: string;
    hashtags: string[];
    visual_style_suggestion?: string;
    engagement_prediction?: number;
  };
  accountIds: string[];
  mode: PublishMode;
  scheduledAtUtc?: string;
  media?: Array<{ url: string; type: string; thumbnail_url?: string }>;
  mediaAssetIds?: string[];
  threadId?: string;
}

export async function publishDraftFromChat(params: PublishDraftParams): Promise<string> {
  const { orgId, userId, draft, accountIds, mode, scheduledAtUtc, media, mediaAssetIds, threadId } = params;

  const fullBody = [draft.hook, draft.body, draft.cta]
    .filter(Boolean)
    .join('\n\n');

  let status: string;
  let scheduleTime: string | null = null;

  if (mode === 'post_now') {
    status = 'scheduled';
    scheduleTime = new Date().toISOString();
  } else if (mode === 'schedule') {
    status = 'scheduled';
    scheduleTime = scheduledAtUtc || null;
  } else {
    status = 'draft';
  }

  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      organization_id: orgId,
      created_by: userId,
      body: fullBody,
      targets: accountIds,
      status,
      scheduled_at_utc: scheduleTime,
      scheduled_timezone: 'UTC',
      media: media || [],
      media_asset_ids: mediaAssetIds || [],
      hook_text: draft.hook,
      cta_text: draft.cta,
      hashtags: draft.hashtags,
      visual_style_suggestion: draft.visual_style_suggestion || null,
      engagement_prediction: draft.engagement_prediction || null,
      thread_id: threadId || null,
      ai_generated: true,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function schedulePostFromDraft(
  orgId: string,
  userId: string,
  draft: {
    platform: string;
    hook: string;
    body: string;
    cta: string;
    hashtags: string[];
    visual_style_suggestion?: string;
    engagement_prediction?: number;
  },
  targets: string[],
  scheduledAtUtc?: string,
  threadId?: string
): Promise<string> {
  return publishDraftFromChat({
    orgId,
    userId,
    draft,
    accountIds: targets,
    mode: scheduledAtUtc ? 'schedule' : 'draft',
    scheduledAtUtc,
    threadId,
  });
}
