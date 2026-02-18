import { supabase } from '../lib/supabase';
import type { EventOutbox, WorkflowTriggerType } from '../types';

type EntityType = 'contact' | 'conversation' | 'appointment' | 'message' | 'invoice' | 'recurring_profile';

export async function publishEvent(
  orgId: string,
  eventType: WorkflowTriggerType,
  entityType: EntityType,
  entityId: string,
  contactId: string | null,
  payload: Record<string, unknown> = {}
): Promise<EventOutbox> {
  const { data, error } = await supabase
    .from('event_outbox')
    .insert({
      org_id: orgId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      contact_id: contactId,
      payload
    })
    .select()
    .single();

  if (error) throw error;
  return data as EventOutbox;
}

export async function getUnprocessedEvents(
  limit = 100
): Promise<EventOutbox[]> {
  const { data, error } = await supabase
    .from('event_outbox')
    .select('*')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data as EventOutbox[];
}

export async function markEventProcessed(id: string): Promise<void> {
  const { error } = await supabase
    .from('event_outbox')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function markEventsProcessed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await supabase
    .from('event_outbox')
    .update({ processed_at: new Date().toISOString() })
    .in('id', ids);

  if (error) throw error;
}

export async function getRecentEvents(
  orgId: string,
  limit = 50
): Promise<EventOutbox[]> {
  const { data, error } = await supabase
    .from('event_outbox')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as EventOutbox[];
}
