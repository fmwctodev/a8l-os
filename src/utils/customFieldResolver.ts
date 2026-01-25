import { supabase } from '../lib/supabase';
import type { CustomField, CustomFieldScope } from '../types';

interface ResolvedFieldValue {
  fieldId: string;
  fieldKey: string;
  fieldName: string;
  fieldType: string;
  value: unknown;
  formattedValue: string;
  isValid: boolean;
  validationError?: string;
}

interface FieldDefinition {
  id: string;
  field_key: string;
  name: string;
  field_type: string;
  is_required: boolean;
  options?: string[];
  option_items?: Array<{ value: string; label: string; color?: string }>;
  default_value?: unknown;
  placeholder?: string;
  help_text?: string;
  group_id?: string;
  group_name?: string;
  validation_pattern?: string;
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
}

interface FieldInjectionContext {
  scope: CustomFieldScope;
  organizationId: string;
  visibleIn?: 'forms' | 'surveys' | 'automations' | 'reporting';
  includeInactive?: boolean;
}

export async function injectCustomFields(
  context: FieldInjectionContext
): Promise<FieldDefinition[]> {
  let query = supabase
    .from('custom_fields')
    .select(`
      id,
      field_key,
      name,
      field_type,
      is_required,
      options,
      option_items,
      default_value,
      placeholder,
      help_text,
      group_id,
      validation_pattern,
      min_value,
      max_value,
      min_length,
      max_length,
      group:custom_field_groups(name)
    `)
    .eq('organization_id', context.organizationId)
    .eq('scope', context.scope)
    .is('deleted_at', null)
    .order('display_order');

  if (!context.includeInactive) {
    query = query.eq('active', true);
  }

  if (context.visibleIn === 'forms') {
    query = query.eq('visible_in_forms', true);
  } else if (context.visibleIn === 'surveys') {
    query = query.eq('visible_in_surveys', true);
  } else if (context.visibleIn === 'automations') {
    query = query.eq('visible_in_automations', true);
  } else if (context.visibleIn === 'reporting') {
    query = query.eq('visible_in_reporting', true);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(field => ({
    ...field,
    group_name: field.group?.name || undefined,
  }));
}

export async function resolveEntityCustomFields(
  entityType: CustomFieldScope,
  entityId: string,
  organizationId: string
): Promise<ResolvedFieldValue[]> {
  const valueTable = entityType === 'contact'
    ? 'contact_custom_field_values'
    : 'org_opportunity_custom_field_values';

  const entityIdColumn = entityType === 'contact' ? 'contact_id' : 'org_id';

  const { data: fields, error: fieldsError } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('scope', entityType)
    .is('deleted_at', null)
    .eq('active', true);

  if (fieldsError) throw fieldsError;

  const { data: values, error: valuesError } = await supabase
    .from(valueTable)
    .select('custom_field_id, value')
    .eq(entityIdColumn, entityId);

  if (valuesError) throw valuesError;

  const valueMap = new Map<string, unknown>();
  (values || []).forEach(v => valueMap.set(v.custom_field_id, v.value));

  return (fields || []).map(field => {
    const value = valueMap.get(field.id) ?? field.default_value ?? null;
    const validation = validateFieldValue(field, value);

    return {
      fieldId: field.id,
      fieldKey: field.field_key,
      fieldName: field.name,
      fieldType: field.field_type,
      value,
      formattedValue: formatFieldValue(field, value),
      isValid: validation.valid,
      validationError: validation.error,
    };
  });
}

export async function getFieldsGroupedByGroup(
  organizationId: string,
  scope: CustomFieldScope
): Promise<Map<string | null, FieldDefinition[]>> {
  const fields = await injectCustomFields({
    scope,
    organizationId,
    includeInactive: false,
  });

  const grouped = new Map<string | null, FieldDefinition[]>();

  fields.forEach(field => {
    const groupId = field.group_id || null;
    if (!grouped.has(groupId)) {
      grouped.set(groupId, []);
    }
    grouped.get(groupId)!.push(field);
  });

  return grouped;
}

export function formatFieldValue(field: CustomField | FieldDefinition, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const fieldType = 'field_type' in field ? field.field_type : field.field_type;

  switch (fieldType) {
    case 'boolean':
    case 'checkbox':
      return value ? 'Yes' : 'No';

    case 'date':
      try {
        return new Date(value as string).toLocaleDateString();
      } catch {
        return String(value);
      }

    case 'datetime':
      try {
        return new Date(value as string).toLocaleString();
      } catch {
        return String(value);
      }

    case 'multi_select':
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);

    case 'currency':
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(numValue);
      }
      return String(value);

    case 'number':
      const num = Number(value);
      if (!isNaN(num)) {
        return new Intl.NumberFormat('en-US').format(num);
      }
      return String(value);

    case 'rating':
      const rating = Number(value);
      if (!isNaN(rating)) {
        return `${rating}/5`;
      }
      return String(value);

    case 'color':
      return String(value).toUpperCase();

    case 'file':
      if (typeof value === 'object' && value !== null) {
        return (value as { name?: string }).name || 'File';
      }
      return 'File';

    case 'signature':
      return value ? 'Signed' : 'Not signed';

    case 'select':
    case 'radio':
      if ('option_items' in field && field.option_items && Array.isArray(field.option_items)) {
        const optionItem = field.option_items.find(
          (item: { value: string; label: string }) => item.value === value
        );
        if (optionItem) {
          return optionItem.label;
        }
      }
      return String(value);

    default:
      return String(value);
  }
}

