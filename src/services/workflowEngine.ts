import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEnrollment,
  Contact,
  ConditionGroup,
  ConditionRule,
  ConditionNodeData,
  DelayNodeData,
  ActionNodeData
} from '../types';

export interface ExecutionContext {
  enrollment: WorkflowEnrollment;
  contact: Contact;
  definition: WorkflowDefinition;
  contextData: Record<string, unknown>;
}

export function resolveMergeFields(
  template: string,
  context: ExecutionContext
): string {
  const { contact, contextData } = context;

  const replacements: Record<string, string> = {
    '{{contact.first_name}}': contact.first_name || '',
    '{{contact.last_name}}': contact.last_name || '',
    '{{contact.email}}': contact.email || '',
    '{{contact.phone}}': contact.phone || '',
    '{{contact.company}}': contact.company || '',
    '{{contact.job_title}}': contact.job_title || '',
    '{{contact.full_name}}': `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
  };

  if (contextData.appointment) {
    const apt = contextData.appointment as Record<string, unknown>;
    replacements['{{appointment.date}}'] = apt.date as string || '';
    replacements['{{appointment.time}}'] = apt.time as string || '';
    replacements['{{appointment.type}}'] = apt.type_name as string || '';
  }

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(escapeRegExp(key), 'g'), value);
  }

  const customFieldPattern = /\{\{custom_field\.(\w+)\}\}/g;
  result = result.replace(customFieldPattern, (match, fieldKey) => {
    const customValues = contact.custom_field_values || [];
    const field = customValues.find(v => v.custom_field?.field_key === fieldKey);
    return field?.value?.toString() || '';
  });

  return result;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function evaluateConditionGroup(
  group: ConditionGroup,
  contact: Contact,
  contextData: Record<string, unknown>
): boolean {
  const results = group.rules.map(rule => {
    if ('logic' in rule) {
      return evaluateConditionGroup(rule as ConditionGroup, contact, contextData);
    }
    return evaluateConditionRule(rule as ConditionRule, contact, contextData);
  });

  if (group.logic === 'and') {
    return results.every(r => r);
  }
  return results.some(r => r);
}

function evaluateConditionRule(
  rule: ConditionRule,
  contact: Contact,
  contextData: Record<string, unknown>
): boolean {
  let fieldValue: unknown;

  if (rule.field.startsWith('contact.')) {
    const fieldName = rule.field.replace('contact.', '') as keyof Contact;
    fieldValue = contact[fieldName];
  } else if (rule.field.startsWith('custom_field.')) {
    const fieldKey = rule.field.replace('custom_field.', '');
    const customValues = contact.custom_field_values || [];
    const field = customValues.find(v => v.custom_field?.field_key === fieldKey);
    fieldValue = field?.value;
  } else if (rule.field.startsWith('context.')) {
    const key = rule.field.replace('context.', '');
    fieldValue = contextData[key];
  } else {
    fieldValue = (contact as Record<string, unknown>)[rule.field];
  }

  const compareValue = rule.value;

  switch (rule.operator) {
    case 'equals':
      return String(fieldValue).toLowerCase() === String(compareValue).toLowerCase();

    case 'not_equals':
      return String(fieldValue).toLowerCase() !== String(compareValue).toLowerCase();

    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());

    case 'not_contains':
      return !String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());

    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';

    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';

    case 'greater_than':
      return Number(fieldValue) > Number(compareValue);

    case 'less_than':
      return Number(fieldValue) < Number(compareValue);

    case 'has_tag': {
      const tags = contact.tags || [];
      return tags.some(t => t.id === compareValue || t.name === compareValue);
    }

    case 'does_not_have_tag': {
      const tags = contact.tags || [];
      return !tags.some(t => t.id === compareValue || t.name === compareValue);
    }

    default:
      return false;
  }
}

export function evaluateConditionNode(
  node: WorkflowNode,
  context: ExecutionContext
): boolean {
  const data = node.data as ConditionNodeData;
  if (!data.conditions) return true;

  return evaluateConditionGroup(data.conditions, context.contact, context.contextData);
}

export function calculateDelayRunAt(
  node: WorkflowNode,
  currentTime: Date = new Date()
): Date {
  const data = node.data as DelayNodeData;

  switch (data.delayType) {
    case 'wait_duration': {
      if (!data.duration) return currentTime;

      const { value, unit } = data.duration;
      const ms = currentTime.getTime();

      switch (unit) {
        case 'minutes':
          return new Date(ms + value * 60 * 1000);
        case 'hours':
          return new Date(ms + value * 60 * 60 * 1000);
        case 'days':
          return new Date(ms + value * 24 * 60 * 60 * 1000);
        default:
          return new Date(ms + value * 60 * 1000);
      }
    }

    case 'wait_until_datetime': {
      if (!data.datetime) return currentTime;
      const targetDate = new Date(data.datetime);
      return targetDate > currentTime ? targetDate : currentTime;
    }

    case 'wait_until_weekday_time': {
      if (data.weekday === undefined || !data.time) return currentTime;

      const [hours, minutes] = data.time.split(':').map(Number);
      const targetWeekday = data.weekday;

      const result = new Date(currentTime);
      result.setHours(hours, minutes, 0, 0);

      const currentWeekday = currentTime.getDay();
      let daysToAdd = targetWeekday - currentWeekday;

      if (daysToAdd < 0 || (daysToAdd === 0 && result <= currentTime)) {
        daysToAdd += 7;
      }

      result.setDate(result.getDate() + daysToAdd);
      return result;
    }

    default:
      return currentTime;
  }
}

export function getNextNode(
  definition: WorkflowDefinition,
  currentNodeId: string,
  conditionResult?: boolean
): WorkflowNode | null {
  const currentNode = definition.nodes.find(n => n.id === currentNodeId);
  if (!currentNode) return null;

  let targetEdge;

  if (currentNode.type === 'condition') {
    const handleSuffix = conditionResult ? 'true' : 'false';
    targetEdge = definition.edges.find(
      e => e.source === currentNodeId && e.sourceHandle === handleSuffix
    );
  } else {
    targetEdge = definition.edges.find(e => e.source === currentNodeId);
  }

  if (!targetEdge) return null;

  return definition.nodes.find(n => n.id === targetEdge.target) || null;
}

export function getNodeById(
  definition: WorkflowDefinition,
  nodeId: string
): WorkflowNode | null {
  return definition.nodes.find(n => n.id === nodeId) || null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /** Per-node error messages, keyed by node.id, for inline canvas rendering. */
  nodeErrors: Record<string, string[]>;
}

/**
 * Action types whose configuration should be validated for non-empty
 * required fields. Map of actionType → list of required keys inside
 * node.data.config (or top-level node.data).
 */
const REQUIRED_ACTION_CONFIG: Record<string, string[]> = {
  send_email: ['subject', 'body'],
  send_internal_email: ['subject', 'body'],
  send_sms: ['body'],
  send_internal_sms: ['body'],
  send_slack_message: ['channelId', 'message'],
  send_messenger: ['body'],
  send_gmb_message: ['body'],
  send_proposal: ['proposalTemplateId'],
  create_proposal: ['proposalTemplateId'],
  add_tag: ['tagId'],
  remove_tag: ['tagId'],
  update_contact_field: ['fieldName'],
  update_custom_field: ['fieldKey'],
  assign_contact_owner: ['ownerId'],
  create_task: ['title'],
  assign_task: ['taskId', 'assigneeId'],
  create_opportunity: ['pipelineId'],
  move_opportunity_stage: ['stageId'],
  create_invoice: ['lineItems'],
  send_invoice: ['invoiceId'],
  webhook: ['url'],
  webhook_post: ['url'],
  notify_user: ['userId'],
  send_internal_notification: ['userIds'],
  ai_prompt: ['prompt'],
  ai_email_draft: ['prompt'],
  ai_lead_qualification: ['prompt'],
  ai_decision_step: ['prompt'],
  generate_meeting_follow_up: ['meetingId'],
  add_to_workflow: ['workflowId'],
  trigger_another_workflow: ['workflowId'],
  remove_from_workflow_action: ['workflowId'],
  go_to: ['targetNodeId'],
  split_test: ['variants'],
  drip_mode: ['batchSize', 'intervalMinutes'],
  update_lead_score: ['delta'],
  update_custom_value: ['fieldKey'],
  array_operation: ['operation'],
  text_formatter: ['operation', 'sourceField'],
  modify_engagement_score: ['delta'],
  modify_followers: ['userIds'],
  add_note: ['body'],
  send_review_request: [],
  copy_contact: [],
  delete_contact: [],
  set_dnd: [],
  log_custom_event: ['eventName'],
  send_facebook_dm: ['body'],
  send_instagram_dm: ['body'],
  manual_action: ['title'],
};

/**
 * Trigger types whose configuration must include a specific field.
 */
const REQUIRED_TRIGGER_CONFIG: Record<string, string[]> = {
  scheduled: ['cadence'],
  webhook_received: ['token'],
  birthday_reminder: [],
  custom_date_reminder: ['customDateField'],
  contact_custom_date_reminder: ['customDateField'],
  contact_tag_changed: [],
  trigger_link_clicked: [],
};

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function getConfigField(data: Record<string, unknown>, key: string): unknown {
  // Try top-level, then config sub-object, then triggerConfig sub-object
  const top = data[key];
  if (!isEmpty(top)) return top;
  const cfg = data.config as Record<string, unknown> | undefined;
  if (cfg && !isEmpty(cfg[key])) return cfg[key];
  const trCfg = data.triggerConfig as Record<string, unknown> | undefined;
  if (trCfg && !isEmpty(trCfg[key])) return trCfg[key];
  return undefined;
}

export function validateWorkflowDefinition(
  definition: WorkflowDefinition
): ValidationResult {
  const errors: string[] = [];
  const nodeErrors: Record<string, string[]> = {};

  const pushNodeError = (nodeId: string, msg: string) => {
    if (!nodeErrors[nodeId]) nodeErrors[nodeId] = [];
    nodeErrors[nodeId].push(msg);
    errors.push(msg);
  };

  // 1. Structural — must have at least one trigger and at least one end
  const triggerNodes = definition.nodes.filter(n => n.type === 'trigger');
  if (triggerNodes.length === 0) {
    errors.push('Workflow must have at least one trigger');
  }

  const endNodes = definition.nodes.filter(n => n.type === 'end');
  if (endNodes.length === 0) {
    errors.push('Workflow must have at least one end node');
  }

  // 2. Per-node connectivity
  for (const node of definition.nodes) {
    if (node.type !== 'trigger') {
      const hasIncoming = definition.edges.some(e => e.target === node.id);
      if (!hasIncoming) {
        pushNodeError(node.id, `Node has no incoming connection`);
      }
    }

    if (node.type !== 'end') {
      const hasOutgoing = definition.edges.some(e => e.source === node.id);
      if (!hasOutgoing) {
        pushNodeError(node.id, `Node has no outgoing connection`);
      }
    }

    if (node.type === 'condition') {
      const trueEdge = definition.edges.find(
        e => e.source === node.id && e.sourceHandle === 'true'
      );
      const falseEdge = definition.edges.find(
        e => e.source === node.id && e.sourceHandle === 'false'
      );

      if (!trueEdge || !falseEdge) {
        pushNodeError(node.id, `Condition needs both true and false paths`);
      }

      // Condition data must have at least one rule
      const data = node.data as { rules?: Array<{ field?: string; operator?: string; value?: unknown }> };
      if (!data.rules || data.rules.length === 0) {
        pushNodeError(node.id, `Condition needs at least one rule`);
      } else {
        for (const rule of data.rules) {
          if (!rule.field || !rule.operator) {
            pushNodeError(node.id, `Rule is missing field or operator`);
            break;
          }
          // value can be empty for is_empty / is_not_empty operators
          const noValueOps = new Set(['is_empty', 'is_not_empty']);
          if (!noValueOps.has(rule.operator) && isEmpty(rule.value)) {
            pushNodeError(node.id, `Rule "${rule.field}" needs a value`);
            break;
          }
        }
      }
    }
  }

  // 3. Trigger config completeness
  for (const node of triggerNodes) {
    const data = (node.data || {}) as Record<string, unknown>;
    const triggerType = (data.triggerType as string) || '';
    if (!triggerType) {
      pushNodeError(node.id, `Trigger has no type set`);
      continue;
    }
    const required = REQUIRED_TRIGGER_CONFIG[triggerType];
    if (required) {
      for (const key of required) {
        if (isEmpty(getConfigField(data, key))) {
          pushNodeError(node.id, `Trigger needs "${key}" configured`);
        }
      }
    }
  }

  // 4. Action config completeness
  for (const node of definition.nodes) {
    if (node.type !== 'action') continue;
    const data = (node.data || {}) as ActionNodeData & Record<string, unknown>;
    if (!data.actionType) {
      pushNodeError(node.id, `Action has no type set`);
      continue;
    }
    const required = REQUIRED_ACTION_CONFIG[data.actionType as string];
    if (required && required.length > 0) {
      for (const key of required) {
        if (isEmpty(getConfigField(data as Record<string, unknown>, key))) {
          pushNodeError(node.id, `Action "${data.actionType}" needs "${key}"`);
        }
      }
    }
  }

  // 5. Reachability — BFS from each trigger; flag nodes not reached
  const reachable = new Set<string>();
  const queue: string[] = triggerNodes.map(n => n.id);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (reachable.has(cur)) continue;
    reachable.add(cur);
    for (const edge of definition.edges) {
      if (edge.source === cur && !reachable.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }
  for (const node of definition.nodes) {
    if (!reachable.has(node.id) && node.type !== 'trigger') {
      pushNodeError(node.id, `Node is unreachable from any trigger`);
    }
  }

  // 6. Cycle detection — DFS detecting back-edges. Goal/Go-To loops are
  //    intentional but the engine bounds them via maxJumps; here we only
  //    flag cycles that DON'T pass through a goal or go_to action node, so
  //    intentional jump-back patterns are still allowed.
  const adj = new Map<string, string[]>();
  for (const e of definition.edges) {
    const list = adj.get(e.source) || [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  const flagsCycleAllowed = (nodeId: string): boolean => {
    const node = definition.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    if (node.type === 'goal') return true;
    if (node.type === 'action') {
      const at = (node.data as { actionType?: string })?.actionType;
      if (at === 'go_to' || at === 'goal_check') return true;
    }
    return false;
  };

  const visited = new Set<string>();
  const stack = new Set<string>();
  const stackPath: string[] = [];

  function dfs(nodeId: string): void {
    if (stack.has(nodeId)) {
      // Cycle detected back to nodeId — extract path
      const startIdx = stackPath.indexOf(nodeId);
      const cycle = stackPath.slice(startIdx).concat(nodeId);
      const hasAllowed = cycle.some(flagsCycleAllowed);
      if (!hasAllowed) {
        for (const id of cycle) {
          pushNodeError(id, `Node is part of an infinite loop (no goal/go-to break)`);
        }
      }
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    stack.add(nodeId);
    stackPath.push(nodeId);

    for (const next of adj.get(nodeId) || []) {
      dfs(next);
    }

    stack.delete(nodeId);
    stackPath.pop();
  }

  for (const trigger of triggerNodes) {
    dfs(trigger.id);
  }

  return {
    valid: errors.length === 0,
    errors,
    nodeErrors,
  };
}

export const TRIGGER_TYPE_LABELS: Record<string, string> = {
  contact_created: 'Contact Created',
  contact_updated: 'Contact Updated',
  contact_tag_added: 'Tag Added to Contact',
  contact_tag_removed: 'Tag Removed from Contact',
  contact_owner_changed: 'Contact Owner Changed',
  contact_department_changed: 'Contact Department Changed',
  conversation_message_received: 'Message Received',
  conversation_status_changed: 'Conversation Status Changed',
  conversation_assigned: 'Conversation Assigned',
  appointment_booked: 'Appointment Booked',
  appointment_rescheduled: 'Appointment Rescheduled',
  appointment_canceled: 'Appointment Canceled',
  scheduled: 'Scheduled (Recurring)',
  webhook_received: 'Incoming Webhook',
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  add_tag: 'Add Tag',
  remove_tag: 'Remove Tag',
  update_field: 'Update Contact Field',
  assign_owner: 'Assign Owner',
  move_department: 'Move to Department',
  create_note: 'Create Note',
  send_email: 'Send Email',
  webhook_post: 'HTTP Webhook',
  internal_notification: 'Internal Notification'
};

export const SKIPPED_ACTION_TYPES = new Set([
  'send_sms',
  'send_internal_sms',
]);
