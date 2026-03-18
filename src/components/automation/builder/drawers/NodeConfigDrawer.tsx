import { useCallback, createElement } from 'react';
import { X, Trash2, Zap, GitBranch, Clock, Target, Square, AlertCircle } from 'lucide-react';
import type { BuilderNode, BuilderNodeData } from '../../../../types/workflowBuilder';
import type {
  TriggerNodeData,
  ActionNodeData,
  ConditionNodeData,
  DelayNodeData,
  GoalNodeData,
  ConditionRule,
} from '../../../../types';
import { TRIGGER_OPTIONS, ACTION_OPTIONS } from '../../../../types/workflowBuilder';
import { TRIGGER_CONFIG_MAP } from '../triggerConfigs';
import { ACTION_CONFIG_MAP } from '../actionConfigs';

interface NodeConfigDrawerProps {
  node: BuilderNode;
  onUpdate: (nodeId: string, updater: (data: BuilderNodeData) => BuilderNodeData) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

const NODE_TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  trigger: { icon: Zap, color: 'bg-emerald-500', label: 'Trigger' },
  action: { icon: Zap, color: 'bg-cyan-500', label: 'Action' },
  condition: { icon: GitBranch, color: 'bg-amber-500', label: 'If / Else' },
  delay: { icon: Clock, color: 'bg-blue-500', label: 'Wait / Delay' },
  goal: { icon: Target, color: 'bg-rose-500', label: 'Goal Event' },
  end: { icon: Square, color: 'bg-slate-500', label: 'End' },
};

