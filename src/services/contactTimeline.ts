import { supabase } from '../lib/supabase';
import type { ContactTimelineEvent } from '../types';

export interface AggregatedTimelineEvent {
  id: string;
  contact_id: string;
  user_id: string | null;
  event_type: string;
  event_category: 'contact' | 'message' | 'call' | 'appointment' | 'opportunity' | 'payment' | 'automation' | 'ai';
  event_data: Record<string, unknown>;
  created_at: string;
  user?: { id: string; name: string; avatar_url: string | null } | null;
}

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

export async function getAggregatedTimeline(contactId: string): Promise<AggregatedTimelineEvent[]> {
  const events: AggregatedTimelineEvent[] = [];

  const [timelineData, messagesData, appointmentsData, opportunitiesData, paymentsData] = await Promise.all([
    supabase
      .from('contact_timeline')
      .select('*, user:users(id, name, avatar_url)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false }),
    supabase
      .from('messages')
      .select('id, conversation_id, direction, channel, content, status, created_at')
      .eq('conversation_id', contactId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('appointments')
      .select('id, title, status, start_time, end_time, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('opportunities')
      .select('id, title, status, stage_id, amount, created_at, updated_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, paid_at, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (timelineData.data) {
    for (const event of timelineData.data) {
      events.push({
        id: event.id,
        contact_id: event.contact_id,
        user_id: event.user_id,
        event_type: event.event_type,
        event_category: categorizeEventType(event.event_type),
        event_data: event.event_data,
        created_at: event.created_at,
        user: event.user,
      });
    }
  }

  if (messagesData.data) {
    for (const msg of messagesData.data) {
      const eventType = msg.direction === 'inbound' ? 'message_received' : 'message_sent';
      events.push({
        id: `msg-${msg.id}`,
        contact_id: contactId,
        user_id: null,
        event_type: eventType,
        event_category: 'message',
        event_data: {
          channel: msg.channel,
          direction: msg.direction,
          content_preview: (msg.content as string)?.substring(0, 100),
          status: msg.status,
        },
        created_at: msg.created_at,
      });
    }
  }

  if (appointmentsData.data) {
    for (const appt of appointmentsData.data) {
      events.push({
        id: `appt-${appt.id}`,
        contact_id: contactId,
        user_id: null,
        event_type: `appointment_${appt.status}`,
        event_category: 'appointment',
        event_data: {
          title: appt.title,
          status: appt.status,
          start_time: appt.start_time,
          end_time: appt.end_time,
        },
        created_at: appt.created_at,
      });
    }
  }

  if (opportunitiesData.data) {
    for (const opp of opportunitiesData.data) {
      events.push({
        id: `opp-${opp.id}`,
        contact_id: contactId,
        user_id: null,
        event_type: `opportunity_${opp.status}`,
        event_category: 'opportunity',
        event_data: {
          title: opp.title,
          status: opp.status,
          amount: opp.amount,
        },
        created_at: opp.created_at,
      });
    }
  }

  if (paymentsData.data) {
    for (const inv of paymentsData.data) {
      const eventType = inv.paid_at ? 'payment_received' : `invoice_${inv.status}`;
      events.push({
        id: `inv-${inv.id}`,
        contact_id: contactId,
        user_id: null,
        event_type: eventType,
        event_category: 'payment',
        event_data: {
          invoice_number: inv.invoice_number,
          status: inv.status,
          amount: inv.total_amount,
          paid_at: inv.paid_at,
        },
        created_at: inv.paid_at || inv.created_at,
      });
    }
  }

  events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return events;
}

function categorizeEventType(eventType: string): AggregatedTimelineEvent['event_category'] {
  if (eventType.startsWith('message_') || eventType.includes('email') || eventType.includes('sms')) {
    return 'message';
  }
  if (eventType.startsWith('call_') || eventType.includes('voice')) {
    return 'call';
  }
  if (eventType.startsWith('appointment_') || eventType.includes('booking')) {
    return 'appointment';
  }
  if (eventType.startsWith('opportunity_') || eventType.includes('deal')) {
    return 'opportunity';
  }
  if (eventType.startsWith('payment_') || eventType.startsWith('invoice_')) {
    return 'payment';
  }
  if (eventType.startsWith('workflow_') || eventType.includes('automation')) {
    return 'automation';
  }
  if (eventType.startsWith('ai_') || eventType.includes('agent')) {
    return 'ai';
  }
  return 'contact';
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

export function getTimelineEventLabel(event: ContactTimelineEvent | AggregatedTimelineEvent): string {
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
    case 'owner_changed':
      return 'Owner changed';
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
    case 'message_sent':
      return `Message sent via ${event.event_data.channel || 'unknown'}`;
    case 'message_received':
      return `Message received via ${event.event_data.channel || 'unknown'}`;
    case 'appointment_scheduled':
    case 'appointment_booked':
      return `Appointment booked: ${event.event_data.title || ''}`;
    case 'appointment_completed':
      return `Appointment completed: ${event.event_data.title || ''}`;
    case 'appointment_cancelled':
      return `Appointment cancelled: ${event.event_data.title || ''}`;
    case 'appointment_rescheduled':
      return `Appointment rescheduled: ${event.event_data.title || ''}`;
    case 'opportunity_created':
    case 'opportunity_open':
      return `Opportunity created: ${event.event_data.title || ''}`;
    case 'opportunity_won':
      return `Opportunity won: ${event.event_data.title || ''} ($${event.event_data.amount || 0})`;
    case 'opportunity_lost':
      return `Opportunity lost: ${event.event_data.title || ''}`;
    case 'opportunity_stage_changed':
      return `Opportunity stage changed: ${event.event_data.title || ''}`;
    case 'payment_received':
      return `Payment received: $${event.event_data.amount || 0}`;
    case 'invoice_sent':
      return `Invoice sent: #${event.event_data.invoice_number || ''}`;
    case 'invoice_draft':
      return `Invoice created: #${event.event_data.invoice_number || ''}`;
    case 'invoice_paid':
      return `Invoice paid: #${event.event_data.invoice_number || ''}`;
    case 'workflow_enrolled':
      return `Enrolled in workflow: ${event.event_data.workflow_name || ''}`;
    case 'workflow_completed':
      return `Completed workflow: ${event.event_data.workflow_name || ''}`;
    case 'ai_agent_action':
      return `AI agent action: ${event.event_data.action || ''}`;
    default:
      return event.event_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
