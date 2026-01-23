import { supabase } from '../lib/supabase';
import type { Contact, User } from '../types';
import { logAudit } from './audit';
import { addTimelineEvent } from './contactTimeline';
import { publishEvent } from './eventOutbox';

export interface ContactFilters {
  search?: string;
  status?: 'active' | 'archived';
  departmentId?: string;
  ownerId?: string;
  tagIds?: string[];
  source?: string;
  leadScoreMin?: number;
  leadScoreMax?: number;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: 'name' | 'created_at' | 'last_activity_at' | 'lead_score';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateContactData {
  department_id: string;
  owner_id?: string | null;
  first_name: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  job_title?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  source?: string | null;
}

export interface UpdateContactData extends Partial<CreateContactData> {
  status?: 'active' | 'archived';
}

export async function getContacts(
  organizationId: string,
  filters: ContactFilters = {}
): Promise<Contact[]> {
  const sortBy = filters.sortBy || 'created_at';
  const sortOrder = filters.sortOrder || 'desc';
  const ascending = sortOrder === 'asc';

  let query = supabase
    .from('contacts')
    .select(`
      *,
      owner:users!contacts_owner_id_fkey(id, name, email),
      department:departments(*),
      tags:contact_tags(tag:tags(*))
    `)
    .eq('organization_id', organizationId)
    .is('merged_into_contact_id', null);

  if (sortBy === 'name') {
    query = query.order('last_name', { ascending }).order('first_name', { ascending });
  } else if (sortBy === 'last_activity_at') {
    query = query.order('last_activity_at', { ascending, nullsFirst: false });
  } else if (sortBy === 'lead_score') {
    query = query.order('lead_score', { ascending });
  } else {
    query = query.order('created_at', { ascending });
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  } else {
    query = query.eq('status', 'active');
  }

  if (filters.departmentId) {
    query = query.eq('department_id', filters.departmentId);
  }

  if (filters.ownerId) {
    query = query.eq('owner_id', filters.ownerId);
  }

  if (filters.source) {
    query = query.eq('source', filters.source);
  }

  if (filters.leadScoreMin !== undefined) {
    query = query.gte('lead_score', filters.leadScoreMin);
  }

  if (filters.leadScoreMax !== undefined) {
    query = query.lte('lead_score', filters.leadScoreMax);
  }

  if (filters.createdAfter) {
    query = query.gte('created_at', filters.createdAfter);
  }

  if (filters.createdBefore) {
    query = query.lte('created_at', filters.createdBefore);
  }

  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    query = query.or(
      `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm},company.ilike.${searchTerm}`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const contacts = (data || []).map((contact) => ({
    ...contact,
    tags: contact.tags?.map((ct: { tag: unknown }) => ct.tag) || [],
  }));

  if (filters.tagIds && filters.tagIds.length > 0) {
    return contacts.filter((contact) =>
      filters.tagIds!.some((tagId) =>
        contact.tags?.some((tag: { id: string }) => tag.id === tagId)
      )
    );
  }

  return contacts;
}

export async function getContactById(id: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      owner:users!contacts_owner_id_fkey(id, name, email, avatar_url),
      department:departments(*),
      tags:contact_tags(tag:tags(*))
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    tags: data.tags?.map((ct: { tag: unknown }) => ct.tag) || [],
  };
}

export async function createContact(
  organizationId: string,
  contactData: CreateContactData,
  currentUser: User
): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      organization_id: organizationId,
      ...contactData,
      created_by_user_id: currentUser.id,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'create',
    entityType: 'contact',
    entityId: data.id,
    afterState: data,
  });

  await addTimelineEvent(data.id, currentUser.id, 'created', {
    created_by: currentUser.name,
  });

  try {
    await publishEvent(
      organizationId,
      'contact_created',
      'contact',
      data.id,
      data.id,
      { source: contactData.source, created_by: currentUser.id }
    );
  } catch {
  }

  return data;
}

