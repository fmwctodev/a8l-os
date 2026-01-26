export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'tags'
  | 'email'
  | 'phone'
  | 'url'
  | 'currency'
  | 'percentage'
  | 'duration'
  | 'user_reference'
  | 'contact_reference'
  | 'opportunity_reference';

export type OperatorType =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'not_between'
  | 'in_list'
  | 'not_in_list'
  | 'regex_matches'
  | 'date_before'
  | 'date_after'
  | 'date_on'
  | 'date_between'
  | 'date_within_last'
  | 'date_within_next'
  | 'date_is_today'
  | 'date_is_this_week'
  | 'date_is_this_month'
  | 'date_is_this_year'
  | 'has_tag'
  | 'not_has_tag'
  | 'has_any_tag'
  | 'has_all_tags'
  | 'changed'
  | 'changed_from'
  | 'changed_to'
  | 'increased'
  | 'decreased'
  | 'increased_by'
  | 'decreased_by';

export type EntityType =
  | 'contact'
  | 'opportunity'
  | 'appointment'
  | 'invoice'
  | 'conversation'
  | 'message'
  | 'workflow'
  | 'form_submission'
  | 'survey_response'
  | 'payment'
  | 'review'
  | 'social_post'
  | 'email'
  | 'call'
  | 'task'
  | 'note'
  | 'custom_field';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  category: EntityType;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  dynamicOptionsSource?: string;
  validOperators?: OperatorType[];
  defaultOperator?: OperatorType;
  metadata?: Record<string, unknown>;
  deprecated?: boolean;
  replacedBy?: string;
}

export interface OperatorDefinition {
  key: OperatorType;
  label: string;
  description: string;
  applicableTypes: FieldType[];
  requiresValue: boolean;
  requiresSecondValue: boolean;
  valueType?: 'single' | 'array' | 'range';
  valueLabel?: string;
  secondValueLabel?: string;
}

export interface Condition {
  id: string;
  field: string;
  operator: OperatorType;
  value: unknown;
  secondaryValue?: unknown;
  caseSensitive?: boolean;
}

export interface ConditionGroup {
  id: string;
  logicalOperator: 'and' | 'or';
  conditions: Array<Condition | ConditionGroup>;
  label?: string;
}

export interface ConditionTemplate {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  category: string;
  conditions: ConditionGroup;
  entity_types: EntityType[];
  is_system: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ConditionEvaluationContext {
  entityType: EntityType;
  entityId: string;
  entityData: Record<string, unknown>;
  previousEntityData?: Record<string, unknown>;
  relatedEntities?: Record<string, Record<string, unknown>>;
  customFields?: Record<string, unknown>;
  tags?: string[];
  currentUser?: { id: string; org_id: string; role: string };
  timestamp: string;
}

export interface ConditionEvaluationResult {
  success: boolean;
  result: boolean;
  evaluatedConditions: EvaluatedCondition[];
  duration_ms: number;
  errors?: string[];
}

export interface EvaluatedCondition {
  conditionId: string;
  field: string;
  operator: OperatorType;
  expectedValue: unknown;
  actualValue: unknown;
  result: boolean;
  error?: string;
}

export interface ConditionValidationResult {
  valid: boolean;
  errors: ConditionValidationError[];
  warnings: ConditionValidationWarning[];
}

export interface ConditionValidationError {
  conditionId: string;
  field: string;
  message: string;
  code: string;
}

export interface ConditionValidationWarning {
  conditionId: string;
  field: string;
  message: string;
  code: string;
}

export interface DynamicValue {
  type: 'field' | 'function' | 'constant' | 'variable';
  source: string;
  path?: string;
  params?: Record<string, unknown>;
  fallback?: unknown;
}

export function isConditionGroup(item: Condition | ConditionGroup): item is ConditionGroup {
  return 'logicalOperator' in item;
}

export function generateConditionId(): string {
  return `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createEmptyCondition(fieldKey?: string): Condition {
  return { id: generateConditionId(), field: fieldKey || '', operator: 'equals', value: '' };
}

export function createEmptyConditionGroup(): ConditionGroup {
  return { id: generateConditionId(), logicalOperator: 'and', conditions: [] };
}
