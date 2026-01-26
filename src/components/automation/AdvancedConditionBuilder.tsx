import { useState } from 'react';
import { Plus, Trash2, GitBranch, ChevronDown, ChevronRight } from 'lucide-react';
import type { ConditionGroup, Condition } from '../../types/workflowActions';

interface AdvancedConditionBuilderProps {
  conditions: ConditionGroup;
  onChange: (conditions: ConditionGroup) => void;
  availableFields?: FieldDefinition[];
}

interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'tags';
  category: 'contact' | 'opportunity' | 'appointment' | 'invoice' | 'custom_field';
  options?: Array<{ value: string; label: string }>;
}

const DEFAULT_FIELDS: FieldDefinition[] = [
  { key: 'contact.first_name', label: 'First Name', type: 'text', category: 'contact' },
  { key: 'contact.last_name', label: 'Last Name', type: 'text', category: 'contact' },
  { key: 'contact.email', label: 'Email', type: 'text', category: 'contact' },
  { key: 'contact.phone', label: 'Phone', type: 'text', category: 'contact' },
  { key: 'contact.company', label: 'Company', type: 'text', category: 'contact' },
  { key: 'contact.source', label: 'Source', type: 'text', category: 'contact' },
  { key: 'contact.lead_score', label: 'Lead Score', type: 'number', category: 'contact' },
  { key: 'contact.created_at', label: 'Contact Created Date', type: 'date', category: 'contact' },
  { key: 'tags', label: 'Tags', type: 'tags', category: 'contact' },
  { key: 'opportunity.status', label: 'Opportunity Status', type: 'select', category: 'opportunity', options: [
    { value: 'open', label: 'Open' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' },
  ]},
  { key: 'opportunity.value_amount', label: 'Opportunity Value', type: 'number', category: 'opportunity' },
  { key: 'opportunity.stage_id', label: 'Opportunity Stage', type: 'text', category: 'opportunity' },
  { key: 'appointment.status', label: 'Appointment Status', type: 'select', category: 'appointment', options: [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'no_show', label: 'No Show' },
  ]},
  { key: 'appointment.start_at_utc', label: 'Appointment Date', type: 'date', category: 'appointment' },
  { key: 'invoice.status', label: 'Invoice Status', type: 'select', category: 'invoice', options: [
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'void', label: 'Void' },
  ]},
  { key: 'invoice.total', label: 'Invoice Total', type: 'number', category: 'invoice' },
];

