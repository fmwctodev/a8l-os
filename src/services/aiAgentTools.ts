import { supabase } from '../lib/supabase';
import type {
  Contact,
  ContactTimelineEvent,
  Message,
  Appointment,
  ContactNote,
  Tag,
  AIAgentToolName
} from '../types';

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ContactData {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  address: string | null;
  source: string | null;
  status: string;
  owner_name: string | null;
  department_name: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  created_at: string;
}

export interface TimelineData {
  events: Array<{
    id: string;
    event_type: string;
    description: string;
    created_at: string;
    user_name: string | null;
  }>;
}

export interface ConversationHistoryData {
  messages: Array<{
    id: string;
    channel: string;
    direction: string;
    body: string;
    sent_at: string;
    status: string;
  }>;
}

export interface AppointmentHistoryData {
  appointments: Array<{
    id: string;
    type_name: string;
    status: string;
    start_at: string;
    end_at: string;
    assigned_user: string | null;
  }>;
}

export const TOOL_DEFINITIONS: Record<AIAgentToolName, {
  name: string;
  description: string;
  category: 'read' | 'write' | 'communication';
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}> = {
  get_contact: {
    name: 'get_contact',
    description: 'Retrieve full contact information including custom fields, tags, and owner details',
    category: 'read',
    parameters: {
      contact_id: { type: 'string', description: 'The contact ID', required: true }
    }
  },
  get_timeline: {
    name: 'get_timeline',
    description: 'Get recent timeline events for a contact including notes, status changes, and activities',
    category: 'read',
    parameters: {
      contact_id: { type: 'string', description: 'The contact ID', required: true },
      limit: { type: 'number', description: 'Maximum number of events to return (default 20)' }
    }
  },
  get_conversation_history: {
    name: 'get_conversation_history',
    description: 'Get recent messages from conversations with the contact',
    category: 'read',
    parameters: {
      contact_id: { type: 'string', description: 'The contact ID', required: true },
      conversation_id: { type: 'string', description: 'Specific conversation ID (optional)' },
      limit: { type: 'number', description: 'Maximum number of messages to return (default 20)' }
    }
  },
  get_appointment_history: {
    name: 'get_appointment_history',
    description: 'Get past and upcoming appointments for the contact',
    category: 'read',
    parameters: {
      contact_id: { type: 'string', description: 'The contact ID', required: true },
      include_past: { type: 'boolean', description: 'Include past appointments (default true)' },
      limit: { type: 'number', description: 'Maximum number of appointments to return (default 10)' }
    }
  },
  add_note: {
    name: 'add_note',
    description: 'Add a note to the contact record',
    category: 'write',
    parameters: {
      contact_id: { type: 'string', description: 'The contact ID', required: true },
      content: { type: 'string', description: 'The note content', required: true }
    }
  },
  update_field: {
    name: 'update_field',
    description: 'Update a standard or custom field on the contact',
    category: 'write',
    parameters: {
      contact_id: { type: 'string', description: 'The contact ID', required: true },
      field: { type: 'string', description: 'Field name to update', required: true },
      value: { type: 'string', description: 'New value for the field', required: true }
    }
  },
  add_tag: {
    name: 'add_tag',
    description: 'Add a tag to the contact',
    category: 'write',
    parameters: {
      contact_id: { type: 'string', description: 'The contact ID', required: true },
      tag_name: { type: 'string', description: 'Tag name to add', required: true }
    }
  },
  remove_tag: {
    name: 'remove_tag',
    description: 'Remove a tag from the contact',
    category: 'write',
    parameters: {
      contact_id: { type: 'string', description: 'The contact ID', required: true },
      tag_name: { type: 'string', description: 'Tag name to remove', required: true }
    }
  },
  assign_owner: {
    name: 'assign_owner',
    description: 'Assign a new owner to the contact',
    category: 'write',
    parameters: {
      contact_id: { type: 'string', description: 'The contact ID', required: true },
      user_id: { type: 'string', description: 'User ID to assign as owner', required: true }
    }
  },
  create_appointment: {
    name: 'create_appointment',
    description: 'Create a new appointment for the contact',
    category: 'write',
    parameters: {
      contact_id: { type: 'string', description: 'The contact ID', required: true },
      appointment_type_id: { type: 'string', description: 'Appointment type ID', required: true },
      start_at: { type: 'string', description: 'Start time in ISO format', required: true },
      notes: { type: 'string', description: 'Optional appointment notes' }
    }
  },
  send_email: {
    name: 'send_email',
    description: 'Prepare an email draft for user approval',
    category: 'communication',
    parameters: {
      contact_id: { type: 'string', description: 'The contact ID', required: true },
      subject: { type: 'string', description: 'Email subject', required: true },
      body: { type: 'string', description: 'Email body', required: true }
    }
  }
};

