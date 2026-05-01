import { supabase } from '../lib/supabase';
import type {
  CustomObjectDefinition,
  CustomObjectFieldDefinition,
  CustomObjectRecord,
} from '../types';

export async function getCustomObjectDefinitions(
  organizationId: string,
  options?: { includeInactive?: boolean }
): Promise<CustomObjectDefinition[]> {
  let q = supabase
    .from('custom_object_definitions')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('is_builtin', { ascending: false })
    .order('name');
  if (!options?.includeInactive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as CustomObjectDefinition[];
}

export async function getCustomObjectDefinitionById(
  id: string
): Promise<CustomObjectDefinition | null> {
  const { data, error } = await supabase
    .from('custom_object_definitions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as CustomObjectDefinition | null;
}

export async function getCustomObjectDefinitionBySlug(
  organizationId: string,
  slug: string
): Promise<CustomObjectDefinition | null> {
  const { data, error } = await supabase
    .from('custom_object_definitions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as CustomObjectDefinition | null;
}

export async function createCustomObjectDefinition(
  organizationId: string,
  input: {
    slug: string;
    name: string;
    icon?: string;
    primary_field_key: string;
    field_definitions: CustomObjectFieldDefinition[];
  }
): Promise<CustomObjectDefinition> {
  const { data, error } = await supabase
    .from('custom_object_definitions')
    .insert({
      organization_id: organizationId,
      slug: input.slug,
      name: input.name,
      icon: input.icon,
      primary_field_key: input.primary_field_key,
      field_definitions: input.field_definitions,
      is_builtin: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CustomObjectDefinition;
}

export async function updateCustomObjectDefinition(
  id: string,
  updates: Partial<{
    name: string;
    icon: string | null;
    primary_field_key: string;
    field_definitions: CustomObjectFieldDefinition[];
    active: boolean;
  }>
): Promise<CustomObjectDefinition> {
  const { data, error } = await supabase
    .from('custom_object_definitions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as CustomObjectDefinition;
}

export async function softDeleteCustomObjectDefinition(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_object_definitions')
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq('id', id)
    .eq('is_builtin', false);
  if (error) throw error;
}

export async function getCustomObjectRecords(
  organizationId: string,
  objectDefId: string,
  filters?: { contactId?: string; search?: string }
): Promise<CustomObjectRecord[]> {
  let q = supabase
    .from('custom_object_records')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('object_def_id', objectDefId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (filters?.contactId) q = q.eq('contact_id', filters.contactId);
  if (filters?.search) q = q.ilike('primary_value', `%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as CustomObjectRecord[];
}

export async function upsertCustomObjectRecord(
  organizationId: string,
  objectDefId: string,
  input: { contactId?: string | null; primaryValue?: string | null; values: Record<string, unknown> }
): Promise<CustomObjectRecord> {
  if (input.contactId) {
    const existing = await supabase
      .from('custom_object_records')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('object_def_id', objectDefId)
      .eq('contact_id', input.contactId)
      .is('deleted_at', null)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      const merged = { ...(existing.data.values || {}), ...input.values };
      const { data, error } = await supabase
        .from('custom_object_records')
        .update({
          values: merged,
          primary_value: input.primaryValue ?? existing.data.primary_value,
        })
        .eq('id', existing.data.id)
        .select()
        .single();
      if (error) throw error;
      return data as CustomObjectRecord;
    }
  }

  const { data, error } = await supabase
    .from('custom_object_records')
    .insert({
      organization_id: organizationId,
      object_def_id: objectDefId,
      contact_id: input.contactId || null,
      primary_value: input.primaryValue || null,
      values: input.values,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CustomObjectRecord;
}

export async function deleteCustomObjectRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_object_records')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export function generateObjectFieldKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}
