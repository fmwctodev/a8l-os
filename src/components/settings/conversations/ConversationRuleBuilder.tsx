import { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Plus,
  Trash2,
  GripVertical,
  Inbox,
  RefreshCw,
  Clock,
  Phone,
  UserPlus,
  Users,
  Tag,
  XCircle,
  FileText,
  Bot,
  Bell,
  ClipboardList,
  Check,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  createConversationRule,
  updateConversationRule,
  getTriggerTypeLabel,
  getActionTypeLabel,
} from '../../../services/conversationRules';
import { getUsers } from '../../../services/users';
import { getTags } from '../../../services/tags';
import { getSnippets } from '../../../services/snippets';
import { getAgents } from '../../../services/aiAgents';
import { getDepartments } from '../../../services/departments';
import type {
  ConversationRule,
  RuleTriggerType,
  RuleCondition,
  RuleAction,
  RuleConditionOperator,
  RuleActionType,
  User,
  Tag,
  Snippet,
  AIAgent,
  Department,
} from '../../../types';

interface ConversationRuleBuilderProps {
  rule?: ConversationRule | null;
  onClose: () => void;
  onSave: (rule: ConversationRule) => void;
}

const TRIGGER_OPTIONS: { value: RuleTriggerType; label: string; icon: typeof MessageSquare; description: string }[] = [
  {
    value: 'incoming_message',
    label: 'Incoming Message',
    icon: MessageSquare,
    description: 'When a new message is received from a contact',
  },
  {
    value: 'new_conversation',
    label: 'New Conversation',
    icon: Inbox,
    description: 'When a new conversation is created',
  },
  {
    value: 'conversation_reopened',
    label: 'Conversation Reopened',
    icon: RefreshCw,
    description: 'When a closed conversation receives a new message',
  },
  {
    value: 'no_reply_timeout',
    label: 'No Reply Timeout',
    icon: Clock,
    description: 'When no reply is sent within a specified time',
  },
  {
    value: 'channel_message',
    label: 'Channel Message',
    icon: Phone,
    description: 'When a message arrives on a specific channel',
  },
];

const CONDITION_FIELDS = [
  { value: 'message.channel', label: 'Message Channel' },
  { value: 'message.body', label: 'Message Content' },
  { value: 'conversation.status', label: 'Conversation Status' },
  { value: 'conversation.assigned_user_id', label: 'Assigned User' },
  { value: 'contact.company', label: 'Contact Company' },
];

const OPERATORS: { value: RuleConditionOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];

const ACTION_OPTIONS: { value: RuleActionType; label: string; icon: typeof UserPlus }[] = [
  { value: 'assign_user', label: 'Assign to User', icon: UserPlus },
  { value: 'assign_roundrobin', label: 'Round-Robin Assignment', icon: Users },
  { value: 'add_tag', label: 'Add Tag', icon: Tag },
  { value: 'remove_tag', label: 'Remove Tag', icon: XCircle },
  { value: 'close_conversation', label: 'Close Conversation', icon: Check },
  { value: 'send_snippet', label: 'Send Snippet', icon: FileText },
  { value: 'generate_ai_draft', label: 'Generate AI Draft', icon: Bot },
  { value: 'notify_user', label: 'Notify User', icon: Bell },
  { value: 'create_task', label: 'Create Task', icon: ClipboardList },
];