const OPERATORS_BY_TYPE: Record<string, Array<{ value: string; label: string }>> = {
  text: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
    { value: 'regex_matches', label: 'Matches regex' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'greater_than_or_equal', label: 'Greater than or equal' },
    { value: 'less_than_or_equal', label: 'Less than or equal' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  date: [
    { value: 'date_before', label: 'Before' },
    { value: 'date_after', label: 'After' },
    { value: 'date_between', label: 'Between' },
    { value: 'date_within_last', label: 'Within last (days)' },
    { value: 'date_within_next', label: 'Within next (days)' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  boolean: [
    { value: 'equals', label: 'Is' },
  ],
  select: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  tags: [
    { value: 'has_tag', label: 'Has tag' },
    { value: 'not_has_tag', label: 'Does not have tag' },
    { value: 'is_empty', label: 'Has no tags' },
    { value: 'is_not_empty', label: 'Has any tags' },
  ],
};

function generateId(): string {
  return `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function AdvancedConditionBuilder({
  conditions,
  onChange,
  availableFields = DEFAULT_FIELDS,
}: AdvancedConditionBuilderProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([conditions.id]));

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const addCondition = (groupId: string) => {
    const newCondition: Condition = {
      id: generateId(),
      field: availableFields[0]?.key || '',
      operator: 'equals',
      value: '',
    };

    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: [...group.conditions, newCondition],
        };
      }

      return {
        ...group,
        conditions: group.conditions.map(item => {
          if ('logicalOperator' in item) {
            return updateGroup(item);
          }
          return item;
        }),
      };
    };

    onChange(updateGroup(conditions));
  };

  const addNestedGroup = (groupId: string) => {
    const newGroup: ConditionGroup = {
      id: generateId(),
      logicalOperator: 'and',
      conditions: [],
    };

    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: [...group.conditions, newGroup],
        };
      }

      return {
        ...group,
        conditions: group.conditions.map(item => {
          if ('logicalOperator' in item) {
            return updateGroup(item);
          }
          return item;
        }),
      };
    };

    onChange(updateGroup(conditions));
    setExpandedGroups(prev => new Set([...prev, newGroup.id]));
  };

  const updateCondition = (conditionId: string, updates: Partial<Condition>) => {
    const updateInGroup = (group: ConditionGroup): ConditionGroup => ({
      ...group,
      conditions: group.conditions.map(item => {
        if ('logicalOperator' in item) {
          return updateInGroup(item);
        }
        if (item.id === conditionId) {
          return { ...item, ...updates };
        }
        return item;
      }),
    });

    onChange(updateInGroup(conditions));
  };

  const removeCondition = (conditionId: string) => {
    const removeFromGroup = (group: ConditionGroup): ConditionGroup => ({
      ...group,
      conditions: group.conditions
        .filter(item => {
          if ('logicalOperator' in item) return true;
          return item.id !== conditionId;
        })
        .map(item => {
          if ('logicalOperator' in item) {
            return removeFromGroup(item);
          }
          return item;
        }),
    });

    onChange(removeFromGroup(conditions));
  };

  const removeGroup = (groupId: string) => {
    const removeFromGroup = (group: ConditionGroup): ConditionGroup => ({
      ...group,
      conditions: group.conditions
        .filter(item => {
          if ('logicalOperator' in item) return item.id !== groupId;
          return true;
        })
        .map(item => {
          if ('logicalOperator' in item) {
            return removeFromGroup(item);
          }
          return item;
        }),
    });

    onChange(removeFromGroup(conditions));
  };

  const updateGroupOperator = (groupId: string, operator: 'and' | 'or') => {
    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      if (group.id === groupId) {
        return { ...group, logicalOperator: operator };
      }
      return {
        ...group,
        conditions: group.conditions.map(item => {
          if ('logicalOperator' in item) {
            return updateGroup(item);
          }
          return item;
        }),
      };
    };

    onChange(updateGroup(conditions));
  };

  const renderCondition = (condition: Condition, depth: number) => {
    const field = availableFields.find(f => f.key === condition.field);
    const fieldType = field?.type || 'text';
    const operators = OPERATORS_BY_TYPE[fieldType] || OPERATORS_BY_TYPE.text;
    const needsValue = !['is_empty', 'is_not_empty'].includes(condition.operator);
    const needsSecondValue = condition.operator === 'date_between';

    return (
      <div
        key={condition.id}
        className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
      >
        <select
          value={condition.field}
          onChange={e => updateCondition(condition.id, { field: e.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {availableFields.map(f => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          value={condition.operator}
          onChange={e => updateCondition(condition.id, { operator: e.target.value as Condition['operator'] })}
          className="w-40 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {operators.map(op => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>

        {needsValue && (
          <>
            {fieldType === 'select' && field?.options ? (
              <select
                value={(condition.value as string) || ''}
                onChange={e => updateCondition(condition.id, { value: e.target.value })}
                className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select...</option>
                {field.options.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : fieldType === 'boolean' ? (
              <select
                value={String(condition.value)}
                onChange={e => updateCondition(condition.id, { value: e.target.value === 'true' })}
                className="w-24 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : fieldType === 'date' ? (
              <input
                type="date"
                value={(condition.value as string) || ''}
                onChange={e => updateCondition(condition.id, { value: e.target.value })}
                className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            ) : fieldType === 'number' || ['date_within_last', 'date_within_next'].includes(condition.operator) ? (
              <input
                type="number"
                value={(condition.value as number) || ''}
                onChange={e => updateCondition(condition.id, { value: parseFloat(e.target.value) || 0 })}
                className="w-24 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            ) : (
              <input
                type="text"
                value={(condition.value as string) || ''}
                onChange={e => updateCondition(condition.id, { value: e.target.value })}
                placeholder="Value..."
                className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            )}

            {needsSecondValue && (
              <>
                <span className="text-sm text-gray-500">and</span>
                <input
                  type="date"
                  value={(condition.secondaryValue as string) || ''}
                  onChange={e => updateCondition(condition.id, { secondaryValue: e.target.value })}
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </>
            )}
          </>
        )}

        <button
          onClick={() => removeCondition(condition.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
          title="Remove condition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderGroup = (group: ConditionGroup, depth: number = 0) => {
    const isExpanded = expandedGroups.has(group.id);
    const isRoot = depth === 0;

    return (
      <div
        key={group.id}
        className={`border rounded-lg ${
          isRoot
            ? 'border-gray-200 dark:border-gray-700'
            : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10'
        }`}
      >
        <div
          className={`flex items-center justify-between p-3 ${
            isRoot ? 'bg-gray-50 dark:bg-gray-800' : ''
          } rounded-t-lg`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleGroup(group.id)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            <GitBranch className="w-4 h-4 text-gray-400" />

            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isRoot ? 'Conditions' : 'Group'}
            </span>

            <div className="flex items-center gap-1 ml-2 bg-white dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => updateGroupOperator(group.id, 'and')}
                className={`px-2 py-0.5 text-xs font-medium rounded ${
                  group.logicalOperator === 'and'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                AND
              </button>
              <button
                onClick={() => updateGroupOperator(group.id, 'or')}
                className={`px-2 py-0.5 text-xs font-medium rounded ${
                  group.logicalOperator === 'or'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                OR
              </button>
            </div>

            <span className="text-xs text-gray-500 ml-2">
              ({group.conditions.length} {group.conditions.length === 1 ? 'item' : 'items'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isRoot && (
              <button
                onClick={() => removeGroup(group.id)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove group"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="p-3 space-y-2">
            {group.conditions.map((item, index) => (
              <div key={'logicalOperator' in item ? item.id : item.id}>
                {index > 0 && (
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs font-medium text-gray-400 uppercase">
                      {group.logicalOperator}
                    </span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>
                )}

                {'logicalOperator' in item
                  ? renderGroup(item, depth + 1)
                  : renderCondition(item, depth)}
              </div>
            ))}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => addCondition(group.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Condition
              </button>

              {depth < 2 && (
                <button
                  onClick={() => addNestedGroup(group.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <GitBranch className="w-4 h-4" />
                  Add Group
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderGroup(conditions)}

      {conditions.conditions.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Preview:</strong> {renderConditionPreview(conditions)}
          </p>
        </div>
      )}
    </div>
  );
}

function renderConditionPreview(group: ConditionGroup): string {
  if (group.conditions.length === 0) return 'No conditions set';

  const parts = group.conditions.map(item => {
    if ('logicalOperator' in item) {
      return `(${renderConditionPreview(item)})`;
    }
    return `${item.field} ${item.operator} "${item.value || ''}"`;
  });

  return parts.join(` ${group.logicalOperator.toUpperCase()} `);
}

export function createEmptyConditionGroup(): ConditionGroup {
  return {
    id: generateId(),
    logicalOperator: 'and',
    conditions: [],
  };
}
