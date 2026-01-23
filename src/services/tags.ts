import { supabase } from '../lib/supabase';
import type { Tag, User } from '../types';
import { logAudit } from './audit';
import { addTimelineEvent } from './contactTimeline';
import { publishEvent } from './eventOutbox';

export async function getTags(organizationId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getTagById(id: string): Promise<Tag | null> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createTag(
  organizationId: string,
  name: string,
  color: string,
  currentUser: User
): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .insert({
      organization_id: organizationId,
      name,
      color,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'create',
    entityType: 'tag',
    entityId: data.id,
    afterState: data,
  });

  return data;
}

export async function updateTag(
  id: string,
  updates: { name?: string; color?: string },
  currentUser: User
): Promise<Tag> {
  const { data: before } = await supabase.from('tags').select('*').eq('id', id).maybeSingle();

  const { data, error } = await supabase
    .from('tags')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'update',
    entityType: 'tag',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data;
}

export async function deleteTag(id: string, currentUser: User): Promise<void> {
  const { data: before } = await supabase.from('tags').select('*').eq('id', id).maybeSingle();

  const { error } = await supabase.from('tags').delete().eq('id', id);

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'delete',
    entityType: 'tag',
    entityId: id,
    beforeState: before,
  });
}

export async function addTagToContact(
  contactId: string,
  tagId: string,
  currentUser: User
): Promise<void> {
  const { error } = await supabase.from('contact_tags').insert({
    contact_id: contactId,
    tag_id: tagId,
  });

  if (error && error.code !== '23505') throw error;

  const tag = await getTagById(tagId);

  await addTimelineEvent(contactId, currentUser.id, 'tag_added', {
    tag_id: tagId,
    tag_name: tag?.name,
  });

  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('organization_id')
      .eq('id', contactId)
      .single();

    if (contact) {
      await publishEvent(
        contact.organization_id,
        'contact_tag_added',
        'contact',
        contactId,
        contactId,
        { tag_id: tagId, tag_name: tag?.name }
      );
    }
  } catch {
  }
}

export async function removeTagFromContact(
  contactId: string,
  tagId: string,
  currentUser: User
): Promise<void> {
  const tag = await getTagById(tagId);

  const { error } = await supabase
    .from('contact_tags')
    .delete()
    .eq('contact_id', contactId)
    .eq('tag_id', tagId);

  if (error) throw error;

  await addTimelineEvent(contactId, currentUser.id, 'tag_removed', {
    tag_id: tagId,
    tag_name: tag?.name,
  });

  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('organization_id')
      .eq('id', contactId)
      .single();

    if (contact) {
      await publishEvent(
        contact.organization_id,
        'contact_tag_removed',
        'contact',
        contactId,
        contactId,
        { tag_id: tagId, tag_name: tag?.name }
      );
    }
  } catch {
  }
}

export async function getContactTags(contactId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('contact_tags')
    .select('tag:tags(*)')
    .eq('contact_id', contactId);

  if (error) throw error;
  return (data || []).map((ct) => ct.tag as Tag);
}

const TAG_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
];

export function getRandomTagColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}
