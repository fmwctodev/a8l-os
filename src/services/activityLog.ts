import { supabase } from '../lib/supabase';

export type EventType =
  | 'contact_created'
  | 'contact_updated'
  | 'contact_merged'
  | 'contact_deleted'
  | 'conversation_created'
  | 'conversation_assigned'
  | 'conversation_status_changed'
  | 'message_sent'
  | 'message_received'
  | 'opportunity_created'
  | 'opportunity_stage_changed'
  | 'opportunity_won'
  | 'opportunity_lost'
  | 'opportunity_updated'
  | 'appointment_booked'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'appointment_completed'
  | 'invoice_created'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'invoice_voided'
  | 'ai_agent_run'
  | 'task_created'
  | 'task_completed'
  | 'note_added';

export type EntityType =
  | 'contact'
  | 'conversation'
  | 'opportunity'
  | 'appointment'
  | 'invoice'
  | 'ai_agent'
  | 'task'
  | 'note';

export interface ActivityLogEntry {
  id: string;
  organization_id: string;
  user_id: string | null;
  event_type: EventType;
  entity_type: EntityType;
  entity_id: string;
  contact_id: string | null;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
  user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface LogActivityParams {
  organizationId: string;
  userId?: string;
  eventType: EventType;
  entityType: EntityType;
  entityId: string;
  contactId?: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export type ActivityFilter = 'all' | 'mine' | 'team';

export async function logActivity(params: LogActivityParams): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('activity_log').insert({
    organization_id: params.organizationId,
    user_id: params.userId || null,
    event_type: params.eventType,
    entity_type: params.entityType,
    entity_id: params.entityId,
    contact_id: params.contactId || null,
    summary: params.summary,
    payload: params.payload || {},
  });

  return { error: error ? new Error(error.message) : null };
}

export async function getRecentActivity(
  organizationId: string,
  options: {
    filter?: ActivityFilter;
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: ActivityLogEntry[]; error: Error | null }> {
  const { filter = 'all', userId, limit = 20, offset = 0 } = options;

  let query = supabase
    .from('activity_log')
    .select(`
      *,
      user:users!activity_log_user_id_fkey(id, name, avatar_url),
      contact:contacts!activity_log_contact_id_fkey(id, first_name, last_name)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter === 'mine' && userId) {
    query = query.eq('user_id', userId);
  } else if (filter === 'team' && userId) {
    query = query.neq('user_id', userId);
  }

  const { data, error } = await query;

  return {
    data: (data as ActivityLogEntry[]) || [],
    error: error ? new Error(error.message) : null,
  };
}

export async function getActivityByEntity(
  entityType: EntityType,
  entityId: string,
  limit = 50
): Promise<{ data: ActivityLogEntry[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('activity_log')
    .select(`
      *,
      user:users!activity_log_user_id_fkey(id, name, avatar_url)
    `)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return {
    data: (data as ActivityLogEntry[]) || [],
    error: error ? new Error(error.message) : null,
  };
}

export async function getActivityByContact(
  contactId: string,
  limit = 50
): Promise<{ data: ActivityLogEntry[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('activity_log')
    .select(`
      *,
      user:users!activity_log_user_id_fkey(id, name, avatar_url)
    `)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return {
    data: (data as ActivityLogEntry[]) || [],
    error: error ? new Error(error.message) : null,
  };
}

export function getEventIcon(eventType: EventType): string {
  const iconMap: Record<EventType, string> = {
    contact_created: 'user-plus',
    contact_updated: 'user-cog',
    contact_merged: 'users',
    contact_deleted: 'user-minus',
    conversation_created: 'message-square-plus',
    conversation_assigned: 'user-check',
    conversation_status_changed: 'message-square',
    message_sent: 'send',
    message_received: 'inbox',
    opportunity_created: 'target',
    opportunity_stage_changed: 'arrow-right',
    opportunity_won: 'trophy',
    opportunity_lost: 'x-circle',
    opportunity_updated: 'edit',
    appointment_booked: 'calendar-plus',
    appointment_rescheduled: 'calendar-clock',
    appointment_cancelled: 'calendar-x',
    appointment_completed: 'calendar-check',
    invoice_created: 'file-text',
    invoice_sent: 'send',
    invoice_paid: 'check-circle',
    invoice_voided: 'file-x',
    ai_agent_run: 'bot',
    task_created: 'clipboard-list',
    task_completed: 'clipboard-check',
    note_added: 'sticky-note',
  };
  return iconMap[eventType] || 'activity';
}

export function getEventColor(eventType: EventType): string {
  if (eventType.includes('contact')) return 'cyan';
  if (eventType.includes('conversation') || eventType.includes('message')) return 'teal';
  if (eventType.includes('opportunity')) return 'amber';
  if (eventType.includes('appointment')) return 'rose';
  if (eventType.includes('invoice')) return 'emerald';
  if (eventType.includes('ai_agent')) return 'violet';
  if (eventType.includes('task')) return 'blue';
  return 'slate';
}