export function NodeConfigDrawer({ node, onUpdate, onDelete, onClose }: NodeConfigDrawerProps) {
  const meta = NODE_TYPE_META[node.data.nodeType] ?? NODE_TYPE_META.action;
  const IconComp = meta.icon;

  const updateNodeData = useCallback((updates: Partial<BuilderNodeData['nodeData']>) => {
    onUpdate(node.id, (prev) => ({
      ...prev,
      nodeData: { ...prev.nodeData, ...updates } as any,
      isValid: true,
      validationErrors: [],
    }));
  }, [node.id, onUpdate]);

  const updateLabel = useCallback((label: string) => {
    onUpdate(node.id, (prev) => ({ ...prev, label }));
  }, [node.id, onUpdate]);

  return (
    <div className="w-[440px] h-full bg-white border-l border-gray-200 flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-md ${meta.color} flex items-center justify-center`}>
            <IconComp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">{meta.label}</h3>
            <p className="text-xs text-gray-500">Configure this step</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
          <X className="w-4.5 h-4.5 text-gray-400" />
        </button>
      </div>

      {node.data.validationErrors.length > 0 && (
        <div className="mx-5 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Configuration incomplete</span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {node.data.validationErrors.map((err, i) => (
              <li key={i} className="text-xs text-red-600 pl-5">{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Step Name</label>
          <input
            type="text"
            value={node.data.label}
            onChange={e => updateLabel(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        {node.data.nodeType === 'trigger' && (
          <TriggerConfig
            data={node.data.nodeData as TriggerNodeData}
            onUpdate={updateNodeData}
          />
        )}

        {node.data.nodeType === 'action' && (
          <ActionConfig
            data={node.data.nodeData as ActionNodeData}
            onUpdate={updateNodeData}
            onUpdateLabel={updateLabel}
          />
        )}

        {node.data.nodeType === 'condition' && (
          <ConditionConfig
            data={node.data.nodeData as ConditionNodeData}
            onUpdate={updateNodeData}
          />
        )}

        {node.data.nodeType === 'delay' && (
          <DelayConfig
            data={node.data.nodeData as DelayNodeData}
            onUpdate={updateNodeData}
          />
        )}

        {node.data.nodeType === 'goal' && (
          <GoalConfig
            data={node.data.nodeData as GoalNodeData}
            onUpdate={updateNodeData}
          />
        )}

        {node.data.nodeType === 'end' && (
          <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
            This marks the end of a workflow path. Contacts reaching this node complete the workflow.
          </div>
        )}
      </div>

      {node.data.nodeType !== 'end' && (
        <div className="px-5 py-3 border-t border-gray-100">
          <button
            onClick={() => onDelete(node.id)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors w-full"
          >
            <Trash2 className="w-4 h-4" />
            Delete Step
          </button>
        </div>
      )}
    </div>
  );
}

function TriggerConfig({ data, onUpdate }: { data: TriggerNodeData; onUpdate: (u: any) => void }) {
  const current = TRIGGER_OPTIONS.find(t => t.type === data.triggerType);
  const configEntry = TRIGGER_CONFIG_MAP[data.triggerType];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Trigger Type</label>
        <select
          value={data.triggerType}
          onChange={e => onUpdate({ triggerType: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          {TRIGGER_OPTIONS.map(opt => (
            <option key={opt.type} value={opt.type}>{opt.label}</option>
          ))}
        </select>
        {current && (
          <p className="text-xs text-gray-500 mt-1">{current.description}</p>
        )}
      </div>

      {configEntry
        ? createElement(configEntry.component, {
            data,
            onUpdate,
            ...(configEntry.props ?? {}),
          } as any)
        : data.triggerType === 'scheduled' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Schedule</label>
              <select
                value={(data.scheduledConfig as any)?.cadence ?? 'daily'}
                onChange={e => onUpdate({ scheduledConfig: { ...(data.scheduledConfig || {}), cadence: e.target.value } })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom_cron">Custom (Cron)</option>
              </select>
            </div>
          </div>
        )
      }

      <div className="p-3 bg-emerald-50 rounded-lg">
        <p className="text-xs text-emerald-700">
          This trigger independently starts the workflow when the selected event fires. You can add multiple triggers to the same workflow.
        </p>
      </div>
    </div>
  );
}

function ActionConfig({ data, onUpdate, onUpdateLabel }: {
  data: ActionNodeData;
  onUpdate: (u: any) => void;
  onUpdateLabel: (l: string) => void;
}) {
  const config = data.config as Record<string, any> || {};
  const actionType = data.actionType as string;
  const configEntry = ACTION_CONFIG_MAP[actionType];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Action Type</label>
        <select
          value={data.actionType}
          onChange={e => {
            const opt = ACTION_OPTIONS.find(a => a.type === e.target.value);
            onUpdate({ actionType: e.target.value, config: {} });
            if (opt) onUpdateLabel(opt.label);
          }}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          {ACTION_OPTIONS.filter(a => !a.createsNodeType || a.createsNodeType === 'action').map(opt => (
            <option key={opt.type} value={opt.type}>{opt.label}</option>
          ))}
        </select>
      </div>

      {configEntry
        ? createElement(configEntry.component, {
            data,
            onUpdate,
            ...(configEntry.props ?? {}),
          } as any)
        : (
          <>
            {actionType === 'send_email' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={config.subject ?? ''}
                    onChange={e => onUpdate({ config: { ...config, subject: e.target.value } })}
                    placeholder="Email subject..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Body</label>
                  <textarea
                    value={config.body ?? ''}
                    onChange={e => onUpdate({ config: { ...config, body: e.target.value } })}
                    placeholder="Email body... Use {{contact.first_name}} for merge fields"
                    rows={5}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                </div>
              </div>
            )}

            {actionType === 'send_sms' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={config.body ?? ''}
                  onChange={e => onUpdate({ config: { ...config, body: e.target.value } })}
                  placeholder="SMS message... Use {{contact.first_name}} for merge fields"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>
            )}

            {(actionType === 'add_tag' || actionType === 'remove_tag') && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tag Name</label>
                <input
                  type="text"
                  value={config.tagName ?? ''}
                  onChange={e => onUpdate({ config: { ...config, tagName: e.target.value, tagId: e.target.value } })}
                  placeholder="Enter tag name..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

            {actionType === 'webhook' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
                  <input
                    type="url"
                    value={config.url ?? ''}
                    onChange={e => onUpdate({ config: { ...config, url: e.target.value } })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payload (JSON)</label>
                  <textarea
                    value={config.payload ? JSON.stringify(config.payload, null, 2) : ''}
                    onChange={e => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        onUpdate({ config: { ...config, payload: parsed } });
                      } catch {}
                    }}
                    placeholder='{"key": "value"}'
                    rows={4}
                    className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                </div>
              </div>
            )}

            {actionType === 'notify_user' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notification Message</label>
                <textarea
                  value={config.message ?? ''}
                  onChange={e => onUpdate({ config: { ...config, message: e.target.value } })}
                  placeholder="Notification message..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>
            )}

            {actionType === 'trigger_another_workflow' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Target Workflow ID</label>
                <input
                  type="text"
                  value={config.workflowId ?? ''}
                  onChange={e => onUpdate({ config: { ...config, workflowId: e.target.value } })}
                  placeholder="Enter workflow ID..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}
          </>
        )
      }
    </div>
  );
}

function ConditionConfig({ data, onUpdate }: { data: ConditionNodeData; onUpdate: (u: any) => void }) {
  const conditions = data.conditions ?? { logic: 'and', rules: [] };

  const addRule = () => {
    const newRule: ConditionRule = {
      id: `rule_${Date.now()}`,
      field: 'email',
      operator: 'contains',
      value: '',
    };
    onUpdate({
      conditions: {
        ...conditions,
        rules: [...conditions.rules, newRule],
      },
    });
  };

  const updateRule = (index: number, updates: Partial<ConditionRule>) => {
    const updated = [...conditions.rules];
    updated[index] = { ...updated[index], ...updates } as ConditionRule;
    onUpdate({ conditions: { ...conditions, rules: updated } });
  };

  const removeRule = (index: number) => {
    onUpdate({
      conditions: {
        ...conditions,
        rules: conditions.rules.filter((_, i) => i !== index),
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Logic</label>
        <div className="flex gap-2">
          {(['and', 'or'] as const).map(logic => (
            <button
              key={logic}
              onClick={() => onUpdate({ conditions: { ...conditions, logic } })}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                conditions.logic === logic
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {logic.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {(conditions.rules as ConditionRule[]).map((rule, i) => (
          <div key={rule.id || i} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
            <select
              value={rule.field}
              onChange={e => updateRule(i, { field: e.target.value })}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none"
            >
              <option value="email">Email</option>
              <option value="first_name">First Name</option>
              <option value="last_name">Last Name</option>
              <option value="phone">Phone</option>
              <option value="company">Company</option>
              <option value="source">Source</option>
              <option value="city">City</option>
              <option value="state">State</option>
              <option value="status">Status</option>
            </select>
            <select
              value={rule.operator}
              onChange={e => updateRule(i, { operator: e.target.value as any })}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none"
            >
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
              <option value="contains">contains</option>
              <option value="not_contains">not contains</option>
              <option value="is_empty">is empty</option>
              <option value="is_not_empty">is not empty</option>
            </select>
            {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
              <input
                type="text"
                value={String(rule.value ?? '')}
                onChange={e => updateRule(i, { value: e.target.value })}
                placeholder="Value"
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none"
              />
            )}
            <button
              onClick={() => removeRule(i)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRule}
        className="w-full py-2 text-sm text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
      >
        + Add Condition Rule
      </button>

      <div className="p-3 bg-amber-50 rounded-lg">
        <p className="text-xs text-amber-700">
          Contacts matching these conditions follow the "Yes" path. All others follow the "No" path.
        </p>
      </div>
    </div>
  );
}

function DelayConfig({ data, onUpdate }: { data: DelayNodeData; onUpdate: (u: any) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Delay Type</label>
        <select
          value={data.delayType}
          onChange={e => onUpdate({ delayType: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="wait_duration">Wait for duration</option>
          <option value="wait_until_datetime">Wait until date/time</option>
          <option value="wait_until_weekday_time">Wait until weekday + time</option>
        </select>
      </div>

      {data.delayType === 'wait_duration' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="number"
              min={1}
              value={data.duration?.value ?? 1}
              onChange={e => onUpdate({ duration: { value: parseInt(e.target.value) || 1, unit: data.duration?.unit ?? 'hours' } })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
            <select
              value={data.duration?.unit ?? 'hours'}
              onChange={e => onUpdate({ duration: { value: data.duration?.value ?? 1, unit: e.target.value } })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </div>
      )}

      {data.delayType === 'wait_until_datetime' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Date & Time</label>
          <input
            type="datetime-local"
            value={data.datetime ?? ''}
            onChange={e => onUpdate({ datetime: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      )}

      {data.delayType === 'wait_until_weekday_time' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Day</label>
            <select
              value={data.weekday ?? 1}
              onChange={e => onUpdate({ weekday: parseInt(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
            <input
              type="time"
              value={data.time ?? '09:00'}
              onChange={e => onUpdate({ time: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function GoalConfig({ data, onUpdate }: { data: GoalNodeData; onUpdate: (u: any) => void }) {
  const conditions = data.goalCondition ?? { logic: 'and', rules: [] };

  const addRule = () => {
    const newRule: ConditionRule = {
      id: `rule_${Date.now()}`,
      field: 'status',
      operator: 'equals',
      value: '',
    };
    onUpdate({
      goalCondition: {
        ...conditions,
        rules: [...conditions.rules, newRule],
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-rose-50 rounded-lg">
        <p className="text-xs text-rose-700">
          When a contact meets this goal condition while waiting in earlier steps, they skip ahead to this point in the workflow.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Goal Conditions</label>
        <div className="space-y-2">
          {(conditions.rules as ConditionRule[]).map((rule, i) => (
            <div key={rule.id || i} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
              <select
                value={rule.field}
                onChange={e => {
                  const updated = [...conditions.rules];
                  updated[i] = { ...updated[i], field: e.target.value } as ConditionRule;
                  onUpdate({ goalCondition: { ...conditions, rules: updated } });
                }}
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none"
              >
                <option value="status">Status</option>
                <option value="email">Email</option>
                <option value="company">Company</option>
                <option value="source">Source</option>
              </select>
              <select
                value={rule.operator}
                onChange={e => {
                  const updated = [...conditions.rules];
                  updated[i] = { ...updated[i], operator: e.target.value } as ConditionRule;
                  onUpdate({ goalCondition: { ...conditions, rules: updated } });
                }}
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none"
              >
                <option value="equals">equals</option>
                <option value="contains">contains</option>
              </select>
              <input
                type="text"
                value={String(rule.value ?? '')}
                onChange={e => {
                  const updated = [...conditions.rules];
                  updated[i] = { ...updated[i], value: e.target.value } as ConditionRule;
                  onUpdate({ goalCondition: { ...conditions, rules: updated } });
                }}
                placeholder="Value"
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none"
              />
              <button
                onClick={() => {
                  onUpdate({
                    goalCondition: {
                      ...conditions,
                      rules: conditions.rules.filter((_, idx) => idx !== i),
                    },
                  });
                }}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addRule}
          className="w-full mt-2 py-2 text-sm text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors"
        >
          + Add Goal Condition
        </button>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.continueOnMet ?? true}
            onChange={e => onUpdate({ continueOnMet: e.target.checked })}
            className="rounded border-gray-300"
          />
          <span className="text-gray-700">Continue workflow after goal is met</span>
        </label>
      </div>
    </div>
  );
}
