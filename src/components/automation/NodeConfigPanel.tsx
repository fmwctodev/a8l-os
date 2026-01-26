import { useState, useEffect } from 'react';
import { X, ChevronDown, Zap, Clock, Link, Bot, Sparkles } from 'lucide-react';
import type {
  WorkflowNode,
  WorkflowTriggerType,
  WorkflowActionType,
  DelayType,
  TriggerNodeData,
  ActionNodeData,
  DelayNodeData,
  ConditionNodeData,
  TriggerCategory,
  ScheduledTriggerConfig as ScheduledTriggerConfigType,
  WebhookTriggerConfig as WebhookTriggerConfigType,
  AIWorkflowActionType,
  AIActionConfig,
} from '../../types';
import { TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from '../../services/workflowEngine';
import { ScheduledTriggerConfig } from './ScheduledTriggerConfig';
import { WebhookTriggerConfig } from './WebhookTriggerConfig';
import { AIActionConfigPanel } from './AIActionConfigPanel';

interface NodeConfigPanelProps {
  node: WorkflowNode;
  onUpdate: (data: Record<string, unknown>) => void;
  onClose: () => void;
  canEdit: boolean;
}

const TRIGGER_TYPES: WorkflowTriggerType[] = [
  'contact_created',
  'contact_updated',
  'contact_tag_added',
  'contact_tag_removed',
  'contact_owner_changed',
  'contact_department_changed',
  'conversation_message_received',
  'conversation_status_changed',
  'conversation_assigned',
  'appointment_booked',
  'appointment_rescheduled',
  'appointment_canceled',
];

const STANDARD_ACTION_TYPES: WorkflowActionType[] = [
  'add_tag',
  'remove_tag',
  'update_field',
  'assign_owner',
  'move_department',
  'create_note',
  'send_sms',
  'send_email',
  'webhook_post',
];

const AI_ACTION_TYPES: AIWorkflowActionType[] = [
  'ai_conversation_reply',
  'ai_email_draft',
  'ai_follow_up_message',
  'ai_lead_qualification',
  'ai_booking_assist',
  'ai_decision_step',
];

const AI_ACTION_LABELS: Record<AIWorkflowActionType, string> = {
  ai_conversation_reply: 'AI Conversation Reply',
  ai_email_draft: 'AI Email Draft',
  ai_follow_up_message: 'AI Follow-up Message',
  ai_lead_qualification: 'AI Lead Qualification',
  ai_booking_assist: 'AI Booking Assistant',
  ai_decision_step: 'AI Decision Step',
};

const isAIActionType = (type: string): type is AIWorkflowActionType => {
  return AI_ACTION_TYPES.includes(type as AIWorkflowActionType);
};

const DELAY_TYPES: { value: DelayType; label: string }[] = [
  { value: 'wait_duration', label: 'Wait for duration' },
  { value: 'wait_until_datetime', label: 'Wait until date/time' },
  { value: 'wait_until_weekday_time', label: 'Wait until weekday at time' },
];

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function NodeConfigPanel({ node, onUpdate, onClose, canEdit }: NodeConfigPanelProps) {
  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          Configure {node.type}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="p-4">
        {node.type === 'trigger' && (
          <TriggerConfig
            data={node.data as TriggerNodeData}
            onUpdate={onUpdate}
            canEdit={canEdit}
          />
        )}
        {node.type === 'action' && (
          <ActionConfig
            data={node.data as ActionNodeData}
            onUpdate={onUpdate}
            canEdit={canEdit}
          />
        )}
        {node.type === 'delay' && (
          <DelayConfig
            data={node.data as DelayNodeData}
            onUpdate={onUpdate}
            canEdit={canEdit}
          />
        )}
        {node.type === 'condition' && (
          <ConditionConfig
            data={node.data as ConditionNodeData}
            onUpdate={onUpdate}
            canEdit={canEdit}
          />
        )}
        {node.type === 'end' && (
          <div className="text-center py-8 text-slate-400">
            This node marks the end of the workflow path.
          </div>
        )}
      </div>
    </div>
  );
}

