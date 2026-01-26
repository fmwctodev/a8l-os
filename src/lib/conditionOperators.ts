import type { OperatorDefinition, OperatorType, FieldType } from '../types/conditions';

export const OPERATOR_REGISTRY: OperatorDefinition[] = [
  { key: 'equals', label: 'Equals', description: 'Value exactly matches', applicableTypes: ['text', 'email', 'phone', 'url', 'select', 'number', 'currency', 'percentage'], requiresValue: true, requiresSecondValue: false },
  { key: 'not_equals', label: 'Does not equal', description: 'Value does not match', applicableTypes: ['text', 'email', 'phone', 'url', 'select', 'number', 'currency', 'percentage'], requiresValue: true, requiresSecondValue: false },
  { key: 'contains', label: 'Contains', description: 'Value contains the specified text', applicableTypes: ['text', 'email', 'phone', 'url'], requiresValue: true, requiresSecondValue: false },
  { key: 'not_contains', label: 'Does not contain', description: 'Value does not contain the specified text', applicableTypes: ['text', 'email', 'phone', 'url'], requiresValue: true, requiresSecondValue: false },
  { key: 'starts_with', label: 'Starts with', description: 'Value starts with the specified text', applicableTypes: ['text', 'email', 'phone', 'url'], requiresValue: true, requiresSecondValue: false },
  { key: 'ends_with', label: 'Ends with', description: 'Value ends with the specified text', applicableTypes: ['text', 'email', 'phone', 'url'], requiresValue: true, requiresSecondValue: false },
  { key: 'regex_matches', label: 'Matches pattern', description: 'Value matches the regular expression', applicableTypes: ['text', 'email', 'phone', 'url'], requiresValue: true, requiresSecondValue: false, valueLabel: 'Regex Pattern' },
  { key: 'is_empty', label: 'Is empty', description: 'Value is empty or null', applicableTypes: ['text', 'email', 'phone', 'url', 'select', 'multi_select', 'number', 'currency', 'percentage', 'date', 'datetime', 'tags'], requiresValue: false, requiresSecondValue: false },
  { key: 'is_not_empty', label: 'Is not empty', description: 'Value is not empty', applicableTypes: ['text', 'email', 'phone', 'url', 'select', 'multi_select', 'number', 'currency', 'percentage', 'date', 'datetime', 'tags'], requiresValue: false, requiresSecondValue: false },
  { key: 'greater_than', label: 'Greater than', description: 'Value is greater than', applicableTypes: ['number', 'currency', 'percentage', 'duration'], requiresValue: true, requiresSecondValue: false },
  { key: 'less_than', label: 'Less than', description: 'Value is less than', applicableTypes: ['number', 'currency', 'percentage', 'duration'], requiresValue: true, requiresSecondValue: false },
  { key: 'greater_than_or_equal', label: 'Greater than or equal', description: 'Value is >= specified', applicableTypes: ['number', 'currency', 'percentage', 'duration'], requiresValue: true, requiresSecondValue: false },
  { key: 'less_than_or_equal', label: 'Less than or equal', description: 'Value is <= specified', applicableTypes: ['number', 'currency', 'percentage', 'duration'], requiresValue: true, requiresSecondValue: false },
  { key: 'between', label: 'Between', description: 'Value is between two numbers', applicableTypes: ['number', 'currency', 'percentage', 'duration'], requiresValue: true, requiresSecondValue: true, valueType: 'range', valueLabel: 'Minimum', secondValueLabel: 'Maximum' },
  { key: 'not_between', label: 'Not between', description: 'Value is not between two numbers', applicableTypes: ['number', 'currency', 'percentage', 'duration'], requiresValue: true, requiresSecondValue: true, valueType: 'range' },
  { key: 'in_list', label: 'Is one of', description: 'Value is one of the specified values', applicableTypes: ['text', 'select', 'multi_select', 'number'], requiresValue: true, requiresSecondValue: false, valueType: 'array' },
  { key: 'not_in_list', label: 'Is not one of', description: 'Value is not one of the specified values', applicableTypes: ['text', 'select', 'multi_select', 'number'], requiresValue: true, requiresSecondValue: false, valueType: 'array' },
  { key: 'date_before', label: 'Before', description: 'Date is before', applicableTypes: ['date', 'datetime'], requiresValue: true, requiresSecondValue: false },
  { key: 'date_after', label: 'After', description: 'Date is after', applicableTypes: ['date', 'datetime'], requiresValue: true, requiresSecondValue: false },
  { key: 'date_on', label: 'On', description: 'Date is on', applicableTypes: ['date', 'datetime'], requiresValue: true, requiresSecondValue: false },
  { key: 'date_between', label: 'Between dates', description: 'Date is between', applicableTypes: ['date', 'datetime'], requiresValue: true, requiresSecondValue: true, valueType: 'range', valueLabel: 'Start Date', secondValueLabel: 'End Date' },
  { key: 'date_within_last', label: 'Within last', description: 'Date is within last N days', applicableTypes: ['date', 'datetime'], requiresValue: true, requiresSecondValue: false, valueLabel: 'Days' },
  { key: 'date_within_next', label: 'Within next', description: 'Date is within next N days', applicableTypes: ['date', 'datetime'], requiresValue: true, requiresSecondValue: false, valueLabel: 'Days' },
  { key: 'date_is_today', label: 'Is today', description: 'Date is today', applicableTypes: ['date', 'datetime'], requiresValue: false, requiresSecondValue: false },
  { key: 'date_is_this_week', label: 'Is this week', description: 'Date is this week', applicableTypes: ['date', 'datetime'], requiresValue: false, requiresSecondValue: false },
  { key: 'date_is_this_month', label: 'Is this month', description: 'Date is this month', applicableTypes: ['date', 'datetime'], requiresValue: false, requiresSecondValue: false },
  { key: 'date_is_this_year', label: 'Is this year', description: 'Date is this year', applicableTypes: ['date', 'datetime'], requiresValue: false, requiresSecondValue: false },
  { key: 'has_tag', label: 'Has tag', description: 'Has the specified tag', applicableTypes: ['tags'], requiresValue: true, requiresSecondValue: false },
  { key: 'not_has_tag', label: 'Does not have tag', description: 'Does not have the tag', applicableTypes: ['tags'], requiresValue: true, requiresSecondValue: false },
  { key: 'has_any_tag', label: 'Has any of tags', description: 'Has any of the tags', applicableTypes: ['tags'], requiresValue: true, requiresSecondValue: false, valueType: 'array' },
  { key: 'has_all_tags', label: 'Has all tags', description: 'Has all of the tags', applicableTypes: ['tags'], requiresValue: true, requiresSecondValue: false, valueType: 'array' },
  { key: 'changed', label: 'Changed', description: 'Value has changed', applicableTypes: ['text', 'email', 'phone', 'url', 'select', 'number', 'currency', 'percentage', 'date', 'datetime', 'boolean'], requiresValue: false, requiresSecondValue: false },
  { key: 'changed_from', label: 'Changed from', description: 'Value changed from', applicableTypes: ['text', 'email', 'phone', 'url', 'select', 'number', 'currency', 'percentage', 'date', 'datetime', 'boolean'], requiresValue: true, requiresSecondValue: false },
  { key: 'changed_to', label: 'Changed to', description: 'Value changed to', applicableTypes: ['text', 'email', 'phone', 'url', 'select', 'number', 'currency', 'percentage', 'date', 'datetime', 'boolean'], requiresValue: true, requiresSecondValue: false },
  { key: 'increased', label: 'Increased', description: 'Value increased', applicableTypes: ['number', 'currency', 'percentage'], requiresValue: false, requiresSecondValue: false },
  { key: 'decreased', label: 'Decreased', description: 'Value decreased', applicableTypes: ['number', 'currency', 'percentage'], requiresValue: false, requiresSecondValue: false },
  { key: 'increased_by', label: 'Increased by at least', description: 'Value increased by amount', applicableTypes: ['number', 'currency', 'percentage'], requiresValue: true, requiresSecondValue: false },
  { key: 'decreased_by', label: 'Decreased by at least', description: 'Value decreased by amount', applicableTypes: ['number', 'currency', 'percentage'], requiresValue: true, requiresSecondValue: false },
];

