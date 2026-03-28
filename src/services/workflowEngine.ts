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

export function validateWorkflowDefinition(
  definition: WorkflowDefinition
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const triggerNodes = definition.nodes.filter(n => n.type === 'trigger');
  if (triggerNodes.length === 0) {
    errors.push('Workflow must have at least one trigger');
  }

  const endNodes = definition.nodes.filter(n => n.type === 'end');
  if (endNodes.length === 0) {
    errors.push('Workflow must have at least one end node');
  }

  for (const node of definition.nodes) {
    if (node.type === 'trigger') continue;

    const hasIncoming = definition.edges.some(e => e.target === node.id);
    if (!hasIncoming) {
      errors.push(`Node "${node.id}" has no incoming connection`);
    }
  }

  for (const node of definition.nodes) {
    if (node.type === 'end') continue;

    const hasOutgoing = definition.edges.some(e => e.source === node.id);
    if (!hasOutgoing) {
      errors.push(`Node "${node.id}" has no outgoing connection`);
    }

    if (node.type === 'condition') {
      const trueEdge = definition.edges.find(
        e => e.source === node.id && e.sourceHandle === 'true'
      );
      const falseEdge = definition.edges.find(
        e => e.source === node.id && e.sourceHandle === 'false'
      );

      if (!trueEdge || !falseEdge) {
        errors.push(`Condition node "${node.id}" must have both true and false paths`);
      }
    }
  }

  for (const node of definition.nodes) {
    if (node.type === 'action') {
      const data = node.data as ActionNodeData;
      if (!data.actionType) {
        errors.push(`Action node "${node.id}" must have an action type`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
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
