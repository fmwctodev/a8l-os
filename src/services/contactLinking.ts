import { supabase } from '../lib/supabase';
import type { Contact, MessageChannel } from '../types';
import { normalizePhoneNumber } from './channels/twilio';

export interface ContactMatch {
  contact: Contact;
  matchType: 'phone' | 'email';
  confidence: 'exact' | 'partial';
}

export async function findContactByPhone(
  orgId: string,
  phone: string
): Promise<Contact | null> {
  const normalizedPhone = normalizePhoneNumber(phone);

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      department:departments!department_id(id, name),
      owner:users!owner_id(id, name, email)
    `)
    .eq('organization_id', orgId)
    .eq('phone', normalizedPhone)
    .eq('status', 'active')
    .is('merged_into_contact_id', null)
    .maybeSingle();

  if (error) throw error;
  return data as Contact | null;
}

export async function findContactByEmail(
  orgId: string,
  email: string
): Promise<Contact | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      department:departments!department_id(id, name),
      owner:users!owner_id(id, name, email)
    `)
    .eq('organization_id', orgId)
    .ilike('email', normalizedEmail)
    .eq('status', 'active')
    .is('merged_into_contact_id', null)
    .maybeSingle();

  if (error) throw error;
  return data as Contact | null;
}

export async function findContactsByPhone(
  orgId: string,
  phone: string
): Promise<Contact[]> {
  const normalizedPhone = normalizePhoneNumber(phone);

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      department:departments!department_id(id, name),
      owner:users!owner_id(id, name, email)
    `)
    .eq('organization_id', orgId)
    .eq('phone', normalizedPhone)
    .eq('status', 'active')
    .is('merged_into_contact_id', null);

  if (error) throw error;
  return data as Contact[];
}

export async function findContactsByEmail(
  orgId: string,
  email: string
): Promise<Contact[]> {
  const normalizedEmail = email.toLowerCase().trim();

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      department:departments!department_id(id, name),
      owner:users!owner_id(id, name, email)
    `)
    .eq('organization_id', orgId)
    .ilike('email', normalizedEmail)
    .eq('status', 'active')
    .is('merged_into_contact_id', null);

  if (error) throw error;
  return data as Contact[];
}

export async function findOrCreateContact(
  orgId: string,
  channel: MessageChannel,
  identifier: string,
  metadata: {
    name?: string;
    departmentId?: string;
  } = {}
): Promise<{ contact: Contact; isNew: boolean; isAmbiguous: boolean }> {
  let contacts: Contact[] = [];

  if (channel === 'sms' || channel === 'voice') {
    contacts = await findContactsByPhone(orgId, identifier);
  } else if (channel === 'email') {
    contacts = await findContactsByEmail(orgId, identifier);
  }

  if (contacts.length === 1) {
    return { contact: contacts[0], isNew: false, isAmbiguous: false };
  }

  if (contacts.length > 1) {
    return { contact: contacts[0], isNew: false, isAmbiguous: true };
  }

  const newContact = await createContactStub(orgId, channel, identifier, metadata);
  return { contact: newContact, isNew: true, isAmbiguous: false };
}

export async function createContactStub(
  orgId: string,
  channel: MessageChannel,
  identifier: string,
  metadata: {
    name?: string;
    departmentId?: string;
  } = {}
): Promise<Contact> {
  let departmentId = metadata.departmentId;

  if (!departmentId) {
    const { data: defaultDept } = await supabase
      .from('departments')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)
      .maybeSingle();
    departmentId = defaultDept?.id;
  }

  const firstName = metadata.name?.split(' ')[0] || 'Unknown';
  const lastName = metadata.name?.split(' ').slice(1).join(' ') || identifier;

  const contactData: Record<string, unknown> = {
    organization_id: orgId,
    department_id: departmentId,
    first_name: firstName,
    last_name: lastName,
    source: channel,
    status: 'active',
  };

  if (channel === 'sms' || channel === 'voice') {
    contactData.phone = normalizePhoneNumber(identifier);
  } else if (channel === 'email') {
    contactData.email = identifier.toLowerCase().trim();
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert(contactData)
    .select(`
      *,
      department:departments!department_id(id, name),
      owner:users!owner_id(id, name, email)
    `)
    .single();

  if (error) throw error;
  return data as Contact;
}

export async function detectAmbiguousMatch(
  orgId: string,
  channel: MessageChannel,
  identifier: string
): Promise<ContactMatch[]> {
  let contacts: Contact[] = [];
  let matchType: 'phone' | 'email' = 'phone';

  if (channel === 'sms' || channel === 'voice') {
    contacts = await findContactsByPhone(orgId, identifier);
    matchType = 'phone';
  } else if (channel === 'email') {
    contacts = await findContactsByEmail(orgId, identifier);
    matchType = 'email';
  }

  return contacts.map((contact) => ({
    contact,
    matchType,
    confidence: 'exact' as const,
  }));
}

export async function resolveAmbiguousContact(
  conversationId: string,
  contactId: string,
  actorUserId: string
): Promise<void> {
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('organization_id, contact_id')
    .eq('id', conversationId)
    .single();

  if (convError) throw convError;

  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      contact_id: contactId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (updateError) throw updateError;

  await supabase
    .from('messages')
    .update({ contact_id: contactId })
    .eq('conversation_id', conversationId);

  await supabase.from('inbox_events').insert({
    organization_id: conversation.organization_id,
    conversation_id: conversationId,
    event_type: 'contact_merged',
    payload: {
      old_contact_id: conversation.contact_id,
      new_contact_id: contactId,
      resolved_by: actorUserId,
    },
    actor_user_id: actorUserId,
  });
}

export async function linkConversationToContact(
  conversationId: string,
  contactId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({
      contact_id: contactId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function getContactChannels(
  contact: Contact
): Promise<{ channel: MessageChannel; identifier: string }[]> {
  const channels: { channel: MessageChannel; identifier: string }[] = [];

  if (contact.phone) {
    channels.push({ channel: 'sms', identifier: contact.phone });
    channels.push({ channel: 'voice', identifier: contact.phone });
  }

  if (contact.email) {
    channels.push({ channel: 'email', identifier: contact.email });
  }

  try {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contact.id)
      .limit(10);

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map(c => c.id);
      const { data: webchatSession } = await supabase
        .from('webchat_sessions')
        .select('id')
        .in('conversation_id', conversationIds)
        .limit(1)
        .maybeSingle();

      if (webchatSession) {
        channels.push({ channel: 'webchat', identifier: contact.id });
      }
    }
  } catch {
  }

  return channels;
}
