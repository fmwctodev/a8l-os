import { supabase } from '../lib/supabase';
import type { OpportunityTimelineEvent, OpportunityTimelineEventType } from '../types';

export async function getTimelineByOpportunity(
  opportunityId: string,
  limit = 50,
  offset = 0
): Promise<{ data: OpportunityTimelineEvent[]; total: number }> {
  const { data, error, count } = await supabase
    .from('opportunity_timeline_events')
    .select(`
      *,
      actor:users(*)
    `, { count: 'exact' })
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return {
    data: data || [],
    total: count || 0
  };
}

export async function createTimelineEvent(event: {
  org_id: string;
  opportunity_id: string;
  contact_id: string;
  event_type: OpportunityTimelineEventType | string;
  summary: string;
  payload?: Record<string, unknown>;
  actor_user_id?: string | null;
}): Promise<OpportunityTimelineEvent> {
  const { data, error } = await supabase
    .from('opportunity_timeline_events')
    .insert({
      org_id: event.org_id,
      opportunity_id: event.opportunity_id,
      contact_id: event.contact_id,
      event_type: event.event_type,
      summary: event.summary,
      payload: event.payload || {},
      actor_user_id: event.actor_user_id || null
    })
    .select(`
      *,
      actor:users(*)
    `)
    .single();

  if (error) throw error;

  await addContactTimelineEntry(event);

  return data;
}

async function addContactTimelineEntry(event: {
  org_id: string;
  opportunity_id: string;
  contact_id: string;
  event_type: string;
  summary: string;
  actor_user_id?: string | null;
}): Promise<void> {
  const eventTypeMap: Record<string, string> = {
    opportunity_created: 'opportunity_created',
    stage_changed: 'opportunity_stage_changed',
    status_changed: 'opportunity_status_changed',
    note_added: 'opportunity_note_added',
    task_created: 'opportunity_task_created',
    task_completed: 'opportunity_task_completed'
  };

  const contactEventType = eventTypeMap[event.event_type];
  if (!contactEventType) return;

  try {
    await supabase
      .from('contact_timeline_events')
      .insert({
        contact_id: event.contact_id,
        user_id: event.actor_user_id,
        event_type: contactEventType,
        event_data: {
          opportunity_id: event.opportunity_id,
          summary: event.summary
        }
      });
  } catch {
  }
}

export async function getRecentActivityByContact(
  contactId: string,
  limit = 10
): Promise<OpportunityTimelineEvent[]> {
  const { data, error } = await supabase
    .from('opportunity_timeline_events')
    .select(`
      *,
      actor:users(*)
    `)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