export async function executeGetContact(
  contactId: string
): Promise<ToolResult<ContactData>> {
  try {
    const { data: contact, error } = await supabase
      .from('contacts')
      .select(`
        *,
        owner:users!owner_id(id, name),
        department:departments!department_id(id, name),
        tags:contact_tags(tag:tags(*)),
        custom_field_values(*, custom_field:custom_fields(*))
      `)
      .eq('id', contactId)
      .maybeSingle();

    if (error) throw error;
    if (!contact) return { success: false, error: 'Contact not found' };

    const tags = contact.tags?.map((t: { tag: Tag }) => t.tag.name) || [];
    const customFields: Record<string, unknown> = {};
    contact.custom_field_values?.forEach((cfv: {
      custom_field: { field_key: string };
      value: unknown;
    }) => {
      if (cfv.custom_field) {
        customFields[cfv.custom_field.field_key] = cfv.value;
      }
    });

    const address = [
      contact.address_line1,
      contact.address_line2,
      contact.city,
      contact.state,
      contact.postal_code,
      contact.country
    ].filter(Boolean).join(', ') || null;

    const result: ContactData = {
      id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      full_name: `${contact.first_name} ${contact.last_name}`.trim(),
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      job_title: contact.job_title,
      address,
      source: contact.source,
      status: contact.status,
      owner_name: contact.owner?.name || null,
      department_name: contact.department?.name || null,
      tags,
      custom_fields: customFields,
      created_at: contact.created_at
    };

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function executeGetTimeline(
  contactId: string,
  limit = 20
): Promise<ToolResult<TimelineData>> {
  try {
    const { data: events, error } = await supabase
      .from('contact_timeline')
      .select(`
        *,
        user:users!user_id(id, name)
      `)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const result: TimelineData = {
      events: events?.map((e: ContactTimelineEvent & { user?: { name: string } }) => ({
        id: e.id,
        event_type: e.event_type,
        description: formatEventDescription(e.event_type, e.event_data),
        created_at: e.created_at,
        user_name: e.user?.name || null
      })) || []
    };

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

function formatEventDescription(eventType: string, eventData: Record<string, unknown>): string {
  switch (eventType) {
    case 'note_added':
      return `Note added: ${eventData.content || ''}`;
    case 'tag_added':
      return `Tag added: ${eventData.tag_name || ''}`;
    case 'tag_removed':
      return `Tag removed: ${eventData.tag_name || ''}`;
    case 'owner_changed':
      return `Owner changed to ${eventData.new_owner_name || 'unknown'}`;
    case 'status_changed':
      return `Status changed to ${eventData.new_status || ''}`;
    case 'field_updated':
      return `${eventData.field || 'Field'} updated to ${eventData.new_value || ''}`;
    case 'message_sent':
      return `Message sent via ${eventData.channel || 'unknown'}`;
    case 'message_received':
      return `Message received via ${eventData.channel || 'unknown'}`;
    case 'appointment_booked':
      return `Appointment booked: ${eventData.type_name || ''}`;
    default:
      return eventType.replace(/_/g, ' ');
  }
}

export async function executeGetConversationHistory(
  contactId: string,
  conversationId?: string,
  limit = 20
): Promise<ToolResult<ConversationHistoryData>> {
  try {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('contact_id', contactId)
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data: messages, error } = await query;
    if (error) throw error;

    const result: ConversationHistoryData = {
      messages: messages?.map((m: Message) => ({
        id: m.id,
        channel: m.channel,
        direction: m.direction,
        body: m.body,
        sent_at: m.sent_at,
        status: m.status
      })).reverse() || []
    };

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function executeGetAppointmentHistory(
  contactId: string,
  includePast = true,
  limit = 10
): Promise<ToolResult<AppointmentHistoryData>> {
  try {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        appointment_type:appointment_types!appointment_type_id(id, name),
        assigned_user:users!assigned_user_id(id, name)
      `)
      .eq('contact_id', contactId)
      .order('start_at_utc', { ascending: false })
      .limit(limit);

    if (!includePast) {
      query = query.gte('start_at_utc', new Date().toISOString());
    }

    const { data: appointments, error } = await query;
    if (error) throw error;

    const result: AppointmentHistoryData = {
      appointments: appointments?.map((a: Appointment & {
        appointment_type?: { name: string };
        assigned_user?: { name: string };
      }) => ({
        id: a.id,
        type_name: a.appointment_type?.name || 'Unknown',
        status: a.status,
        start_at: a.start_at_utc,
        end_at: a.end_at_utc,
        assigned_user: a.assigned_user?.name || null
      })) || []
    };

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function executeAddNote(
  contactId: string,
  content: string,
  userId: string
): Promise<ToolResult<ContactNote>> {
  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('organization_id')
      .eq('id', contactId)
      .single();

    if (!contact) return { success: false, error: 'Contact not found' };

    const { data: note, error } = await supabase
      .from('contact_notes')
      .insert({
        contact_id: contactId,
        user_id: userId,
        content,
        is_pinned: false
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from('contact_timeline').insert({
      contact_id: contactId,
      user_id: userId,
      event_type: 'note_added',
      event_data: { content: content.substring(0, 100), source: 'ai_agent' }
    });

    return { success: true, data: note as ContactNote };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function executeUpdateField(
  contactId: string,
  field: string,
  value: string
): Promise<ToolResult<{ field: string; value: string }>> {
  try {
    const standardFields = [
      'first_name', 'last_name', 'email', 'phone', 'company', 'job_title',
      'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country', 'source'
    ];

    if (standardFields.includes(field)) {
      const { error } = await supabase
        .from('contacts')
        .update({ [field]: value })
        .eq('id', contactId);

      if (error) throw error;
    } else {
      const { data: customField } = await supabase
        .from('custom_fields')
        .select('id')
        .eq('field_key', field)
        .maybeSingle();

      if (!customField) {
        return { success: false, error: `Field "${field}" not found` };
      }

      const { error } = await supabase
        .from('contact_custom_field_values')
        .upsert({
          contact_id: contactId,
          custom_field_id: customField.id,
          value
        }, {
          onConflict: 'contact_id,custom_field_id'
        });

      if (error) throw error;
    }

    await supabase.from('contact_timeline').insert({
      contact_id: contactId,
      event_type: 'field_updated',
      event_data: { field, new_value: value, source: 'ai_agent' }
    });

    return { success: true, data: { field, value } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function executeAddTag(
  contactId: string,
  tagName: string,
  orgId: string
): Promise<ToolResult<{ tag_name: string }>> {
  try {
    let tagId: string;

    const { data: existingTag } = await supabase
      .from('tags')
      .select('id')
      .eq('organization_id', orgId)
      .eq('name', tagName)
      .maybeSingle();

    if (existingTag) {
      tagId = existingTag.id;
    } else {
      const { data: newTag, error: createError } = await supabase
        .from('tags')
        .insert({
          organization_id: orgId,
          name: tagName,
          color: '#6B7280'
        })
        .select()
        .single();

      if (createError) throw createError;
      tagId = newTag.id;
    }

    const { error } = await supabase
      .from('contact_tags')
      .upsert({
        contact_id: contactId,
        tag_id: tagId
      }, {
        onConflict: 'contact_id,tag_id'
      });

    if (error) throw error;

    await supabase.from('contact_timeline').insert({
      contact_id: contactId,
      event_type: 'tag_added',
      event_data: { tag_name: tagName, source: 'ai_agent' }
    });

    return { success: true, data: { tag_name: tagName } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function executeRemoveTag(
  contactId: string,
  tagName: string,
  orgId: string
): Promise<ToolResult<{ tag_name: string }>> {
  try {
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('organization_id', orgId)
      .eq('name', tagName)
      .maybeSingle();

    if (!tag) {
      return { success: false, error: `Tag "${tagName}" not found` };
    }

    const { error } = await supabase
      .from('contact_tags')
      .delete()
      .eq('contact_id', contactId)
      .eq('tag_id', tag.id);

    if (error) throw error;

    await supabase.from('contact_timeline').insert({
      contact_id: contactId,
      event_type: 'tag_removed',
      event_data: { tag_name: tagName, source: 'ai_agent' }
    });

    return { success: true, data: { tag_name: tagName } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function executeAssignOwner(
  contactId: string,
  userId: string
): Promise<ToolResult<{ user_id: string; user_name: string }>> {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', userId)
      .maybeSingle();

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const { error } = await supabase
      .from('contacts')
      .update({ owner_id: userId })
      .eq('id', contactId);

    if (error) throw error;

    await supabase.from('contact_timeline').insert({
      contact_id: contactId,
      event_type: 'owner_changed',
      event_data: { new_owner_id: userId, new_owner_name: user.name, source: 'ai_agent' }
    });

    return { success: true, data: { user_id: userId, user_name: user.name } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function executeCreateAppointment(
  contactId: string,
  appointmentTypeId: string,
  startAt: string,
  orgId: string,
  notes?: string
): Promise<ToolResult<{ appointment_id: string }>> {
  try {
    const { data: appointmentType } = await supabase
      .from('appointment_types')
      .select('*, calendar:calendars!calendar_id(*)')
      .eq('id', appointmentTypeId)
      .maybeSingle();

    if (!appointmentType) {
      return { success: false, error: 'Appointment type not found' };
    }

    const startDate = new Date(startAt);
    const endDate = new Date(startDate.getTime() + appointmentType.duration_minutes * 60000);

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        org_id: orgId,
        calendar_id: appointmentType.calendar_id,
        appointment_type_id: appointmentTypeId,
        contact_id: contactId,
        status: 'scheduled',
        start_at_utc: startDate.toISOString(),
        end_at_utc: endDate.toISOString(),
        visitor_timezone: 'UTC',
        answers: {},
        source: 'manual',
        reschedule_token: crypto.randomUUID(),
        cancel_token: crypto.randomUUID(),
        notes: notes || null,
        history: [{ action: 'created', timestamp: new Date().toISOString() }]
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from('contact_timeline').insert({
      contact_id: contactId,
      event_type: 'appointment_booked',
      event_data: {
        appointment_id: appointment.id,
        type_name: appointmentType.name,
        start_at: startAt,
        source: 'ai_agent'
      }
    });

    return { success: true, data: { appointment_id: appointment.id } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function executePrepareSMS(
  contactId: string,
  message: string
): Promise<ToolResult<{ draft_channel: 'sms'; draft_message: string }>> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('phone')
    .eq('id', contactId)
    .maybeSingle();

  if (!contact?.phone) {
    return { success: false, error: 'Contact does not have a phone number' };
  }

  return {
    success: true,
    data: {
      draft_channel: 'sms',
      draft_message: message
    }
  };
}

export async function executePrepareEmail(
  contactId: string,
  subject: string,
  body: string
): Promise<ToolResult<{ draft_channel: 'email'; draft_subject: string; draft_message: string }>> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('email')
    .eq('id', contactId)
    .maybeSingle();

  if (!contact?.email) {
    return { success: false, error: 'Contact does not have an email address' };
  }

  return {
    success: true,
    data: {
      draft_channel: 'email',
      draft_subject: subject,
      draft_message: body
    }
  };
}
