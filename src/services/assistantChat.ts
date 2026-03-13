import { supabase } from '../lib/supabase';
import { callEdgeFunction, streamEdgeFunction, parseSSEStream } from '../lib/edgeFunction';
import type { SSEEvent } from '../lib/edgeFunction';
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
    let errMsg = 'Failed to get assistant response';
    try {
      const err = await response.json();
      const errObj = err.error;
      if (typeof errObj === 'string') errMsg = errObj;
      else if (errObj?.message) errMsg = errObj.message;
      else if (err.message) errMsg = err.message;
      else if (err.msg) errMsg = err.msg;
    } catch { /* response wasn't JSON */ }
    throw new Error(errMsg);
  }

  const chatResponse: ClaraChatResponse = await response.json();

  let messageType: AssistantMessage['message_type'] = 'text';
  if (chatResponse.its_request?.requires_confirmation && chatResponse.its_request.actions.length > 0) {
    messageType = 'execution_plan';
  } else if (chatResponse.execution_result) {
    messageType = 'execution_result';
  } else if (chatResponse.confirmations_pending?.length > 0) {
    messageType = 'action_confirmation';
  } else if (chatResponse.drafts?.length > 0) {
    messageType = 'draft_preview';
  }

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
        its_request: chatResponse.its_request || null,
        execution_result: chatResponse.execution_result || null,
        execution_request_id: chatResponse.execution_request_id || null,
        permission_denied: chatResponse.permission_denied || [],
        integration_errors: chatResponse.integration_errors || [],
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

export interface StreamingChatResult {
  userMessage: AssistantMessage;
  stream: AsyncGenerator<SSEEvent>;
  abort: () => void;
}

export async function sendMessageStreaming(
  threadId: string,
  content: string,
  context: ClaraPageContext
): Promise<StreamingChatResult> {
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

  const response = await streamEdgeFunction('assistant-chat', {
    thread_id: threadId,
    content,
    context,
    stream: true,
  });

  if (!response.ok) {
    let errMsg = 'Failed to get assistant response';
    try {
      const err = await response.json();
      if (typeof err.error === 'string') errMsg = err.error;
      else if (err.error?.message) errMsg = err.error.message;
    } catch { /* not JSON */ }
    throw new Error(errMsg);
  }

  const reader = response.body!.getReader();
  const stream = parseSSEStream(reader);

  return {
    userMessage: userMsg as AssistantMessage,
    stream,
    abort: () => reader.cancel(),
  };
}

export async function persistStreamedAssistantMessage(
  threadId: string,
  fullResponse: string,
  metadata: Record<string, unknown>
): Promise<AssistantMessage> {
  let messageType: AssistantMessage['message_type'] = 'text';
  if (metadata.its_request && (metadata.its_request as Record<string, unknown>).requires_confirmation) {
    messageType = 'execution_plan';
  } else if (metadata.execution_result) {
    messageType = 'execution_result';
  }

  const { data: assistantMsg, error } = await supabase
    .from('assistant_messages')
    .insert({
      thread_id: threadId,
      role: 'assistant',
      content: fullResponse,
      message_type: messageType,
      tool_calls: null,
      metadata,
    })
    .select('*')
    .single();

  if (error) throw error;
  return assistantMsg as AssistantMessage;
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
    let errMsg = 'Failed to process confirmation';
    try {
      const err = await response.json();
      const errObj = err.error;
      if (typeof errObj === 'string') errMsg = errObj;
      else if (errObj?.message) errMsg = errObj.message;
    } catch { /* response wasn't JSON */ }
    throw new Error(errMsg);
  }

  return response.json();
}

export async function confirmExecutionRequest(
  threadId: string,
  executionRequestId: string,
  approved: boolean,
  actionIds?: string[]
): Promise<ClaraChatResponse> {
  const response = await callEdgeFunction('assistant-chat', {
    thread_id: threadId,
    action: 'confirm',
    execution_request_id: executionRequestId,
    approved,
    action_ids: actionIds,
  });

  if (!response.ok) {
    let errMsg = 'Failed to process execution confirmation';
    try {
      const err = await response.json();
      const errObj = err.error;
      if (typeof errObj === 'string') errMsg = errObj;
      else if (errObj?.message) errMsg = errObj.message;
    } catch { /* response wasn't JSON */ }
    throw new Error(errMsg);
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