const TRIGGER_CATEGORIES: { value: TriggerCategory; label: string; icon: typeof Zap; description: string }[] = [
  { value: 'event', label: 'Event-Based', icon: Zap, description: 'Triggered by contact or system events' },
  { value: 'scheduled', label: 'Scheduled', icon: Clock, description: 'Runs on a recurring schedule' },
  { value: 'webhook', label: 'Incoming Webhook', icon: Link, description: 'Triggered by external HTTP requests' },
];

const DEFAULT_SCHEDULED_CONFIG: ScheduledTriggerConfigType = {
  name: '',
  cadence: 'daily',
  timeOfDay: '09:00',
  timezone: 'UTC',
  dayOfWeek: null,
  dayOfMonth: null,
  cronExpression: null,
  filterConfig: { logic: 'and', rules: [] },
  reEnrollmentPolicy: 'never',
};

const DEFAULT_WEBHOOK_CONFIG: WebhookTriggerConfigType = {
  name: '',
  contactIdentifierField: 'email',
  contactIdentifierPath: 'email',
  payloadMapping: [],
  createContactIfMissing: true,
  updateExistingContact: true,
  reEnrollmentPolicy: 'never',
};

function TriggerConfig({
  data,
  onUpdate,
  canEdit,
}: {
  data: TriggerNodeData;
  onUpdate: (data: Record<string, unknown>) => void;
  canEdit: boolean;
}) {
  const triggerCategory = data.triggerCategory || 'event';

  const handleCategoryChange = (category: TriggerCategory) => {
    const updates: Partial<TriggerNodeData> = { triggerCategory: category };

    if (category === 'scheduled') {
      updates.triggerType = 'scheduled';
      updates.scheduledConfig = data.scheduledConfig || DEFAULT_SCHEDULED_CONFIG;
      updates.webhookConfig = undefined;
    } else if (category === 'webhook') {
      updates.triggerType = 'webhook_received';
      updates.webhookConfig = data.webhookConfig || DEFAULT_WEBHOOK_CONFIG;
      updates.scheduledConfig = undefined;
    } else {
      updates.triggerType = data.triggerType === 'scheduled' || data.triggerType === 'webhook_received'
        ? 'contact_created'
        : data.triggerType;
      updates.scheduledConfig = undefined;
      updates.webhookConfig = undefined;
    }

    onUpdate(updates);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Trigger Category
        </label>
        <div className="grid grid-cols-1 gap-2">
          {TRIGGER_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = triggerCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => canEdit && handleCategoryChange(cat.value)}
                disabled={!canEdit}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                <div>
                  <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {cat.label}
                  </div>
                  <div className="text-xs text-slate-500">{cat.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {triggerCategory === 'event' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Event Type
            </label>
            <select
              value={data.triggerType || ''}
              onChange={(e) => onUpdate({ triggerType: e.target.value as WorkflowTriggerType })}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            >
              <option value="">Select trigger...</option>
              {TRIGGER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TRIGGER_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {data.triggerType && data.triggerType !== 'scheduled' && data.triggerType !== 'webhook_received' && (
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-xs text-slate-400">
                This workflow will start when: <br />
                <span className="text-cyan-400">{TRIGGER_TYPE_LABELS[data.triggerType]}</span>
              </p>
            </div>
          )}
        </>
      )}

      {triggerCategory === 'scheduled' && (
        <div className="bg-slate-800/30 rounded-lg p-4 -mx-4">
          <ScheduledTriggerConfig
            config={data.scheduledConfig || DEFAULT_SCHEDULED_CONFIG}
            onChange={(config) => onUpdate({ scheduledConfig: config })}
          />
        </div>
      )}

      {triggerCategory === 'webhook' && (
        <div className="bg-slate-800/30 rounded-lg p-4 -mx-4">
          <WebhookTriggerConfig
            config={data.webhookConfig || DEFAULT_WEBHOOK_CONFIG}
            onChange={(config) => onUpdate({ webhookConfig: config })}
          />
        </div>
      )}
    </div>
  );
}

function ActionConfig({
  data,
  onUpdate,
  canEdit,
}: {
  data: ActionNodeData;
  onUpdate: (data: Record<string, unknown>) => void;
  canEdit: boolean;
}) {
  const config = data.config || {};
  const [actionCategory, setActionCategory] = useState<'standard' | 'ai'>(
    isAIActionType(data.actionType || '') ? 'ai' : 'standard'
  );

  const updateConfig = (updates: Record<string, unknown>) => {
    onUpdate({ config: { ...config, ...updates } });
  };

  const handleActionTypeChange = (type: string) => {
    if (isAIActionType(type)) {
      onUpdate({
        actionType: type as AIWorkflowActionType,
        config: {
          actionType: type,
          agentId: null,
          useMemory: true,
          useKnowledge: true,
          useBrandboard: true,
          inputContext: {
            includeConversationHistory: true,
            includeContactDetails: true,
            includeCustomFields: true,
            includePreviousAIOutputs: true,
            maxConversationMessages: 20,
            customInstructions: '',
          },
          outputMode: 'generate_draft',
          guardrailConfig: {
            profanityFilter: true,
            blockSensitiveClaims: true,
            blockedClaimsList: [],
            quietHoursEnabled: false,
            quietHoursStart: null,
            quietHoursEnd: null,
            maxMessageLength: null,
            disallowedDomains: [],
          },
          retryConfig: {
            maxRetries: 2,
            retryOnEmptyOutput: true,
            fallbackAction: 'skip',
          },
        },
      });
    } else {
      onUpdate({ actionType: type as WorkflowActionType, config: {} });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Action Category
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setActionCategory('standard');
              if (isAIActionType(data.actionType || '')) {
                onUpdate({ actionType: '', config: {} });
              }
            }}
            disabled={!canEdit}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
              actionCategory === 'standard'
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
            } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Zap size={16} />
            <span className="text-sm font-medium">Standard</span>
          </button>
          <button
            onClick={() => {
              setActionCategory('ai');
              if (!isAIActionType(data.actionType || '')) {
                onUpdate({ actionType: '', config: {} });
              }
            }}
            disabled={!canEdit}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
              actionCategory === 'ai'
                ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
            } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Sparkles size={16} />
            <span className="text-sm font-medium">AI-Powered</span>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Action Type
        </label>
        <select
          value={data.actionType || ''}
          onChange={(e) => handleActionTypeChange(e.target.value)}
          disabled={!canEdit}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
        >
          <option value="">Select action...</option>
          {actionCategory === 'standard' ? (
            STANDARD_ACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACTION_TYPE_LABELS[type]}
              </option>
            ))
          ) : (
            AI_ACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {AI_ACTION_LABELS[type]}
              </option>
            ))
          )}
        </select>
      </div>

      {isAIActionType(data.actionType || '') && (
        <AIActionConfigPanel
          actionType={data.actionType as AIWorkflowActionType}
          config={config as AIActionConfig}
          onChange={(newConfig) => onUpdate({ config: newConfig })}
          canEdit={canEdit}
        />
      )}

      {data.actionType === 'send_sms' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Message Body
          </label>
          <textarea
            value={(config.body as string) || ''}
            onChange={(e) => updateConfig({ body: e.target.value })}
            disabled={!canEdit}
            rows={4}
            placeholder="Hi {{contact.first_name}}! Thanks for reaching out..."
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 resize-none"
          />
          <p className="text-xs text-slate-500 mt-1">
            Use {'{{contact.first_name}}'}, {'{{contact.email}}'}, etc. for merge fields
          </p>
        </div>
      )}

      {data.actionType === 'send_email' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Subject
            </label>
            <input
              type="text"
              value={(config.subject as string) || ''}
              onChange={(e) => updateConfig({ subject: e.target.value })}
              disabled={!canEdit}
              placeholder="Welcome to our service!"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Body
            </label>
            <textarea
              value={(config.body as string) || ''}
              onChange={(e) => updateConfig({ body: e.target.value })}
              disabled={!canEdit}
              rows={6}
              placeholder="Hi {{contact.first_name}},&#10;&#10;Thank you for..."
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 resize-none"
            />
          </div>
        </>
      )}

      {data.actionType === 'create_note' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Note Content
          </label>
          <textarea
            value={(config.content as string) || ''}
            onChange={(e) => updateConfig({ content: e.target.value })}
            disabled={!canEdit}
            rows={4}
            placeholder="Automatically enrolled in workflow..."
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 resize-none"
          />
        </div>
      )}

      {data.actionType === 'update_field' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Field Name
            </label>
            <select
              value={(config.field as string) || ''}
              onChange={(e) => updateConfig({ field: e.target.value })}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            >
              <option value="">Select field...</option>
              <option value="company">Company</option>
              <option value="job_title">Job Title</option>
              <option value="source">Source</option>
              <option value="city">City</option>
              <option value="state">State</option>
              <option value="country">Country</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              New Value
            </label>
            <input
              type="text"
              value={(config.value as string) || ''}
              onChange={(e) => updateConfig({ value: e.target.value })}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />
          </div>
        </>
      )}

      {data.actionType === 'webhook_post' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Webhook URL
            </label>
            <input
              type="url"
              value={(config.url as string) || ''}
              onChange={(e) => updateConfig({ url: e.target.value })}
              disabled={!canEdit}
              placeholder="https://api.example.com/webhook"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />
          </div>
          <p className="text-xs text-slate-500">
            Contact and enrollment data will be included in the POST body.
          </p>
        </>
      )}

      {(data.actionType === 'add_tag' || data.actionType === 'remove_tag') && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Tag ID
          </label>
          <input
            type="text"
            value={(config.tagId as string) || ''}
            onChange={(e) => updateConfig({ tagId: e.target.value })}
            disabled={!canEdit}
            placeholder="Enter tag ID"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          />
          <p className="text-xs text-slate-500 mt-1">
            Copy the tag ID from your Tags settings.
          </p>
        </div>
      )}

      {data.actionType === 'assign_owner' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            User ID
          </label>
          <input
            type="text"
            value={(config.userId as string) || ''}
            onChange={(e) => updateConfig({ userId: e.target.value })}
            disabled={!canEdit}
            placeholder="Enter user ID to assign"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          />
        </div>
      )}

      {data.actionType === 'move_department' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Department ID
          </label>
          <input
            type="text"
            value={(config.departmentId as string) || ''}
            onChange={(e) => updateConfig({ departmentId: e.target.value })}
            disabled={!canEdit}
            placeholder="Enter department ID"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}

