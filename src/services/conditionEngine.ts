import type { Condition, ConditionGroup, ConditionEvaluationContext, ConditionEvaluationResult, EvaluatedCondition, OperatorType } from '../types/conditions';
import { resolveDynamicValue } from '../lib/dynamicValueResolver';

export function evaluateConditions(conditions: ConditionGroup, context: ConditionEvaluationContext): ConditionEvaluationResult {
  const startTime = performance.now();
  const evaluatedConditions: EvaluatedCondition[] = [];
  const errors: string[] = [];
  try {
    const result = evaluateGroup(conditions, context, evaluatedConditions, errors);
    return { success: true, result, evaluatedConditions, duration_ms: performance.now() - startTime, errors: errors.length > 0 ? errors : undefined };
  } catch (error) {
    return { success: false, result: false, evaluatedConditions, duration_ms: performance.now() - startTime, errors: [error instanceof Error ? error.message : 'Unknown error'] };
  }
}

function evaluateGroup(group: ConditionGroup, context: ConditionEvaluationContext, evaluatedConditions: EvaluatedCondition[], errors: string[]): boolean {
  if (group.conditions.length === 0) return true;
  const results: boolean[] = [];
  for (const item of group.conditions) {
    if ('logicalOperator' in item) results.push(evaluateGroup(item, context, evaluatedConditions, errors));
    else {
      const evalResult = evaluateSingleCondition(item, context);
      evaluatedConditions.push(evalResult);
      if (evalResult.error) errors.push(evalResult.error);
      results.push(evalResult.result);
    }
  }
  return group.logicalOperator === 'and' ? results.every(r => r) : results.some(r => r);
}

function evaluateSingleCondition(condition: Condition, context: ConditionEvaluationContext): EvaluatedCondition {
  try {
    const actualValue = resolveFieldValue(condition.field, context);
    const expectedValue = resolveDynamicValue(condition.value, context);
    const secondaryValue = condition.secondaryValue ? resolveDynamicValue(condition.secondaryValue, context) : undefined;
    const result = evaluateOperator(condition.operator, actualValue, expectedValue, secondaryValue, context, condition);
    return { conditionId: condition.id, field: condition.field, operator: condition.operator, expectedValue, actualValue, result };
  } catch (error) {
    return { conditionId: condition.id, field: condition.field, operator: condition.operator, expectedValue: condition.value, actualValue: null, result: false, error: error instanceof Error ? error.message : 'Evaluation error' };
  }
}

function resolveFieldValue(fieldPath: string, context: ConditionEvaluationContext): unknown {
  const parts = fieldPath.split('.');
  let current: unknown = context.entityData;
  if (parts[0] && parts[0] !== context.entityType && context.relatedEntities) { current = context.relatedEntities[parts[0]]; parts.shift(); }
  for (const part of parts) { if (current === null || current === undefined) return null; current = (current as Record<string, unknown>)[part]; }
  return current;
}

function getPreviousValue(fieldPath: string, context: ConditionEvaluationContext): unknown {
  if (!context.previousEntityData) return undefined;
  const parts = fieldPath.split('.'); let current: unknown = context.previousEntityData;
  for (const part of parts) { if (current === null || current === undefined) return undefined; current = (current as Record<string, unknown>)[part]; }
  return current;
}

