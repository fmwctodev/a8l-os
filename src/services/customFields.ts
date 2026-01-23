import { supabase } from '../lib/supabase';
import type { CustomField, ContactCustomFieldValue, User } from '../types';
import { logAudit } from './audit';

export interface CreateCustomFieldData {
  name: string;
  field_key: string;
  field_type: CustomField['field_type'];
  options?: string[] | null;
  is_required?: boolean;
  display_order?: number;
}

export async function getCustomFields(organizationId: string): Promise<CustomField[]> {
  const { data, error } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('organization_id', organizationId)
    .order('display_order')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getCustomFieldById(id: string): Promise<CustomField | null> {
  const { data, error } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCustomField(
  organizationId: string,
  fieldData: CreateCustomFieldData,
  currentUser: User
): Promise<CustomField> {
  const { data, error } = await supabase
    .from('custom_fields')
    .insert({
      organization_id: organizationId,
      ...fieldData,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'create',
    entityType: 'custom_field',
    entityId: data.id,
    afterState: data,
  });

  return data;
}

export async function updateCustomField(
  id: string,
  updates: Partial<CreateCustomFieldData>,
  currentUser: User
): Promise<CustomField> {
  const { data: before } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('custom_fields')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'update',
    entityType: 'custom_field',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data;
}

export async function deleteCustomField(id: string, currentUser: User): Promise<void> {
  const { data: before } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('custom_fields').delete().eq('id', id);

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'delete',
    entityType: 'custom_field',
    entityId: id,
    beforeState: before,
  });
}

export async function getContactCustomFieldValues(
  contactId: string
): Promise<ContactCustomFieldValue[]> {
  const { data, error } = await supabase
    .from('contact_custom_field_values')
    .select(`
      *,
      custom_field:custom_fields(*)
    `)
    .eq('contact_id', contactId);

  if (error) throw error;
  return data || [];
}

export async function setContactCustomFieldValue(
  contactId: string,
  customFieldId: string,
  value: unknown
): Promise<ContactCustomFieldValue> {
  const { data, error } = await supabase
    .from('contact_custom_field_values')
    .upsert(
      {
        contact_id: contactId,
        custom_field_id: customFieldId,
        value: value,
      },
      {
        onConflict: 'contact_id,custom_field_id',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteContactCustomFieldValue(
  contactId: string,
  customFieldId: string
): Promise<void> {
  const { error } = await supabase
    .from('contact_custom_field_values')
    .delete()
    .eq('contact_id', contactId)
    .eq('custom_field_id', customFieldId);

  if (error) throw error;
}

export async function setContactCustomFieldValues(
  contactId: string,
  values: Record<string, unknown>
): Promise<void> {
  for (const [fieldId, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === '') {
      await deleteContactCustomFieldValue(contactId, fieldId);
    } else {
      await setContactCustomFieldValue(contactId, fieldId, value);
    }
  }
}

export function generateFieldKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function formatFieldValue(field: CustomField, value: unknown): string {
  if (value === null || value === undefined) return '';

  switch (field.field_type) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'date':
      return new Date(value as string).toLocaleDateString();
    case 'multi_select':
      return Array.isArray(value) ? value.join(', ') : String(value);
    default:
      return String(value);
  }
}