function DelayConfig({
  data,
  onUpdate,
  canEdit,
}: {
  data: DelayNodeData;
  onUpdate: (data: Record<string, unknown>) => void;
  canEdit: boolean;
}) {
  const duration = data.duration || { value: 1, unit: 'hours' };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Delay Type
        </label>
        <select
          value={data.delayType || 'wait_duration'}
          onChange={(e) => onUpdate({ delayType: e.target.value as DelayType })}
          disabled={!canEdit}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
        >
          {DELAY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {data.delayType === 'wait_duration' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Duration
            </label>
            <input
              type="number"
              min="1"
              value={duration.value}
              onChange={(e) =>
                onUpdate({ duration: { ...duration, value: parseInt(e.target.value) || 1 } })
              }
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Unit
            </label>
            <select
              value={duration.unit}
              onChange={(e) =>
                onUpdate({
                  duration: { ...duration, unit: e.target.value as 'minutes' | 'hours' | 'days' },
                })
              }
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
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
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Date & Time
          </label>
          <input
            type="datetime-local"
            value={data.datetime || ''}
            onChange={(e) => onUpdate({ datetime: e.target.value })}
            disabled={!canEdit}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          />
        </div>
      )}

      {data.delayType === 'wait_until_weekday_time' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Weekday
            </label>
            <select
              value={data.weekday ?? 1}
              onChange={(e) => onUpdate({ weekday: parseInt(e.target.value) })}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            >
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Time
            </label>
            <input
              type="time"
              value={data.time || '09:00'}
              onChange={(e) => onUpdate({ time: e.target.value })}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />
          </div>
        </>
      )}
    </div>
  );
}

