import { Plus, Trash2, ExternalLink, MessageSquare, Ban } from 'lucide-react';
import type { FormSubmitRule, FormConditionalRule } from '../types';

interface FieldOption {
  id: string;
  label: string;
}

interface SubmitRulesEditorProps {
  rules: FormSubmitRule[];
  onChange: (rules: FormSubmitRule[]) => void;
  availableFields: FieldOption[];
}

function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const ACTION_META: Record<FormSubmitRule['action'], { icon: typeof Plus; label: string; placeholder: string }> = {
  redirect: { icon: ExternalLink, label: 'Redirect to URL', placeholder: 'https://example.com/thanks' },
  message: { icon: MessageSquare, label: 'Show custom message', placeholder: 'Thanks! We\'ll be in touch within one business day.' },
  disqualify: { icon: Ban, label: 'Disqualify (block submission)', placeholder: 'Sorry, you don\'t qualify based on your answers.' },
};

export function SubmitRulesEditor({ rules, onChange, availableFields }: SubmitRulesEditorProps) {
  const addRule = () => {
    const newRule: FormSubmitRule = {
      id: generateRuleId(),
      conditions: availableFields[0]
        ? [{ fieldId: availableFields[0].id, operator: 'equals', value: '' }]
        : [],
      action: 'redirect',
      payload: '',
    };
    onChange([...rules, newRule]);
  };

  const updateRule = (id: string, updates: Partial<FormSubmitRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const removeRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  const updateCondition = (
    ruleId: string,
    condIdx: number,
    updates: Partial<FormConditionalRule>
  ) => {
    onChange(
      rules.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              conditions: r.conditions.map((c, i) => (i === condIdx ? { ...c, ...updates } : c)),
            }
          : r
      )
    );
  };

  const addCondition = (ruleId: string) => {
    const fallbackFieldId = availableFields[0]?.id ?? '';
    onChange(
      rules.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              conditions: [...r.conditions, { fieldId: fallbackFieldId, operator: 'equals', value: '' }],
            }
          : r
      )
    );
  };

  const removeCondition = (ruleId: string, condIdx: number) => {
    onChange(
      rules.map((r) =>
        r.id === ruleId
          ? { ...r, conditions: r.conditions.filter((_, i) => i !== condIdx) }
          : r
      )
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Submit rules run when the user submits. The first rule whose conditions all match wins.
        Disqualify rules block submission; redirect/message override the default thank-you behavior.
      </p>

      {rules.length === 0 && (
        <div className="text-center py-6 text-sm text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          No submit rules yet
        </div>
      )}

      {rules.map((rule, ruleIdx) => {
        const meta = ACTION_META[rule.action];
        const Icon = meta.icon;
        return (
          <div key={rule.id} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Rule {ruleIdx + 1}
              </span>
              <button
                onClick={() => removeRule(rule.id)}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
                title="Delete rule"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">When all of these are true:</p>
              {rule.conditions.length === 0 && (
                <p className="text-xs text-gray-500 italic">No conditions — rule will always match.</p>
              )}
              {rule.conditions.map((cond, condIdx) => (
                <div key={condIdx} className="flex items-center gap-1.5">
                  <select
                    value={cond.fieldId}
                    onChange={(e) => updateCondition(rule.id, condIdx, { fieldId: e.target.value })}
                    className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {availableFields.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(rule.id, condIdx, { operator: e.target.value as FormConditionalRule['operator'] })}
                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="equals">equals</option>
                    <option value="not_equals">≠</option>
                    <option value="contains">contains</option>
                    <option value="greater_than">&gt;</option>
                    <option value="less_than">&lt;</option>
                    <option value="between">between</option>
                    <option value="before">before</option>
                    <option value="after">after</option>
                    <option value="is_empty">is empty</option>
                    <option value="is_not_empty">is not empty</option>
                  </select>
                  {cond.operator !== 'is_empty' && cond.operator !== 'is_not_empty' && (
                    <input
                      type="text"
                      value={cond.value}
                      onChange={(e) => updateCondition(rule.id, condIdx, { value: e.target.value })}
                      placeholder="value"
                      className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                  {cond.operator === 'between' && (
                    <input
                      type="text"
                      value={cond.valueEnd || ''}
                      onChange={(e) => updateCondition(rule.id, condIdx, { valueEnd: e.target.value })}
                      placeholder="end"
                      className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                  {rule.conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(rule.id, condIdx)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="Remove condition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => addCondition(rule.id)}
                disabled={availableFields.length === 0}
                className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                Add condition
              </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-700">Then do this:</p>
              <select
                value={rule.action}
                onChange={(e) => updateRule(rule.id, { action: e.target.value as FormSubmitRule['action'] })}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {(Object.keys(ACTION_META) as FormSubmitRule['action'][]).map((a) => (
                  <option key={a} value={a}>{ACTION_META[a].label}</option>
                ))}
              </select>
              <div className="flex items-start gap-2">
                <Icon className="w-3.5 h-3.5 text-gray-400 mt-1.5 shrink-0" />
                {rule.action === 'redirect' ? (
                  <input
                    type="url"
                    value={rule.payload}
                    onChange={(e) => updateRule(rule.id, { payload: e.target.value })}
                    placeholder={meta.placeholder}
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                ) : (
                  <textarea
                    value={rule.payload}
                    onChange={(e) => updateRule(rule.id, { payload: e.target.value })}
                    rows={2}
                    placeholder={meta.placeholder}
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}

      <button
        onClick={addRule}
        disabled={availableFields.length === 0}
        className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300 disabled:opacity-50"
      >
        <Plus className="w-3.5 h-3.5" />
        Add submit rule
      </button>

      {availableFields.length === 0 && (
        <p className="text-xs text-gray-500 italic">
          Add at least one field/question first to create rules.
        </p>
      )}
    </div>
  );
}

export function evaluateRule(
  rule: FormSubmitRule,
  values: Record<string, unknown>
): boolean {
  if (rule.conditions.length === 0) return true;
  return rule.conditions.every((cond) => {
    const fieldValue = values[cond.fieldId];
    const stringValue = String(fieldValue ?? '');
    const numericValue = typeof fieldValue === 'number' ? fieldValue : parseFloat(stringValue);
    const ruleNum = parseFloat(cond.value);
    const ruleEndNum = cond.valueEnd ? parseFloat(cond.valueEnd) : NaN;
    switch (cond.operator) {
      case 'equals':
        return stringValue === cond.value;
      case 'not_equals':
        return stringValue !== cond.value;
      case 'contains':
        return stringValue.toLowerCase().includes(cond.value.toLowerCase());
      case 'greater_than':
        return !isNaN(numericValue) && !isNaN(ruleNum) && numericValue > ruleNum;
      case 'less_than':
        return !isNaN(numericValue) && !isNaN(ruleNum) && numericValue < ruleNum;
      case 'between':
        if (!isNaN(numericValue) && !isNaN(ruleNum) && !isNaN(ruleEndNum)) {
          return numericValue >= ruleNum && numericValue <= ruleEndNum;
        }
        return Boolean(cond.valueEnd) && stringValue >= cond.value && stringValue <= (cond.valueEnd as string);
      case 'before':
        return Boolean(stringValue) && stringValue < cond.value;
      case 'after':
        return Boolean(stringValue) && stringValue > cond.value;
      case 'is_empty':
        return (
          fieldValue === undefined ||
          fieldValue === null ||
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      case 'is_not_empty':
        return !(
          fieldValue === undefined ||
          fieldValue === null ||
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      default:
        return false;
    }
  });
}
