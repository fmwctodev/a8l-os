import type { DynamicValue, ConditionEvaluationContext } from '../types/conditions';

export function resolveDynamicValue(value: unknown, context: ConditionEvaluationContext): unknown {
  if (!isDynamicValue(value)) return value;
  const dynamicValue = value as DynamicValue;
  switch (dynamicValue.type) {
    case 'field': return resolveFieldValue(dynamicValue, context);
    case 'function': return resolveFunctionValue(dynamicValue, context);
    case 'variable': return resolveVariableValue(dynamicValue, context);
    case 'constant': return dynamicValue.source;
    default: return dynamicValue.fallback ?? null;
  }
}

function isDynamicValue(value: unknown): value is DynamicValue {
  return typeof value === 'object' && value !== null && 'type' in value && 'source' in value &&
    ['field', 'function', 'constant', 'variable'].includes((value as DynamicValue).type);
}

function resolveFieldValue(value: DynamicValue, context: ConditionEvaluationContext): unknown {
  const path = value.path || value.source;
  const parts = path.split('.');
  let current: unknown = context.entityData;
  if (parts[0] && parts[0] !== context.entityType) {
    current = context.relatedEntities?.[parts[0]];
    parts.shift();
  }
  for (const part of parts) {
    if (current === null || current === undefined) return value.fallback ?? null;
    current = (current as Record<string, unknown>)[part];
  }
  return current ?? value.fallback ?? null;
}

function resolveFunctionValue(value: DynamicValue, context: ConditionEvaluationContext): unknown {
  const functionName = value.source;
  const params = value.params || {};
  switch (functionName) {
    case 'now': return new Date().toISOString();
    case 'today': return new Date().toISOString().split('T')[0];
    case 'days_ago': {
      const days = Number(params.days) || 0;
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date.toISOString().split('T')[0];
    }
    case 'days_from_now': {
      const days = Number(params.days) || 0;
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date.toISOString().split('T')[0];
    }
    case 'current_user_id': return context.currentUser?.id ?? null;
    case 'current_org_id': return context.currentUser?.org_id ?? null;
    case 'entity_age_days': {
      const createdAt = context.entityData.created_at as string;
      if (!createdAt) return null;
      const created = new Date(createdAt);
      const now = new Date();
      return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }
    default: return value.fallback ?? null;
  }
}

function resolveVariableValue(value: DynamicValue, context: ConditionEvaluationContext): unknown {
  const variableName = value.source;
  const builtInVariables: Record<string, unknown> = {
    entity_id: context.entityId, entity_type: context.entityType, timestamp: context.timestamp,
    current_user_id: context.currentUser?.id, current_org_id: context.currentUser?.org_id,
  };
  if (variableName in builtInVariables) return builtInVariables[variableName];
  if (context.metadata && variableName in context.metadata) return context.metadata[variableName];
  return value.fallback ?? null;
}

export function createDynamicFieldValue(fieldPath: string, fallback?: unknown): DynamicValue {
  return { type: 'field', source: fieldPath, fallback };
}

export function createDynamicFunctionValue(functionName: string, params?: Record<string, unknown>, fallback?: unknown): DynamicValue {
  return { type: 'function', source: functionName, params, fallback };
}
