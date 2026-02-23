import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type {
  SocialAIThread,
  SocialAIMessage,
  SocialAIMessageType,
  SocialAIAttachment,
} from '../types';

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

export async function sendMessage(
  threadId: string,
  content: string,
  messageType: SocialAIMessageType = 'text',
  attachments: SocialAIAttachment[] = []
): Promise<{ userMessage: SocialAIMessage; aiMessage: SocialAIMessage }> {
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

  const response = await fetchEdge('ai-social-chat', {
    body: {
      thread_id: threadId,
      content,
      message_type: messageType,
      attachments,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `AI chat failed: ${response.status}`);
  }

  const aiResponse = await response.json();

  const fullContent = aiResponse.response || '';
  const drafts = aiResponse.drafts || [];

  const { data: aiMsg, error: aiError } = await supabase
    .from('social_ai_messages')
    .insert({
      thread_id: threadId,
      role: 'assistant',
      content: fullContent,
      message_type: drafts.length > 0 ? 'post_draft' : 'text',
      generated_posts: drafts.length > 0 ? drafts : null,
      metadata: { model_used: aiResponse.model_used || 'unknown' },
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

  return { userMessage: userMsg, aiMessage: aiMsg };
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
  const fullBody = [draft.hook, draft.body, draft.cta]
    .filter(Boolean)
    .join('\n\n');

  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      organization_id: orgId,
      created_by: userId,
      body: fullBody,
      targets,
      status: scheduledAtUtc ? 'scheduled' : 'draft',
      scheduled_at_utc: scheduledAtUtc || null,
      scheduled_timezone: 'UTC',
      media: [],
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
