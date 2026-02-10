import { supabase } from '../lib/supabase';
import type { Conversation, ConversationFilters, ConversationStatus, MessageChannel } from '../types';

export async function getConversations(
  orgId: string,
  filters: ConversationFilters = {},
  page = 1,
  pageSize = 50
): Promise<{ data: Conversation[]; count: number }> {
  let query = supabase
    .from('conversations')
    .select(`
      *,
      contact:contacts!contact_id (
        id, first_name, last_name, email, phone, company
      ),
      assigned_user:users!assigned_user_id (
        id, name, email, avatar_url
      ),
      department:departments!department_id (
        id, name
      )
    `, { count: 'exact' })
    .eq('organization_id', orgId)
    .order('last_message_at', { ascending: false });

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters.assignedUserId !== undefined) {
    if (filters.assignedUserId === null) {
      query = query.is('assigned_user_id', null);
    } else {
      query = query.eq('assigned_user_id', filters.assignedUserId);
    }
  }

  if (filters.departmentId) {
    query = query.eq('department_id', filters.departmentId);
  }

  if (filters.unreadOnly) {
    query = query.gt('unread_count', 0);
  }

  const offset = (page - 1) * pageSize;
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  let conversations = data as Conversation[];

  const convIds = conversations.map(c => c.id);
  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, id, body, channel, direction, sent_at, subject')
      .in('conversation_id', convIds)
      .is('hidden_at', null)
      .order('sent_at', { ascending: false });

    const lastMsgMap = new Map<string, Record<string, unknown>>();
    for (const m of msgs || []) {
      if (!lastMsgMap.has(m.conversation_id)) {
        lastMsgMap.set(m.conversation_id, m);
      }
    }

    conversations = conversations.map(c => ({
      ...c,
      last_message: lastMsgMap.get(c.id) as Conversation['last_message'],
    }));
  }

  if (filters.channels && filters.channels.length > 0) {
    const conversationIds = conversations.map(c => c.id);
    const { data: messages } = await supabase
      .from('messages')
      .select('conversation_id, channel')
      .in('conversation_id', conversationIds)
      .in('channel', filters.channels);

    const validConversationIds = new Set(messages?.map(m => m.conversation_id) || []);
    conversations = conversations.filter(c => validConversationIds.has(c.id));
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    conversations = conversations.filter(c => {
      const contact = c.contact;
      if (!contact) return false;
      const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
      return (
        fullName.includes(searchLower) ||
        contact.email?.toLowerCase().includes(searchLower) ||
        contact.phone?.includes(searchLower)
      );
    });
  }

  return { data: conversations, count: count || 0 };
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      contact:contacts!contact_id (
        id, first_name, last_name, email, phone, company, job_title,
        tags:contact_tags(tag:tags(*))
      ),
      assigned_user:users!assigned_user_id (
        id, name, email, avatar_url
      ),
      department:departments!department_id (
        id, name
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const contact = data.contact as Record<string, unknown> | null;
  if (contact && contact.tags) {
    contact.tags = (contact.tags as Array<{ tag: unknown }>).map((ct) => ct.tag);
  }

  return data as Conversation;
}

export async function findOrCreateConversation(
  orgId: string,
  contactId: string,
  departmentId: string | null = null
): Promise<Conversation> {
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('contact_id', contactId)
    .neq('status', 'closed')
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing as Conversation;

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      organization_id: orgId,
      contact_id: contactId,
      department_id: departmentId,
      status: 'open',
      unread_count: 0
    })
    .select()
    .single();

  if (error) throw error;
  return data as Conversation;
}

export async function updateConversationStatus(
  id: string,
  status: ConversationStatus,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;

  const { data: conversation } = await supabase
    .from('conversations')
    .select('organization_id')
    .eq('id', id)
    .single();

  if (conversation) {
    await supabase.from('inbox_events').insert({
      organization_id: conversation.organization_id,
      conversation_id: id,
      event_type: 'status_changed',
      payload: { new_status: status },
      actor_user_id: userId
    });
  }
}

export async function assignConversation(
  id: string,
  assignedUserId: string | null,
  actorUserId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({
      assigned_user_id: assignedUserId,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;

  const { data: conversation } = await supabase
    .from('conversations')
    .select('organization_id')
    .eq('id', id)
    .single();

  if (conversation) {
    await supabase.from('inbox_events').insert({
      organization_id: conversation.organization_id,
      conversation_id: id,
      event_type: 'assigned',
      payload: { assigned_user_id: assignedUserId },
      actor_user_id: actorUserId
    });
  }
}

export async function markConversationAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({
      unread_count: 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
}

export async function incrementUnreadCount(id: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('conversations')
    .select('unread_count')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('conversations')
    .update({
      unread_count: (data?.unread_count || 0) + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
}

export async function getUnreadCountByUser(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('conversations')
    .select('unread_count')
    .or(`assigned_user_id.eq.${userId},assigned_user_id.is.null`)
    .gt('unread_count', 0);

  if (error) throw error;

  return data?.reduce((sum, c) => sum + (c.unread_count || 0), 0) || 0;
}

export async function getConversationChannels(conversationId: string): Promise<MessageChannel[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('channel')
    .eq('conversation_id', conversationId);

  if (error) throw error;

  const channels = new Set(data?.map(m => m.channel as MessageChannel) || []);
  return Array.from(channels);
}