export function getOperatorsByFieldType(fieldType: FieldType): OperatorDefinition[] {
  return OPERATOR_REGISTRY.filter(op => op.applicableTypes.includes(fieldType));
}

export function getOperatorByKey(key: OperatorType): OperatorDefinition | undefined {
  return OPERATOR_REGISTRY.find(op => op.key === key);
}

export function isOperatorValidForType(operator: OperatorType, fieldType: FieldType): boolean {
  const op = getOperatorByKey(operator);
  return op ? op.applicableTypes.includes(fieldType) : false;
}

export function getDefaultOperatorForType(fieldType: FieldType): OperatorType {
  const typeDefaults: Record<FieldType, OperatorType> = {
    text: 'contains', number: 'equals', date: 'date_after', datetime: 'date_after', boolean: 'equals',
    select: 'equals', multi_select: 'in_list', tags: 'has_tag', email: 'contains', phone: 'equals',
    url: 'contains', currency: 'greater_than', percentage: 'greater_than_or_equal', duration: 'greater_than',
    user_reference: 'equals', contact_reference: 'equals', opportunity_reference: 'equals',
  };
  return typeDefaults[fieldType] || 'equals';
}

export function operatorRequiresValue(operator: OperatorType): boolean {
  const op = getOperatorByKey(operator);
  return op?.requiresValue ?? true;
}

export function operatorRequiresSecondValue(operator: OperatorType): boolean {
  const op = getOperatorByKey(operator);
  return op?.requiresSecondValue ?? false;
}
