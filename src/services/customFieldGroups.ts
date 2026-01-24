import { supabase } from '../lib/supabase';
import type {
  CustomFieldGroup,
  CustomFieldScope,
  CreateCustomFieldGroupInput,
  UpdateCustomFieldGroupInput,
  CustomFieldGroupFilters,
  User,
} from '../types';
import { logAudit } from './audit';

export async function getCustomFieldGroups(
  organizationId: string,
  filters?: CustomFieldGroupFilters
): Promise<CustomFieldGroup[]> {
  let query = supabase
    .from('custom_field_groups')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order')
    .order('name');

  if (filters?.scope) {
    query = query.eq('scope', filters.scope);
  }

  if (filters?.active !== undefined) {
    query = query.eq('active', filters.active);
  }

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCustomFieldGroupById(id: string): Promise<CustomFieldGroup | null> {
  const { data, error } = await supabase
    .from('custom_field_groups')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCustomFieldGroupsWithFields(
  organizationId: string,
  scope: CustomFieldScope
): Promise<CustomFieldGroup[]> {
  const { data, error } = await supabase
    .from('custom_field_groups')
    .select(`
      *,
      fields:custom_fields(*)
    `)
    .eq('organization_id', organizationId)
    .eq('scope', scope)
    .is('fields.deleted_at', null)
    .order('sort_order')
    .order('name');

  if (error) throw error;

  return (data || []).map((group) => ({
    ...group,
    fields: (group.fields || []).sort(
      (a: { display_order: number }, b: { display_order: number }) =>
        a.display_order - b.display_order
    ),
  }));
}

export async function createCustomFieldGroup(
  organizationId: string,
  input: CreateCustomFieldGroupInput,
  currentUser: User
): Promise<CustomFieldGroup> {
  const { data, error } = await supabase
    .from('custom_field_groups')
    .insert({
      organization_id: organizationId,
      scope: input.scope,
      name: input.name,
      description: input.description ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'create',
    entityType: 'custom_field_group',
    entityId: data.id,
    afterState: data,
  });

  return data;
}

export async function updateCustomFieldGroup(
  id: string,
  input: UpdateCustomFieldGroupInput,
  currentUser: User
): Promise<CustomFieldGroup> {
  const { data: before } = await supabase
    .from('custom_field_groups')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('custom_field_groups')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'update',
    entityType: 'custom_field_group',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data;
}

export async function deleteCustomFieldGroup(
  id: string,
  currentUser: User
): Promise<void> {
  const { data: before } = await supabase
    .from('custom_field_groups')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('custom_field_groups')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'delete',
    entityType: 'custom_field_group',
    entityId: id,
    beforeState: before,
  });
}

export async function reorderCustomFieldGroups(
  organizationId: string,
  scope: CustomFieldScope,
  groupIds: string[],
  currentUser: User
): Promise<void> {
  const updates = groupIds.map((id, index) =>
    supabase
      .from('custom_field_groups')
      .update({ sort_order: index })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .eq('scope', scope)
  );

  await Promise.all(updates);

  await logAudit({
    userId: currentUser.id,
    action: 'reorder',
    entityType: 'custom_field_groups',
    entityId: `${organizationId}/${scope}`,
    afterState: { groupIds },
  });
}

export async function getGroupFieldCount(groupId: string): Promise<number> {
  const { count, error } = await supabase
    .from('custom_fields')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .is('deleted_at', null);

  if (error) throw error;
  return count || 0;
}

const DEFAULT_GROUPS: Record<CustomFieldScope, { name: string; description: string }[]> = {
  contact: [
    { name: 'Contact Information', description: 'Primary contact details and identifiers' },
    { name: 'Additional Information', description: 'Extended contact attributes and preferences' },
  ],
  opportunity: [
    { name: 'Deal Information', description: 'Core deal and transaction details' },
    { name: 'Custom Deal Data', description: 'Organization-specific opportunity fields' },
  ],
};

export async function ensureDefaultGroups(
  organizationId: string,
  scope: CustomFieldScope,
  currentUser: User
): Promise<CustomFieldGroup[]> {
  const existing = await getCustomFieldGroups(organizationId, { scope });

  if (existing.length > 0) {
    return existing;
  }

  const defaults = DEFAULT_GROUPS[scope];
  const created: CustomFieldGroup[] = [];

  for (let i = 0; i < defaults.length; i++) {
    const group = await createCustomFieldGroup(
      organizationId,
      {
        scope,
        name: defaults[i].name,
        description: defaults[i].description,
        sort_order: i,
      },
      currentUser
    );
    created.push(group);
  }

  return created;
}
