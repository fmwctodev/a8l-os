import { supabase } from '../lib/supabase';
import type { ContactTimelineEvent } from '../types';

export async function getContactTimeline(contactId: string): Promise<ContactTimelineEvent[]> {
  const { data, error } = await supabase
    .from('contact_timeline')
    .select(`
      *,
      user:users(id, name, avatar_url)
    `)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addTimelineEvent(
  contactId: string,
  userId: string | null,
  eventType: string,
  eventData: Record<string, unknown> = {}
): Promise<ContactTimelineEvent> {
  const { data, error } = await supabase
    .from('contact_timeline')
    .insert({
      contact_id: contactId,
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function getTimelineEventLabel(event: ContactTimelineEvent): string {
  switch (event.event_type) {
    case 'created':
      return 'Contact created';
    case 'updated':
      const fields = (event.event_data.changed_fields as string[]) || [];
      return `Updated ${fields.length} field${fields.length === 1 ? '' : 's'}`;
    case 'merged':
      return `Merged with ${event.event_data.merged_contact_name || 'another contact'}`;
    case 'note_added':
      return 'Note added';
    case 'note_updated':
      return 'Note updated';
    case 'note_deleted':
      return 'Note deleted';
    case 'task_created':
      return `Task created: ${event.event_data.task_title || ''}`;
    case 'task_completed':
      return `Task completed: ${event.event_data.task_title || ''}`;
    case 'task_updated':
      return `Task updated: ${event.event_data.task_title || ''}`;
    case 'tag_added':
      return `Tag added: ${event.event_data.tag_name || ''}`;
    case 'tag_removed':
      return `Tag removed: ${event.event_data.tag_name || ''}`;
    case 'review_request_sent':
      const channel = event.event_data.channel as string;
      return `Review request sent via ${channel}`;
    case 'review_link_clicked':
      return 'Clicked review link';
    case 'review_submitted':
      const rating = event.event_data.rating as number;
      const provider = event.event_data.provider as string;
      return `Submitted ${rating}-star review on ${provider}`;
    case 'negative_feedback_received':
      const negRating = event.event_data.rating as number;
      return `Left ${negRating}-star feedback (internal)`;
    default:
      return event.event_type.replace(/_/g, ' ');
  }
}
