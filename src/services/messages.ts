import { supabase } from '../lib/supabase';
import type { Message, MessageChannel, MessageDirection, MessageStatus, MessageMetadata } from '../types';

export async function getMessages(
  conversationId: string,
  page = 1,
  pageSize = 50
): Promise<{ data: Message[]; hasMore: boolean }> {
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from('messages')
    .select('*', { count: 'exact' })
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (error) throw error;

  return {
    data: data as Message[],
    hasMore: (count || 0) > offset + pageSize
  };
}

export async function getRecentMessages(
  conversationId: string,
  limit = 20
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data as Message[]).reverse();
}

export async function createMessage(
  orgId: string,
  conversationId: string,
  contactId: string,
  channel: MessageChannel,
  direction: MessageDirection,
  body: string,
  metadata: MessageMetadata = {},
  subject?: string
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      organization_id: orgId,
      conversation_id: conversationId,
      contact_id: contactId,
      channel,
      direction,
      body,
      subject,
      metadata,
      status: direction === 'outbound' ? 'pending' : 'delivered',
      sent_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', conversationId);

  await supabase.from('contact_timeline').insert({
    contact_id: contactId,
    event_type: direction === 'inbound' ? 'message_received' : 'message_sent',
    event_data: {
      channel,
      message_id: data.id,
      preview: body.substring(0, 100)
    }
  });

  return data as Message;
}

export async function updateMessageStatus(
  id: string,
  status: MessageStatus,
  errorMessage?: string
): Promise<void> {
  const updateData: Record<string, unknown> = { status };

  if (errorMessage) {
    const { data: message } = await supabase
      .from('messages')
      .select('metadata')
      .eq('id', id)
      .single();

    updateData.metadata = {
      ...(message?.metadata || {}),
      error_message: errorMessage
    };
  }

  const { error } = await supabase
    .from('messages')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

export async function updateMessageExternalId(
  id: string,
  externalId: string
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ external_id: externalId })
    .eq('id', id);

  if (error) throw error;
}

export async function searchMessages(
  orgId: string,
  query: string,
  filters: {
    channels?: MessageChannel[];
    conversationId?: string;
    startDate?: string;
    endDate?: string;
  } = {},
  limit = 50
): Promise<Message[]> {
  let queryBuilder = supabase
    .from('messages')
    .select(`
      *,
      conversation:conversations!conversation_id (
        id,
        contact:contacts!contact_id (
          id, first_name, last_name
        )
      )
    `)
    .eq('organization_id', orgId)
    .ilike('body', `%${query}%`)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (filters.channels && filters.channels.length > 0) {
    queryBuilder = queryBuilder.in('channel', filters.channels);
  }

  if (filters.conversationId) {
    queryBuilder = queryBuilder.eq('conversation_id', filters.conversationId);
  }

  if (filters.startDate) {
    queryBuilder = queryBuilder.gte('sent_at', filters.startDate);
  }

  if (filters.endDate) {
    queryBuilder = queryBuilder.lte('sent_at', filters.endDate);
  }

  const { data, error } = await queryBuilder;
  if (error) throw error;

  return data as Message[];
}

export async function getMessageByExternalId(externalId: string): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('external_id', externalId)
    .maybeSingle();

  if (error) throw error;
  return data as Message | null;
}

export async function getLastMessageForConversation(conversationId: string): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .neq('direction', 'system')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as Message | null;
}