export function ConversationRuleBuilder({ rule, onClose, onSave }: ConversationRuleBuilderProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(rule?.name || '');
  const [triggerType, setTriggerType] = useState<RuleTriggerType>(rule?.trigger_type || 'incoming_message');
  const [conditions, setConditions] = useState<RuleCondition[]>(rule?.conditions || []);
  const [actions, setActions] = useState<RuleAction[]>(rule?.actions || []);
  const [priority, setPriority] = useState(rule?.priority ?? 100);
  const [cooldownMinutes, setCooldownMinutes] = useState(rule?.cooldown_minutes ?? 0);
  const [maxTriggersPerDay, setMaxTriggersPerDay] = useState(rule?.max_triggers_per_day ?? 0);
  const [continueEvaluation, setContinueEvaluation] = useState(rule?.continue_evaluation ?? false);

  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const [usersData, tagsData, snippetsData, agentsData, deptsData] = await Promise.all([
          getUsers(user.organization_id, {}),
          getTags(user.organization_id),
          getSnippets(user.organization_id),
          getAgents(user.organization_id),
          getDepartments(user.organization_id),
        ]);
        setUsers(usersData.data);
        setTags(tagsData);
        setSnippets(snippetsData);
        setAgents(agentsData);
        setDepartments(deptsData);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    }
    loadData();
  }, [user]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        id: crypto.randomUUID(),
        field: 'message.channel',
        operator: 'equals',
        value: '',
      },
    ]);
  };

  const updateCondition = (id: string, updates: Partial<RuleCondition>) => {
    setConditions(conditions.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const addAction = (actionType: RuleActionType) => {
    setActions([
      ...actions,
      {
        id: crypto.randomUUID(),
        action_type: actionType,
        config: {},
      },
    ]);
  };

  const updateAction = (id: string, config: Record<string, unknown>) => {
    setActions(actions.map((a) => (a.id === id ? { ...a, config } : a)));
  };

  const removeAction = (id: string) => {
    setActions(actions.filter((a) => a.id !== id));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!triggerType;
      case 2:
        return true;
      case 3:
        return actions.length > 0;
      case 4:
        return !!name.trim();
      default:
        return false;
    }
  };

  const handleSave = async () => {
    if (!user || !name.trim() || actions.length === 0) return;

    setSaving(true);
    try {
      let savedRule: ConversationRule;

      if (rule) {
        savedRule = await updateConversationRule(rule.id, {
          name: name.trim(),
          trigger_type: triggerType,
          conditions,
          actions,
          priority,
          cooldown_minutes: cooldownMinutes,
          max_triggers_per_day: maxTriggersPerDay,
          continue_evaluation: continueEvaluation,
        });
      } else {
        savedRule = await createConversationRule({
          organization_id: user.organization_id,
          name: name.trim(),
          trigger_type: triggerType,
          conditions,
          actions,
          priority,
          cooldown_minutes: cooldownMinutes,
          max_triggers_per_day: maxTriggersPerDay,
          continue_evaluation: continueEvaluation,
        });
      }

      onSave(savedRule);
    } catch (error) {
      console.error('Failed to save rule:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-800 rounded-xl shadow-xl flex flex-col mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {rule ? 'Edit Rule' : 'Create Rule'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 p-4 border-b border-slate-700">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  s === step
                    ? 'bg-cyan-500 text-white'
                    : s < step
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {s < step ? <Check size={16} /> : s}
              </div>
              {s < 4 && <div className={`w-12 h-0.5 ${s < step ? 'bg-green-500' : 'bg-slate-700'}`} />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Select Trigger</h3>
              <p className="text-sm text-slate-400 mb-6">
                Choose when this rule should be evaluated
              </p>

              <div className="space-y-3">
                {TRIGGER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTriggerType(option.value)}
                    className={`w-full flex items-start gap-4 p-4 rounded-lg border transition-colors text-left ${
                      triggerType === option.value
                        ? 'bg-cyan-500/10 border-cyan-500'
                        : 'bg-slate-900 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        triggerType === option.value ? 'bg-cyan-500/20' : 'bg-slate-800'
                      }`}
                    >
                      <option.icon
                        size={20}
                        className={triggerType === option.value ? 'text-cyan-400' : 'text-slate-400'}
                      />
                    </div>
                    <div>
                      <div
                        className={`font-medium ${
                          triggerType === option.value ? 'text-cyan-400' : 'text-white'
                        }`}
                      >
                        {option.label}
                      </div>
                      <div className="text-sm text-slate-400 mt-0.5">{option.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Add Conditions (Optional)</h3>
              <p className="text-sm text-slate-400 mb-6">
                Filter when this rule should run based on message or contact properties
              </p>

              {conditions.length === 0 ? (
                <div className="text-center py-8 bg-slate-900 rounded-lg border border-slate-700">
                  <p className="text-slate-400 mb-4">No conditions added. Rule will trigger for all matching events.</p>
                  <button
                    onClick={addCondition}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    <Plus size={16} />
                    Add Condition
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {conditions.map((condition, index) => (
                    <div
                      key={condition.id}
                      className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700"
                    >
                      {index > 0 && (
                        <span className="text-xs text-slate-500 uppercase font-medium">AND</span>
                      )}
                      <select
                        value={condition.field}
                        onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {CONDITION_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(e) =>
                          updateCondition(condition.id, { operator: e.target.value as RuleConditionOperator })
                        }
                        className="w-40 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      {!['is_empty', 'is_not_empty'].includes(condition.operator) && (
                        <input
                          type="text"
                          value={String(condition.value || '')}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                          placeholder="Value..."
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      )}
                      <button
                        onClick={() => removeCondition(condition.id)}
                        className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addCondition}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <Plus size={16} />
                    Add Another Condition
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Configure Actions</h3>
              <p className="text-sm text-slate-400 mb-6">
                Define what happens when this rule triggers
              </p>

              {actions.length > 0 && (
                <div className="space-y-3 mb-6">
                  {actions.map((action, index) => (
                    <div
                      key={action.id}
                      className="p-4 bg-slate-900 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <GripVertical size={16} className="text-slate-500" />
                          <span className="text-sm font-medium text-white">
                            {index + 1}. {getActionTypeLabel(action.action_type)}
                          </span>
                        </div>
                        <button
                          onClick={() => removeAction(action.id)}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {action.action_type === 'assign_user' && (
                        <select
                          value={(action.config.user_id as string) || ''}
                          onChange={(e) => updateAction(action.id, { user_id: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="">Select user...</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {action.action_type === 'assign_roundrobin' && (
                        <select
                          value={(action.config.department_id as string) || ''}
                          onChange={(e) => updateAction(action.id, { department_id: e.target.value || null })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="">All departments</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {(action.action_type === 'add_tag' || action.action_type === 'remove_tag') && (
                        <select
                          value={((action.config.tag_ids as string[]) || [])[0] || ''}
                          onChange={(e) => updateAction(action.id, { tag_ids: e.target.value ? [e.target.value] : [] })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="">Select tag...</option>
                          {tags.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {action.action_type === 'send_snippet' && (
                        <select
                          value={(action.config.snippet_id as string) || ''}
                          onChange={(e) => updateAction(action.id, { snippet_id: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="">Select snippet...</option>
                          {snippets.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {action.action_type === 'generate_ai_draft' && (
                        <select
                          value={(action.config.agent_id as string) || ''}
                          onChange={(e) => updateAction(action.id, { agent_id: e.target.value || null })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="">Default agent</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {action.action_type === 'notify_user' && (
                        <div className="space-y-3">
                          <select
                            value={(action.config.user_id as string) || ''}
                            onChange={(e) =>
                              updateAction(action.id, { ...action.config, user_id: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          >
                            <option value="">Select user...</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={(action.config.message as string) || ''}
                            onChange={(e) =>
                              updateAction(action.id, { ...action.config, message: e.target.value })
                            }
                            placeholder="Notification message..."
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          />
                        </div>
                      )}

                      {action.action_type === 'create_task' && (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={(action.config.title as string) || ''}
                            onChange={(e) =>
                              updateAction(action.id, { ...action.config, title: e.target.value })
                            }
                            placeholder="Task title..."
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          />
                          <div className="flex gap-3">
                            <select
                              value={(action.config.assignee_id as string) || ''}
                              onChange={(e) =>
                                updateAction(action.id, { ...action.config, assignee_id: e.target.value || null })
                              }
                              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                              <option value="">Assign to...</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={(action.config.due_days as number) || 1}
                              onChange={(e) =>
                                updateAction(action.id, { ...action.config, due_days: parseInt(e.target.value) || 1 })
                              }
                              min={1}
                              className="w-24 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <span className="py-2 text-sm text-slate-400">days</span>
                          </div>
                        </div>
                      )}

                      {action.action_type === 'close_conversation' && (
                        <p className="text-sm text-slate-400">
                          The conversation will be marked as closed.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-slate-300 mb-3">Add Action</p>
                <div className="grid grid-cols-3 gap-2">
                  {ACTION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => addAction(option.value)}
                      className="flex items-center gap-2 p-3 bg-slate-900 border border-slate-700 rounded-lg hover:border-slate-500 transition-colors text-left"
                    >
                      <option.icon size={16} className="text-slate-400" />
                      <span className="text-sm text-white">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Rule Settings</h3>
              <p className="text-sm text-slate-400 mb-6">
                Configure rule name and execution behavior
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Rule Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Auto-assign to support team"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Priority</label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value) || 100)}
                    min={1}
                    className="w-32 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">Lower numbers are evaluated first</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Cooldown (minutes)
                  </label>
                  <input
                    type="number"
                    value={cooldownMinutes}
                    onChange={(e) => setCooldownMinutes(parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-32 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    0 = no cooldown. Time before rule can trigger again on same conversation.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Max Triggers Per Day
                  </label>
                  <input
                    type="number"
                    value={maxTriggersPerDay}
                    onChange={(e) => setMaxTriggersPerDay(parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-32 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    0 = unlimited. Daily limit per conversation.
                  </p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={continueEvaluation}
                    onChange={(e) => setContinueEvaluation(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800"
                  />
                  <div>
                    <span className="text-sm font-medium text-white">Continue evaluation</span>
                    <p className="text-xs text-slate-500">
                      Allow subsequent rules to also run after this one triggers
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-700">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
            Back
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !canProceed()}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : rule ? 'Save Changes' : 'Create Rule'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