function evaluateOperator(operator: OperatorType, actual: unknown, expected: unknown, secondary: unknown, context: ConditionEvaluationContext, condition: Condition): boolean {
  const caseSensitive = condition.caseSensitive ?? false;
  switch (operator) {
    case 'equals': return compareValues(actual, expected, caseSensitive);
    case 'not_equals': return !compareValues(actual, expected, caseSensitive);
    case 'contains': return stringContains(actual, expected, caseSensitive);
    case 'not_contains': return !stringContains(actual, expected, caseSensitive);
    case 'starts_with': return stringStartsWith(actual, expected, caseSensitive);
    case 'ends_with': return stringEndsWith(actual, expected, caseSensitive);
    case 'regex_matches': return regexMatches(actual, expected, caseSensitive);
    case 'is_empty': return isEmpty(actual);
    case 'is_not_empty': return !isEmpty(actual);
    case 'greater_than': return compareNumbers(actual, expected) > 0;
    case 'less_than': return compareNumbers(actual, expected) < 0;
    case 'greater_than_or_equal': return compareNumbers(actual, expected) >= 0;
    case 'less_than_or_equal': return compareNumbers(actual, expected) <= 0;
    case 'between': return isNumberBetween(actual, expected, secondary);
    case 'not_between': return !isNumberBetween(actual, expected, secondary);
    case 'in_list': return isInList(actual, expected, caseSensitive);
    case 'not_in_list': return !isInList(actual, expected, caseSensitive);
    case 'date_before': return compareDates(actual, expected) < 0;
    case 'date_after': return compareDates(actual, expected) > 0;
    case 'date_on': return compareDatesOnly(actual, expected) === 0;
    case 'date_between': return isDateBetween(actual, expected, secondary);
    case 'date_within_last': return isDateWithinLast(actual, expected as number);
    case 'date_within_next': return isDateWithinNext(actual, expected as number);
    case 'date_is_today': return isToday(actual);
    case 'date_is_this_week': return isThisWeek(actual);
    case 'date_is_this_month': return isThisMonth(actual);
    case 'date_is_this_year': return isThisYear(actual);
    case 'has_tag': return hasTag(actual, expected);
    case 'not_has_tag': return !hasTag(actual, expected);
    case 'has_any_tag': return hasAnyTag(actual, expected);
    case 'has_all_tags': return hasAllTags(actual, expected);
    case 'changed': { const previous = getPreviousValue(condition.field, context); return previous !== undefined && !compareValues(actual, previous, caseSensitive); }
    case 'changed_from': { const previous = getPreviousValue(condition.field, context); return compareValues(previous, expected, caseSensitive) && !compareValues(actual, expected, caseSensitive); }
    case 'changed_to': { const previous = getPreviousValue(condition.field, context); return previous !== undefined && !compareValues(previous, expected, caseSensitive) && compareValues(actual, expected, caseSensitive); }
    case 'increased': { const previous = getPreviousValue(condition.field, context); return typeof previous === 'number' && typeof actual === 'number' && actual > previous; }
    case 'decreased': { const previous = getPreviousValue(condition.field, context); return typeof previous === 'number' && typeof actual === 'number' && actual < previous; }
    case 'increased_by': { const previous = getPreviousValue(condition.field, context); const amount = Number(expected) || 0; return typeof previous === 'number' && typeof actual === 'number' && (actual - previous) >= amount; }
    case 'decreased_by': { const previous = getPreviousValue(condition.field, context); const amount = Number(expected) || 0; return typeof previous === 'number' && typeof actual === 'number' && (previous - actual) >= amount; }
    default: return false;
  }
}