export async function updateContact(
  id: string,
  updates: UpdateContactData,
  currentUser: User
): Promise<Contact> {
  const { data: before } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('contacts')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'update',
    entityType: 'contact',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  const changedFields = Object.keys(updates).filter(
    (key) => before?.[key as keyof typeof before] !== (updates as Record<string, unknown>)[key]
  );

  if (changedFields.length > 0) {
    await addTimelineEvent(id, currentUser.id, 'updated', {
      changed_fields: changedFields,
      updated_by: currentUser.name,
    });

    try {
      await publishEvent(
        data.organization_id,
        'contact_updated',
        'contact',
        id,
        id,
        { changed_fields: changedFields, updated_by: currentUser.id }
      );

      if (changedFields.includes('owner_id') && before?.owner_id !== data.owner_id) {
        await publishEvent(
          data.organization_id,
          'contact_owner_changed',
          'contact',
          id,
          id,
          { previous_owner_id: before?.owner_id, new_owner_id: data.owner_id }
        );
      }

      if (changedFields.includes('department_id') && before?.department_id !== data.department_id) {
        await publishEvent(
          data.organization_id,
          'contact_department_changed',
          'contact',
          id,
          id,
          { previous_department_id: before?.department_id, new_department_id: data.department_id }
        );
      }
    } catch {
    }
  }

  return data;
}

export async function deleteContact(id: string, currentUser: User): Promise<void> {
  const { data: before } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('contacts').delete().eq('id', id);

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'delete',
    entityType: 'contact',
    entityId: id,
    beforeState: before,
  });
}

export async function bulkDeleteContacts(ids: string[], currentUser: User): Promise<void> {
  for (const id of ids) {
    await deleteContact(id, currentUser);
  }
}

