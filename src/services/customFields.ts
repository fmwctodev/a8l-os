import { supabase } from '../lib/supabase';
import type {
  CustomField,
  CustomFieldScope,
  CustomFieldType,
  ContactCustomFieldValue,
  User,
  CustomFieldFilters,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
  SAFE_TYPE_MIGRATIONS,
} from '../types';
import { logAudit } from './audit';

export async function getCustomFields(
  organizationId: string,
  filters?: CustomFieldFilters
): Promise<CustomField[]> {
  let query = supabase
    .from('custom_fields')
    .select(`
      *,
      group:custom_field_groups(id, name, scope, sort_order, active)
    `)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('display_order')
    .order('name');

  if (filters?.scope) {
    query = query.eq('scope', filters.scope);
  }

  if (filters?.groupId !== undefined) {
    if (filters.groupId === null) {
      query = query.is('group_id', null);
    } else {
      query = query.eq('group_id', filters.groupId);
    }
  }

  if (filters?.fieldType && filters.fieldType.length > 0) {
    query = query.in('field_type', filters.fieldType);
  }

  if (filters?.active !== undefined) {
    query = query.eq('active', filters.active);
  }

  if (filters?.visibleInForms !== undefined) {
    query = query.eq('visible_in_forms', filters.visibleInForms);
  }

  if (filters?.visibleInSurveys !== undefined) {
    query = query.eq('visible_in_surveys', filters.visibleInSurveys);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,field_key.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCustomFieldById(id: string): Promise<CustomField | null> {
  const { data, error } = await supabase
    .from('custom_fields')
    .select(`
      *,
      group:custom_field_groups(id, name, scope, sort_order, active)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCustomField(
  organizationId: string,
  input: CreateCustomFieldInput,
  currentUser: User
): Promise<CustomField> {
  const { data, error } = await supabase
    .from('custom_fields')
    .insert({
      organization_id: organizationId,
      scope: input.scope,
      group_id: input.group_id,
      name: input.name,
      field_key: input.field_key,
      field_type: input.field_type,
      options: input.options,
      is_required: input.is_required ?? false,
      display_order: input.display_order ?? 0,
      placeholder: input.placeholder,
      help_text: input.help_text,
      visible_in_forms: input.visible_in_forms ?? true,
      visible_in_surveys: input.visible_in_surveys ?? true,
      filterable: input.filterable ?? true,
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
  input: UpdateCustomFieldInput,
  currentUser: User
): Promise<CustomField> {
  const { data: before } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('custom_fields')
    .update(input)
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

export async function softDeleteCustomField(
  id: string,
  currentUser: User
): Promise<void> {
  const { data: before } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('custom_fields')
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq('id', id);

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'soft_delete',
    entityType: 'custom_field',
    entityId: id,
    beforeState: before,
  });
}

export async function hardDeleteCustomField(
  id: string,
  currentUser: User
): Promise<void> {
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

export async function duplicateCustomField(
  id: string,
  currentUser: User
): Promise<CustomField> {
  const original = await getCustomFieldById(id);
  if (!original) throw new Error('Custom field not found');

  const newFieldKey = `${original.field_key}_copy_${Date.now()}`;
  const newName = `${original.name} (Copy)`;

  const { data, error } = await supabase
    .from('custom_fields')
    .insert({
      organization_id: original.organization_id,
      scope: original.scope,
      group_id: original.group_id,
      name: newName,
      field_key: newFieldKey,
      field_type: original.field_type,
      options: original.options,
      is_required: false,
      display_order: original.display_order + 1,
      placeholder: original.placeholder,
      help_text: original.help_text,
      visible_in_forms: original.visible_in_forms,
      visible_in_surveys: original.visible_in_surveys,
      filterable: original.filterable,
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'duplicate',
    entityType: 'custom_field',
    entityId: data.id,
    beforeState: { originalId: id },
    afterState: data,
  });

  return data;
}

export async function toggleCustomFieldActive(
  id: string,
  active: boolean,
  currentUser: User
): Promise<CustomField> {
  return updateCustomField(id, { active }, currentUser);
}

export async function reorderCustomFields(
  groupId: string | null,
  fieldIds: string[],
  currentUser: User
): Promise<void> {
  const updates = fieldIds.map((id, index) => {
    let query = supabase
      .from('custom_fields')
      .update({ display_order: index })
      .eq('id', id);

    if (groupId === null) {
      query = query.is('group_id', null);
    } else {
      query = query.eq('group_id', groupId);
    }

    return query;
  });

  await Promise.all(updates);

  await logAudit({
    userId: currentUser.id,
    action: 'reorder',
    entityType: 'custom_fields',
    entityId: groupId || 'ungrouped',
    afterState: { fieldIds },
  });
}

export async function moveFieldToGroup(
  fieldId: string,
  groupId: string | null,
  currentUser: User
): Promise<CustomField> {
  return updateCustomField(fieldId, { group_id: groupId }, currentUser);
}

export function canMigrateFieldType(
  fromType: CustomFieldType,
  toType: CustomFieldType,
  safeMigrations: typeof SAFE_TYPE_MIGRATIONS
): boolean {
  if (fromType === toType) return true;
  const allowedTargets = safeMigrations[fromType] || [];
  return allowedTargets.includes(toType);
}

export async function getFieldValueCount(fieldId: string, scope: CustomFieldScope): Promise<number> {
  const table = scope === 'contact' ? 'contact_custom_field_values' : 'org_opportunity_custom_field_values';
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('custom_field_id', fieldId);

  if (error) throw error;
  return count || 0;
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
    case 'checkbox':
      return value ? 'Yes' : 'No';
    case 'date':
      return new Date(value as string).toLocaleDateString();
    case 'datetime':
      return new Date(value as string).toLocaleString();
    case 'multi_select':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Number(value) || 0);
    default:
      return String(value);
  }
}

export function validateFieldValue(
  field: CustomField,
  value: unknown
): { valid: boolean; error?: string } {
  if (field.is_required && (value === null || value === undefined || value === '')) {
    return { valid: false, error: `${field.name} is required` };
  }

  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  switch (field.field_type) {
    case 'email':
      if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, error: 'Invalid email address' };
      }
      break;
    case 'url':
      try {
        new URL(value as string);
      } catch {
        return { valid: false, error: 'Invalid URL' };
      }
      break;
    case 'phone':
      if (typeof value === 'string' && !/^[\d\s\-+()]+$/.test(value)) {
        return { valid: false, error: 'Invalid phone number' };
      }
      break;
    case 'number':
    case 'currency':
      if (isNaN(Number(value))) {
        return { valid: false, error: 'Must be a valid number' };
      }
      break;
    case 'select':
    case 'radio':
      if (field.options && !field.options.includes(value as string)) {
        return { valid: true };
      }
      break;
    case 'multi_select':
      if (Array.isArray(value) && field.options) {
        const invalidOptions = value.filter((v) => !field.options!.includes(v));
        if (invalidOptions.length > 0) {
          return { valid: true };
        }
      }
      break;
  }

  return { valid: true };
}