function compareValues(a: unknown, b: unknown, caseSensitive: boolean): boolean {
  if (a === b) return true; if (a === null || a === undefined || b === null || b === undefined) return a === b;
  if (typeof a === 'string' && typeof b === 'string') return caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase();
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return String(a) === String(b);
}
function stringContains(actual: unknown, expected: unknown, caseSensitive: boolean): boolean { if (actual == null) return false; const str = String(actual), search = String(expected); return caseSensitive ? str.includes(search) : str.toLowerCase().includes(search.toLowerCase()); }
function stringStartsWith(actual: unknown, expected: unknown, caseSensitive: boolean): boolean { if (actual == null) return false; const str = String(actual), search = String(expected); return caseSensitive ? str.startsWith(search) : str.toLowerCase().startsWith(search.toLowerCase()); }
function stringEndsWith(actual: unknown, expected: unknown, caseSensitive: boolean): boolean { if (actual == null) return false; const str = String(actual), search = String(expected); return caseSensitive ? str.endsWith(search) : str.toLowerCase().endsWith(search.toLowerCase()); }
function regexMatches(actual: unknown, pattern: unknown, caseSensitive: boolean): boolean { if (actual == null) return false; try { return new RegExp(String(pattern), caseSensitive ? '' : 'i').test(String(actual)); } catch { return false; } }
function isEmpty(value: unknown): boolean { if (value == null) return true; if (typeof value === 'string') return value.trim() === ''; if (Array.isArray(value)) return value.length === 0; if (typeof value === 'object') return Object.keys(value).length === 0; return false; }
function compareNumbers(a: unknown, b: unknown): number { return (Number(a) || 0) - (Number(b) || 0); }
function isNumberBetween(value: unknown, min: unknown, max: unknown): boolean { const num = Number(value), minNum = Number(min), maxNum = Number(max); if (isNaN(num) || isNaN(minNum) || isNaN(maxNum)) return false; return num >= minNum && num <= maxNum; }
function isInList(value: unknown, list: unknown, caseSensitive: boolean): boolean { const arr = Array.isArray(list) ? list : [list]; const val = caseSensitive ? value : String(value).toLowerCase(); return arr.some(item => (caseSensitive ? item : String(item).toLowerCase()) === val); }
function compareDates(a: unknown, b: unknown): number { return (a ? new Date(String(a)).getTime() : 0) - (b ? new Date(String(b)).getTime() : 0); }
function compareDatesOnly(a: unknown, b: unknown): number { const dateA = a ? new Date(String(a)) : new Date(0); const dateB = b ? new Date(String(b)) : new Date(0); dateA.setHours(0,0,0,0); dateB.setHours(0,0,0,0); return dateA.getTime() - dateB.getTime(); }
function isDateBetween(value: unknown, start: unknown, end: unknown): boolean { const date = value ? new Date(String(value)).getTime() : 0; const startDate = start ? new Date(String(start)).getTime() : 0; const endDate = end ? new Date(String(end)).getTime() : Infinity; return date >= startDate && date <= endDate; }
function isDateWithinLast(value: unknown, days: number): boolean { if (!value) return false; const date = new Date(String(value)), now = new Date(), threshold = new Date(now.getTime() - days * 86400000); return date >= threshold && date <= now; }
function isDateWithinNext(value: unknown, days: number): boolean { if (!value) return false; const date = new Date(String(value)), now = new Date(), threshold = new Date(now.getTime() + days * 86400000); return date >= now && date <= threshold; }
function isToday(value: unknown): boolean { if (!value) return false; const date = new Date(String(value)), today = new Date(); return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate(); }
function isThisWeek(value: unknown): boolean { if (!value) return false; const date = new Date(String(value)), now = new Date(); const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0); const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 7); return date >= startOfWeek && date < endOfWeek; }
function isThisMonth(value: unknown): boolean { if (!value) return false; const date = new Date(String(value)), now = new Date(); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); }
function isThisYear(value: unknown): boolean { if (!value) return false; const date = new Date(String(value)), now = new Date(); return date.getFullYear() === now.getFullYear(); }
function hasTag(actual: unknown, tag: unknown): boolean { const tags = Array.isArray(actual) ? actual : []; const searchTag = String(tag).toLowerCase(); return tags.some(t => String(t).toLowerCase() === searchTag); }
function hasAnyTag(actual: unknown, searchTags: unknown): boolean { const tags = Array.isArray(actual) ? actual.map(t => String(t).toLowerCase()) : []; const search = Array.isArray(searchTags) ? searchTags : [searchTags]; return search.some(t => tags.includes(String(t).toLowerCase())); }
function hasAllTags(actual: unknown, searchTags: unknown): boolean { const tags = Array.isArray(actual) ? actual.map(t => String(t).toLowerCase()) : []; const search = Array.isArray(searchTags) ? searchTags : [searchTags]; return search.every(t => tags.includes(String(t).toLowerCase())); }
