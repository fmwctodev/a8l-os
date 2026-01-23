import { supabase } from '../lib/supabase';
import type { InboxEvent, InboxEventType } from '../types';

export async function getInboxEvents(
  conversationId: string,
  limit = 100
): Promise<InboxEvent[]> {
  const { data, error } = await supabase
    .from('inbox_events')
    .select(`
      *,
      actor:users!actor_user_id (
        id, name, avatar_url
      )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data as InboxEvent[];
}

export async function createInboxEvent(
  orgId: string,
  conversationId: string,
  eventType: InboxEventType,
  payload: Record<string, unknown>,
  actorUserId?: string | null
): Promise<InboxEvent> {
  const { data, error } = await supabase
    .from('inbox_events')
    .insert({
      organization_id: orgId,
      conversation_id: conversationId,
      event_type: eventType,
      payload,
      actor_user_id: actorUserId
    })
    .select()
    .single();

  if (error) throw error;
  return data as InboxEvent;
}

export async function getRecentEventsForOrg(
  orgId: string,
  eventTypes?: InboxEventType[],
  limit = 50
): Promise<InboxEvent[]> {
  let query = supabase
    .from('inbox_events')
    .select(`
      *,
      actor:users!actor_user_id (
        id, name, avatar_url
      ),
      conversation:conversations!conversation_id (
        id,
        contact:contacts!contact_id (
          id, first_name, last_name
        )
      )
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (eventTypes && eventTypes.length > 0) {
    query = query.in('event_type', eventTypes);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as InboxEvent[];
}