export async function bulkAssignOwner(
  ids: string[],
  ownerId: string | null,
  currentUser: User
): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({
      owner_id: ownerId,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (error) throw error;

  const ownerName = ownerId ? 'new owner' : 'unassigned';
  for (const id of ids) {
    await addTimelineEvent(id, currentUser.id, 'owner_changed', {
      new_owner_id: ownerId,
      changed_by: currentUser.name,
    });
  }

  await logAudit({
    userId: currentUser.id,
    action: 'bulk_assign_owner',
    entityType: 'contact',
    entityId: null,
    afterState: { contact_ids: ids, owner_id: ownerId },
  });
}

export async function bulkAddTag(
  ids: string[],
  tagId: string,
  currentUser: User
): Promise<void> {
  const inserts = ids.map((contactId) => ({
    contact_id: contactId,
    tag_id: tagId,
  }));

  const { error } = await supabase
    .from('contact_tags')
    .upsert(inserts, { onConflict: 'contact_id,tag_id' });

  if (error) throw error;

  for (const id of ids) {
    await addTimelineEvent(id, currentUser.id, 'tag_added', {
      tag_id: tagId,
      added_by: currentUser.name,
    });
  }

  await logAudit({
    userId: currentUser.id,
    action: 'bulk_add_tag',
    entityType: 'contact',
    entityId: null,
    afterState: { contact_ids: ids, tag_id: tagId },
  });
}

export async function bulkRemoveTag(
  ids: string[],
  tagId: string,
  currentUser: User
): Promise<void> {
  const { error } = await supabase
    .from('contact_tags')
    .delete()
    .in('contact_id', ids)
    .eq('tag_id', tagId);

  if (error) throw error;

  for (const id of ids) {
    await addTimelineEvent(id, currentUser.id, 'tag_removed', {
      tag_id: tagId,
      removed_by: currentUser.name,
    });
  }

  await logAudit({
    userId: currentUser.id,
    action: 'bulk_remove_tag',
    entityType: 'contact',
    entityId: null,
    afterState: { contact_ids: ids, tag_id: tagId },
  });
}

export async function mergeContacts(
  primaryId: string,
  secondaryId: string,
  mergeData: UpdateContactData,
  currentUser: User
): Promise<Contact> {
  const { data: secondary } = await supabase
    .from('contacts')
    .select('*, tags:contact_tags(tag_id)')
    .eq('id', secondaryId)
    .maybeSingle();

  if (!secondary) throw new Error('Secondary contact not found');

  const { data: primary, error: updateError } = await supabase
    .from('contacts')
    .update({
      ...mergeData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', primaryId)
    .select()
    .single();

  if (updateError) throw updateError;

  const { error: archiveError } = await supabase
    .from('contacts')
    .update({
      status: 'archived',
      merged_into_contact_id: primaryId,
      merged_at: new Date().toISOString(),
      merged_by_user_id: currentUser.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', secondaryId);

  if (archiveError) throw archiveError;

  if (secondary.tags?.length > 0) {
    const tagInserts = secondary.tags.map((t: { tag_id: string }) => ({
      contact_id: primaryId,
      tag_id: t.tag_id,
    }));

    await supabase.from('contact_tags').upsert(tagInserts, { onConflict: 'contact_id,tag_id' });
  }

  await addTimelineEvent(primaryId, currentUser.id, 'merged', {
    merged_contact_id: secondaryId,
    merged_contact_name: `${secondary.first_name} ${secondary.last_name}`.trim(),
    merged_by: currentUser.name,
  });

  await logAudit({
    userId: currentUser.id,
    action: 'merge',
    entityType: 'contact',
    entityId: primaryId,
    beforeState: { primary: primary, secondary },
    afterState: { merged_into: primaryId, archived: secondaryId },
  });

  return primary;
}

export async function archiveContact(id: string, currentUser: User): Promise<Contact> {
  return updateContact(id, { status: 'archived' }, currentUser);
}

export async function restoreContact(id: string, currentUser: User): Promise<Contact> {
  return updateContact(id, { status: 'active' }, currentUser);
}

export function exportContactsToCSV(contacts: Contact[]): string {
  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Company',
    'Job Title',
    'Address Line 1',
    'Address Line 2',
    'City',
    'State',
    'Postal Code',
    'Country',
    'Source',
    'Status',
    'Created At',
  ];

  const rows = contacts.map((c) => [
    c.first_name,
    c.last_name,
    c.email || '',
    c.phone || '',
    c.company || '',
    c.job_title || '',
    c.address_line1 || '',
    c.address_line2 || '',
    c.city || '',
    c.state || '',
    c.postal_code || '',
    c.country || '',
    c.source || '',
    c.status,
    new Date(c.created_at).toISOString(),
  ]);

  const escapeCSV = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n');

  return csvContent;
}

export function parseCSVToContacts(
  csvContent: string,
  departmentId: string
): CreateContactData[] {
  const lines = csvContent.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const contacts: CreateContactData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};

    headers.forEach((header, idx) => {
      record[header] = values[idx]?.trim() || '';
    });

    const contact: CreateContactData = {
      department_id: departmentId,
      first_name: record.first_name || record.name?.split(' ')[0] || 'Unknown',
      last_name: record.last_name || record.name?.split(' ').slice(1).join(' ') || '',
      email: record.email || null,
      phone: record.phone || null,
      company: record.company || null,
      job_title: record.job_title || null,
      address_line1: record.address_line_1 || record.address || null,
      address_line2: record.address_line_2 || null,
      city: record.city || null,
      state: record.state || null,
      postal_code: record.postal_code || record.zip || null,
      country: record.country || null,
      source: record.source || 'import',
    };

    contacts.push(contact);
  }

  return contacts;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export async function importContacts(
  organizationId: string,
  contacts: CreateContactData[],
  currentUser: User
): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;

  for (let i = 0; i < contacts.length; i++) {
    try {
      await createContact(organizationId, contacts[i], currentUser);
      imported++;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return { imported, errors };
}

export async function getContactSources(organizationId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('source')
    .eq('organization_id', organizationId)
    .not('source', 'is', null)
    .order('source');

  if (error) throw error;

  const sources = [...new Set((data || []).map((c) => c.source as string))];
  return sources;
}
