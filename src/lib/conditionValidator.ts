import type { Condition, ConditionGroup, ConditionValidationResult, ConditionValidationError, ConditionValidationWarning, FieldType } from '../types/conditions';
import { getFieldByKey } from './conditionFields';
import { getOperatorByKey, isOperatorValidForType, operatorRequiresValue, operatorRequiresSecondValue } from './conditionOperators';

export function validateConditions(conditions: ConditionGroup): ConditionValidationResult {
  const errors: ConditionValidationError[] = [];
  const warnings: ConditionValidationWarning[] = [];
  validateGroup(conditions, errors, warnings);
  return { valid: errors.length === 0, errors, warnings };
}

function validateGroup(group: ConditionGroup, errors: ConditionValidationError[], warnings: ConditionValidationWarning[]): void {
  if (!group.id) errors.push({ conditionId: 'unknown', field: '', message: 'Condition group is missing an ID', code: 'MISSING_GROUP_ID' });
  if (!['and', 'or'].includes(group.logicalOperator)) errors.push({ conditionId: group.id, field: '', message: 'Invalid logical operator', code: 'INVALID_LOGICAL_OPERATOR' });
  if (group.conditions.length === 0) warnings.push({ conditionId: group.id, field: '', message: 'Empty condition group will always evaluate to true', code: 'EMPTY_GROUP' });
  for (const item of group.conditions) {
    if ('logicalOperator' in item) validateGroup(item, errors, warnings);
    else validateCondition(item, errors, warnings);
  }
}

function validateCondition(condition: Condition, errors: ConditionValidationError[], warnings: ConditionValidationWarning[]): void {
  if (!condition.id) { errors.push({ conditionId: 'unknown', field: condition.field, message: 'Condition is missing an ID', code: 'MISSING_CONDITION_ID' }); return; }
  if (!condition.field) { errors.push({ conditionId: condition.id, field: '', message: 'Condition is missing a field', code: 'MISSING_FIELD' }); return; }
  const fieldDef = getFieldByKey(condition.field);
  if (!fieldDef) {
    if (condition.field.startsWith('custom_field.')) warnings.push({ conditionId: condition.id, field: condition.field, message: 'Custom field reference - ensure field exists', code: 'CUSTOM_FIELD_REFERENCE' });
    else errors.push({ conditionId: condition.id, field: condition.field, message: `Unknown field: ${condition.field}`, code: 'UNKNOWN_FIELD' });
  } else if (fieldDef.deprecated) {
    warnings.push({ conditionId: condition.id, field: condition.field, message: `Field is deprecated${fieldDef.replacedBy ? `. Use "${fieldDef.replacedBy}"` : ''}`, code: 'DEPRECATED_FIELD' });
  }
  if (!condition.operator) { errors.push({ conditionId: condition.id, field: condition.field, message: 'Condition is missing an operator', code: 'MISSING_OPERATOR' }); return; }
  const operatorDef = getOperatorByKey(condition.operator);
  if (!operatorDef) { errors.push({ conditionId: condition.id, field: condition.field, message: `Unknown operator: ${condition.operator}`, code: 'UNKNOWN_OPERATOR' }); return; }
  if (fieldDef && !isOperatorValidForType(condition.operator, fieldDef.type)) {
    errors.push({ conditionId: condition.id, field: condition.field, message: `Operator "${condition.operator}" is not valid for field type "${fieldDef.type}"`, code: 'INVALID_OPERATOR_FOR_TYPE' });
  }
  if (operatorRequiresValue(condition.operator) && (condition.value === undefined || condition.value === null || condition.value === '')) {
    errors.push({ conditionId: condition.id, field: condition.field, message: `Operator "${condition.operator}" requires a value`, code: 'MISSING_VALUE' });
  }
  if (operatorRequiresSecondValue(condition.operator) && (condition.secondaryValue === undefined || condition.secondaryValue === null || condition.secondaryValue === '')) {
    errors.push({ conditionId: condition.id, field: condition.field, message: `Operator "${condition.operator}" requires a second value`, code: 'MISSING_SECONDARY_VALUE' });
  }
}

export function getValidationSummary(result: ConditionValidationResult): string {
  if (result.valid && result.warnings.length === 0) return 'Conditions are valid';
  const parts: string[] = [];
  if (result.errors.length > 0) parts.push(`${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`);
  if (result.warnings.length > 0) parts.push(`${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}`);
  return parts.join(', ');
}