export function validateFieldValue(
  field: CustomField | FieldDefinition,
  value: unknown
): { valid: boolean; error?: string } {
  const fieldName = field.name;
  const isRequired = 'is_required' in field ? field.is_required : false;
  const fieldType = 'field_type' in field ? field.field_type : field.field_type;

  if (isRequired && (value === null || value === undefined || value === '')) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  const minLength = 'min_length' in field ? field.min_length : undefined;
  const maxLength = 'max_length' in field ? field.max_length : undefined;
  const minValue = 'min_value' in field ? field.min_value : undefined;
  const maxValue = 'max_value' in field ? field.max_value : undefined;
  const validationPattern = 'validation_pattern' in field ? field.validation_pattern : undefined;

  switch (fieldType) {
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
    case 'slider':
      const numVal = Number(value);
      if (isNaN(numVal)) {
        return { valid: false, error: 'Must be a valid number' };
      }
      if (minValue !== undefined && numVal < minValue) {
        return { valid: false, error: `Must be at least ${minValue}` };
      }
      if (maxValue !== undefined && numVal > maxValue) {
        return { valid: false, error: `Must be at most ${maxValue}` };
      }
      break;

    case 'text':
    case 'textarea':
      if (typeof value === 'string') {
        if (minLength !== undefined && value.length < minLength) {
          return { valid: false, error: `Must be at least ${minLength} characters` };
        }
        if (maxLength !== undefined && value.length > maxLength) {
          return { valid: false, error: `Must be at most ${maxLength} characters` };
        }
      }
      break;

    case 'rating':
      const ratingVal = Number(value);
      if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
        return { valid: false, error: 'Rating must be between 1 and 5' };
      }
      break;

    case 'color':
      if (typeof value === 'string' && !/^#[0-9A-Fa-f]{6}$/.test(value)) {
        return { valid: false, error: 'Invalid color format (use #RRGGBB)' };
      }
      break;
  }

  if (validationPattern && typeof value === 'string') {
    try {
      const regex = new RegExp(validationPattern);
      if (!regex.test(value)) {
        return { valid: false, error: 'Value does not match required pattern' };
      }
    } catch {
    }
  }

  return { valid: true };
}

export function validateAllFieldValues(
  fields: Array<CustomField | FieldDefinition>,
  values: Record<string, unknown>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const fieldKey = 'field_key' in field ? field.field_key : field.id;
    const value = values[fieldKey] ?? values[field.id];
    const validation = validateFieldValue(field, value);

    if (!validation.valid && validation.error) {
      errors[fieldKey] = validation.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function getFieldDefaultValue(field: CustomField | FieldDefinition): unknown {
  const defaultValue = 'default_value' in field ? field.default_value : undefined;
  const fieldType = 'field_type' in field ? field.field_type : field.field_type;

  if (defaultValue !== undefined && defaultValue !== null) {
    return defaultValue;
  }

  switch (fieldType) {
    case 'boolean':
    case 'checkbox':
      return false;
    case 'number':
    case 'currency':
    case 'slider':
    case 'rating':
      return null;
    case 'multi_select':
      return [];
    default:
      return null;
  }
}

export function buildFieldValuesObject(
  fields: Array<CustomField | FieldDefinition>,
  existingValues?: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const fieldKey = 'field_key' in field ? field.field_key : field.id;
    result[fieldKey] = existingValues?.[fieldKey] ?? getFieldDefaultValue(field);
  }

  return result;
}

export function convertFormSubmissionToFieldValues(
  formData: Record<string, string | string[]>,
  fields: Array<CustomField | FieldDefinition>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const fieldKey = 'field_key' in field ? field.field_key : field.id;
    const rawValue = formData[fieldKey];
    const fieldType = 'field_type' in field ? field.field_type : field.field_type;

    if (rawValue === undefined) {
      continue;
    }

    switch (fieldType) {
      case 'boolean':
      case 'checkbox':
        result[fieldKey] = rawValue === 'true' || rawValue === '1' || rawValue === 'on';
        break;
      case 'number':
      case 'currency':
      case 'slider':
      case 'rating':
        const numVal = Number(rawValue);
        result[fieldKey] = isNaN(numVal) ? null : numVal;
        break;
      case 'multi_select':
        result[fieldKey] = Array.isArray(rawValue) ? rawValue : [rawValue];
        break;
      case 'date':
      case 'datetime':
        result[fieldKey] = rawValue || null;
        break;
      default:
        result[fieldKey] = rawValue;
    }
  }

  return result;
}
