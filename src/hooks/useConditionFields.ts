import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { FieldDefinition, EntityType, OperatorDefinition, FieldType } from '../types/conditions';
import { FIELD_REGISTRY, getFieldsByCategory, getFieldByKey } from '../lib/conditionFields';
import { getOperatorsByFieldType, getDefaultOperatorForType } from '../lib/conditionOperators';

interface UseConditionFieldsOptions { entityTypes?: EntityType[]; includeCustomFields?: boolean; }
interface UseConditionFieldsReturn {
  fields: FieldDefinition[]; loading: boolean; error: string | null;
  getFieldByKey: (key: string) => FieldDefinition | undefined;
  getOperatorsForField: (fieldKey: string) => OperatorDefinition[];
  getDefaultOperator: (fieldKey: string) => string;
  searchFields: (query: string) => FieldDefinition[];
  getFieldsByCategory: (category: EntityType) => FieldDefinition[];
  categories: Array<{ key: EntityType; label: string; count: number }>;
  refreshCustomFields: () => Promise<void>;
}

export function useConditionFields(options: UseConditionFieldsOptions = {}): UseConditionFieldsReturn {
  const { user } = useAuth();
  const [customFields, setCustomFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { entityTypes, includeCustomFields = true } = options;

  const loadCustomFields = useCallback(async () => {
    if (!includeCustomFields || !user?.org_id) return;
    setLoading(true); setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('custom_fields').select('id, name, field_key, field_type, entity_type, options, is_required').eq('org_id', user.org_id).eq('is_active', true).order('display_order');
      if (fetchError) throw fetchError;
      const mappedFields: FieldDefinition[] = (data || []).map(cf => ({
        key: `custom_field.${cf.field_key}`, label: cf.name, type: mapCustomFieldType(cf.field_type), category: 'custom_field' as EntityType,
        description: `Custom field for ${cf.entity_type}`, options: cf.options ? parseOptions(cf.options) : undefined,
        metadata: { customFieldId: cf.id, entityType: cf.entity_type, isRequired: cf.is_required },
      }));
      setCustomFields(mappedFields);
    } catch (err) { console.error('Failed to load custom fields:', err); setError(err instanceof Error ? err.message : 'Failed to load custom fields'); } finally { setLoading(false); }
  }, [includeCustomFields, user?.org_id]);

  useEffect(() => { loadCustomFields(); }, [loadCustomFields]);

  const fields = useMemo(() => {
    let result: FieldDefinition[] = [];
    if (entityTypes && entityTypes.length > 0) { for (const entityType of entityTypes) result = [...result, ...getFieldsByCategory(entityType)]; }
    else result = [...FIELD_REGISTRY];
    if (includeCustomFields && customFields.length > 0) result = [...result, ...customFields];
    return result.filter(f => !f.deprecated);
  }, [entityTypes, includeCustomFields, customFields]);

  const categories = useMemo(() => {
    const categoryMap = new Map<EntityType, number>();
    for (const field of fields) { const count = categoryMap.get(field.category) || 0; categoryMap.set(field.category, count + 1); }
    const categoryLabels: Record<EntityType, string> = { contact: 'Contact', opportunity: 'Opportunity', appointment: 'Appointment', invoice: 'Invoice', conversation: 'Conversation', message: 'Message', workflow: 'Workflow', form_submission: 'Form Submission', survey_response: 'Survey Response', payment: 'Payment', review: 'Review', social_post: 'Social Post', email: 'Email', call: 'Call', task: 'Task', note: 'Note', custom_field: 'Custom Fields' };
    return Array.from(categoryMap.entries()).map(([key, count]) => ({ key, label: categoryLabels[key] || key, count })).sort((a, b) => a.label.localeCompare(b.label));
  }, [fields]);

  const getFieldByKeyLocal = useCallback((key: string): FieldDefinition | undefined => { const standardField = getFieldByKey(key); if (standardField) return standardField; return customFields.find(f => f.key === key); }, [customFields]);
  const getOperatorsForField = useCallback((fieldKey: string): OperatorDefinition[] => { const field = getFieldByKeyLocal(fieldKey); if (!field) return []; return getOperatorsByFieldType(field.type); }, [getFieldByKeyLocal]);
  const getDefaultOperatorLocal = useCallback((fieldKey: string): string => { const field = getFieldByKeyLocal(fieldKey); if (!field) return 'equals'; if (field.defaultOperator) return field.defaultOperator; return getDefaultOperatorForType(field.type); }, [getFieldByKeyLocal]);
  const searchFieldsLocal = useCallback((query: string): FieldDefinition[] => { if (!query.trim()) return fields; const lowerQuery = query.toLowerCase(); return fields.filter(f => f.key.toLowerCase().includes(lowerQuery) || f.label.toLowerCase().includes(lowerQuery) || f.description?.toLowerCase().includes(lowerQuery)); }, [fields]);
  const getFieldsByCategoryLocal = useCallback((category: EntityType): FieldDefinition[] => fields.filter(f => f.category === category), [fields]);

  return { fields, loading, error, getFieldByKey: getFieldByKeyLocal, getOperatorsForField, getDefaultOperator: getDefaultOperatorLocal, searchFields: searchFieldsLocal, getFieldsByCategory: getFieldsByCategoryLocal, categories, refreshCustomFields: loadCustomFields };
}

function mapCustomFieldType(customFieldType: string): FieldType {
  const typeMap: Record<string, FieldType> = { text: 'text', textarea: 'text', number: 'number', decimal: 'number', currency: 'currency', percentage: 'percentage', date: 'date', datetime: 'datetime', checkbox: 'boolean', select: 'select', multi_select: 'multi_select', radio: 'select', email: 'email', phone: 'phone', url: 'url' };
  return typeMap[customFieldType] || 'text';
}

function parseOptions(options: unknown): Array<{ value: string; label: string }> | undefined {
  if (!options || !Array.isArray(options)) return undefined;
  return options.map(opt => { if (typeof opt === 'string') return { value: opt, label: opt }; if (typeof opt === 'object' && opt !== null) return { value: String((opt as Record<string, unknown>).value || ''), label: String((opt as Record<string, unknown>).label || '') }; return { value: String(opt), label: String(opt) }; });
}