function ConditionConfig({
  data,
  onUpdate,
  canEdit,
}: {
  data: ConditionNodeData;
  onUpdate: (data: Record<string, unknown>) => void;
  canEdit: boolean;
}) {
  const conditions = data.conditions || { logic: 'and', rules: [] };
  const rules = conditions.rules || [];

  const addRule = () => {
    const newRules = [
      ...rules,
      { id: `rule-${Date.now()}`, field: 'contact.first_name', operator: 'is_not_empty', value: '' },
    ];
    onUpdate({ conditions: { ...conditions, rules: newRules } });
  };

  const updateRule = (index: number, updates: Record<string, unknown>) => {
    const newRules = rules.map((rule, i) =>
      i === index ? { ...rule, ...updates } : rule
    );
    onUpdate({ conditions: { ...conditions, rules: newRules } });
  };

  const removeRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    onUpdate({ conditions: { ...conditions, rules: newRules } });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Logic
        </label>
        <select
          value={conditions.logic}
          onChange={(e) =>
            onUpdate({ conditions: { ...conditions, logic: e.target.value as 'and' | 'or' } })
          }
          disabled={!canEdit}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
        >
          <option value="and">All conditions must match (AND)</option>
          <option value="or">Any condition can match (OR)</option>
        </select>
      </div>

      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div key={rule.id || index} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Rule {index + 1}</span>
              {canEdit && (
                <button
                  onClick={() => removeRule(index)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Remove
                </button>
              )}
            </div>
            <select
              value={rule.field}
              onChange={(e) => updateRule(index, { field: e.target.value })}
              disabled={!canEdit}
              className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            >
              <option value="contact.first_name">First Name</option>
              <option value="contact.last_name">Last Name</option>
              <option value="contact.email">Email</option>
              <option value="contact.phone">Phone</option>
              <option value="contact.company">Company</option>
              <option value="contact.source">Source</option>
              <option value="contact.city">City</option>
              <option value="contact.state">State</option>
            </select>
            <select
              value={rule.operator}
              onChange={(e) => updateRule(index, { operator: e.target.value })}
              disabled={!canEdit}
              className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            >
              <option value="equals">Equals</option>
              <option value="not_equals">Does not equal</option>
              <option value="contains">Contains</option>
              <option value="not_contains">Does not contain</option>
              <option value="is_empty">Is empty</option>
              <option value="is_not_empty">Is not empty</option>
            </select>
            {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
              <input
                type="text"
                value={rule.value as string}
                onChange={(e) => updateRule(index, { value: e.target.value })}
                disabled={!canEdit}
                placeholder="Value"
                className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              />
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <button
          onClick={addRule}
          className="w-full py-2 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors text-sm"
        >
          + Add Condition Rule
        </button>
      )}

      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
        <p className="text-xs text-slate-400">
          Contacts that match will follow the <span className="text-emerald-400">True</span> path.
          <br />
          Others will follow the <span className="text-red-400">False</span> path.
        </p>
      </div>
    </div>
  );
}
