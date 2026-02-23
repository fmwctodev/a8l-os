import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';
import type {
  AssistantThread,
  AssistantMessage,
  ClaraPageContext,
  ClaraChatResponse,
} from '../types/assistant';

export async function getThreads(userId: string): Promise<AssistantThread[]> {
  const { data, error } = await supabase
    .from('assistant_threads')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as AssistantThread[];
}

export async function createThread(
  userId: string,
  orgId: string,
  contextModule?: string | null,
  contextRecordId?: string | null
): Promise<AssistantThread> {
  const { data, error } = await supabase
    .from('assistant_threads')
    .insert({
      user_id: userId,
      org_id: orgId,
      context_module: contextModule || null,
      context_record_id: contextRecordId || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as AssistantThread;
}

export async function getThreadMessages(threadId: string): Promise<AssistantMessage[]> {
  const { data, error } = await supabase
    .from('assistant_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as AssistantMessage[];
}

export async function sendMessage(
  threadId: string,
  content: string,
  context: ClaraPageContext
): Promise<{
  userMessage: AssistantMessage;
  assistantMessage: AssistantMessage;
  chatResponse: ClaraChatResponse;
}> {
  const { data: userMsg, error: userError } = await supabase
    .from('assistant_messages')
    .insert({
      thread_id: threadId,
      role: 'user',
      content,
      message_type: 'text',
    })
    .select('*')
    .single();

  if (userError) throw userError;

  await supabase
    .from('assistant_threads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', threadId);

  const response = await callEdgeFunction('assistant-chat', {
    thread_id: threadId,
    content,
    context,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to get assistant response');
  }

  const chatResponse: ClaraChatResponse = await response.json();

  let messageType: AssistantMessage['message_type'] = 'text';
  if (chatResponse.confirmations_pending?.length > 0) messageType = 'action_confirmation';
  else if (chatResponse.drafts?.length > 0) messageType = 'draft_preview';

  const { data: assistantMsg, error: assistantError } = await supabase
    .from('assistant_messages')
    .insert({
      thread_id: threadId,
      role: 'assistant',
      content: chatResponse.response,
      message_type: messageType,
      tool_calls: chatResponse.tool_calls?.length > 0 ? chatResponse.tool_calls : null,
      metadata: {
        confirmations: chatResponse.confirmations_pending || [],
        drafts: chatResponse.drafts || [],
        model_used: chatResponse.model_used,
      },
    })
    .select('*')
    .single();

  if (assistantError) throw assistantError;

  return {
    userMessage: userMsg as AssistantMessage,
    assistantMessage: assistantMsg as AssistantMessage,
    chatResponse,
  };
}

export async function confirmAction(
  threadId: string,
  confirmationId: string,
  approved: boolean
): Promise<ClaraChatResponse> {
  const response = await callEdgeFunction('assistant-chat', {
    thread_id: threadId,
    action: 'confirm',
    confirmation_id: confirmationId,
    approved,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to process confirmation');
  }

  return response.json();
}

export async function archiveThread(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('assistant_threads')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', threadId);

  if (error) throw error;
}

export async function deleteThread(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('assistant_threads')
    .delete()
    .eq('id', threadId);

  if (error) throw error;
}

export async function updateThreadTitle(threadId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('assistant_threads')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', threadId);

  if (error) throw error;
}

export function subscribeToMessages(
  threadId: string,
  onMessage: (msg: AssistantMessage) => void
) {
  const channel = supabase
    .channel(`assistant-messages-${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'assistant_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        onMessage(payload.new as AssistantMessage);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
