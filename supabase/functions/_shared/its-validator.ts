const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ALLOWED_ACTION_TYPES = new Set([
  'create_contact',
  'update_contact',
  'create_opportunity',
  'move_opportunity',
  'create_project',
  'create_task',
  'draft_email',
  'send_email',
  'send_sms',
  'create_event',
  'update_event',
  'cancel_event',
  'create_proposal_draft',
  'query_analytics',
  'query_schedule',
  'query_contacts',
  'query_opportunities',
  'query_tasks',
  'query_projects',
  'query_proposals',
  'remember',
]);

const MODULE_MAP: Record<string, string> = {
  create_contact: 'contacts',
  update_contact: 'contacts',
  create_opportunity: 'opportunities',
  move_opportunity: 'opportunities',
  create_project: 'projects',
  create_task: 'tasks',
  draft_email: 'email',
  send_email: 'email',
  send_sms: 'sms',
  create_event: 'calendar',
  update_event: 'calendar',
  cancel_event: 'calendar',
  create_proposal_draft: 'proposals',
  query_analytics: 'reporting',
  query_schedule: 'calendar',
  query_contacts: 'contacts',
  query_opportunities: 'opportunities',
  query_tasks: 'tasks',
  query_projects: 'projects',
  query_proposals: 'proposals',
  remember: 'memory',
};

interface PayloadFieldDef {
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'uuid' | 'email' | 'iso_date' | 'iso_datetime' | 'array' | 'object' | 'email_array' | 'string_array';
}

const PAYLOAD_SCHEMAS: Record<string, Record<string, PayloadFieldDef>> = {
  create_contact: {
    first_name: { required: true, type: 'string' },
    last_name: { required: false, type: 'string' },
    email: { required: false, type: 'email' },
    phone: { required: false, type: 'string' },
    company: { required: false, type: 'string' },
    tags: { required: false, type: 'string_array' },
    custom_fields: { required: false, type: 'object' },
  },
  update_contact: {
    contact_id: { required: true, type: 'uuid' },
    updates: { required: true, type: 'object' },
  },
  create_opportunity: {
    contact_id: { required: true, type: 'uuid' },
    pipeline_id: { required: true, type: 'uuid' },
    stage_id: { required: true, type: 'uuid' },
    value_amount: { required: false, type: 'number' },
    close_date: { required: false, type: 'iso_date' },
    source: { required: false, type: 'string' },
  },
  move_opportunity: {
    opportunity_id: { required: true, type: 'uuid' },
    new_stage_id: { required: true, type: 'uuid' },
  },
  create_project: {
    opportunity_id: { required: false, type: 'uuid' },
    name: { required: true, type: 'string' },
    description: { required: false, type: 'string' },
    budget_amount: { required: false, type: 'number' },
    start_date: { required: false, type: 'iso_date' },
    target_end_date: { required: false, type: 'iso_date' },
  },
  create_task: {
    title: { required: true, type: 'string' },
    description: { required: false, type: 'string' },
    due_date: { required: false, type: 'iso_date' },
    priority: { required: false, type: 'string' },
    related_to_type: { required: false, type: 'string' },
    related_to_id: { required: false, type: 'uuid' },
  },
  draft_email: {
    to: { required: true, type: 'email_array' },
    cc: { required: false, type: 'email_array' },
    subject: { required: true, type: 'string' },
    body: { required: true, type: 'string' },
    thread_id: { required: false, type: 'string' },
  },
  send_email: {
    draft_id: { required: false, type: 'string' },
    to: { required: false, type: 'email_array' },
    cc: { required: false, type: 'email_array' },
    subject: { required: false, type: 'string' },
    body: { required: false, type: 'string' },
    reply_to_message_id: { required: false, type: 'string' },
  },
  send_sms: {
    contact_id: { required: true, type: 'uuid' },
    message: { required: true, type: 'string' },
  },
  create_event: {
    title: { required: true, type: 'string' },
    description: { required: false, type: 'string' },
    start_time: { required: true, type: 'iso_datetime' },
    end_time: { required: true, type: 'iso_datetime' },
    attendees: { required: false, type: 'email_array' },
    location: { required: false, type: 'string' },
  },
  update_event: {
    event_id: { required: true, type: 'string' },
    updates: { required: true, type: 'object' },
  },
  cancel_event: {
    event_id: { required: true, type: 'string' },
  },
  create_proposal_draft: {
    contact_id: { required: true, type: 'uuid' },
    opportunity_id: { required: false, type: 'uuid' },
    title: { required: true, type: 'string' },
    scope_summary: { required: false, type: 'string' },
    pricing_items: { required: false, type: 'array' },
    total_estimate: { required: false, type: 'number' },
  },
  query_schedule: {
    date_from: { required: true, type: 'iso_date' },
    date_to: { required: true, type: 'iso_date' },
  },
  query_contacts: {
    search: { required: true, type: 'string' },
    limit: { required: false, type: 'number' },
  },
  query_opportunities: {
    status: { required: false, type: 'string' },
    pipeline_id: { required: false, type: 'uuid' },
    search: { required: false, type: 'string' },
    date_from: { required: false, type: 'iso_date' },
    date_to: { required: false, type: 'iso_date' },
    limit: { required: false, type: 'number' },
  },
  query_tasks: {
    status: { required: false, type: 'string' },
    date_from: { required: false, type: 'iso_date' },
    date_to: { required: false, type: 'iso_date' },
    priority: { required: false, type: 'string' },
    limit: { required: false, type: 'number' },
  },
  query_projects: {
    status: { required: false, type: 'string' },
    search: { required: false, type: 'string' },
    limit: { required: false, type: 'number' },
  },
  query_proposals: {
    status: { required: false, type: 'string' },
    search: { required: false, type: 'string' },
    limit: { required: false, type: 'number' },
  },
  query_analytics: {
    metric: { required: true, type: 'string' },
    filters: { required: false, type: 'object' },
    date_range: { required: false, type: 'object' },
  },
  remember: {
    key: { required: true, type: 'string' },
    value: { required: true, type: 'string' },
    category: { required: false, type: 'string' },
  },
};

export function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

export function isValidISODate(str: string): boolean {
  return ISO_DATE_REGEX.test(str) || ISO_DATETIME_REGEX.test(str);
}

export function isValidEmail(str: string): boolean {
  return EMAIL_REGEX.test(str);
}

function validateFieldValue(value: unknown, def: PayloadFieldDef): string | null {
  if (value === null || value === undefined) {
    return def.required ? 'is required' : null;
  }

  switch (def.type) {
    case 'string':
      if (typeof value !== 'string') return 'must be a string';
      if (def.required && value.trim() === '') return 'cannot be empty';
      break;
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) return 'must be a number';
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return 'must be a boolean';
      break;
    case 'uuid':
      if (typeof value !== 'string' || !isValidUUID(value)) return 'must be a valid UUID';
      break;
    case 'email':
      if (typeof value !== 'string' || !isValidEmail(value)) return 'must be a valid email';
      break;
    case 'iso_date':
      if (typeof value !== 'string' || !isValidISODate(value)) return 'must be a valid ISO date';
      break;
    case 'iso_datetime':
      if (typeof value !== 'string' || !ISO_DATETIME_REGEX.test(value)) return 'must be a valid ISO datetime';
      break;
    case 'array':
      if (!Array.isArray(value)) return 'must be an array';
      break;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) return 'must be an object';
      break;
    case 'email_array':
      if (!Array.isArray(value)) return 'must be an array of emails';
      for (const item of value) {
        if (typeof item !== 'string' || !isValidEmail(item)) {
          return `contains invalid email: ${item}`;
        }
      }
      break;
    case 'string_array':
      if (!Array.isArray(value)) return 'must be an array of strings';
      for (const item of value) {
        if (typeof item !== 'string') return 'contains non-string value';
      }
      break;
  }

  return null;
}

interface ITSAction {
  action_id: string;
  type: string;
  module: string;
  payload: Record<string, unknown>;
  depends_on: string | null;
}

interface ITSRequest {
  intent: string;
  confidence: number;
  requires_confirmation: boolean;
  confirmation_reason: string | null;
  actions: ITSAction[];
  response_to_user: string;
}

interface ValidationResult {
  valid: boolean;
  request?: ITSRequest;
  errors?: string[];
}

export function validateITSRequest(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Root must be an object'] };
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.intent !== 'string' || obj.intent.trim() === '') {
    errors.push('intent is required and must be a non-empty string');
  }

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
    errors.push('confidence must be a number between 0 and 1');
  }

  if (typeof obj.requires_confirmation !== 'boolean') {
    errors.push('requires_confirmation must be a boolean');
  }

  if (obj.confirmation_reason !== null && obj.confirmation_reason !== undefined && typeof obj.confirmation_reason !== 'string') {
    errors.push('confirmation_reason must be a string or null');
  }

  if (typeof obj.response_to_user !== 'string') {
    errors.push('response_to_user is required and must be a string');
  }

  if (!Array.isArray(obj.actions)) {
    errors.push('actions must be an array');
    return { valid: false, errors };
  }

  const actionIds = new Set<string>();
  for (let i = 0; i < obj.actions.length; i++) {
    const action = obj.actions[i] as Record<string, unknown>;
    const prefix = `actions[${i}]`;

    if (!action || typeof action !== 'object') {
      errors.push(`${prefix}: must be an object`);
      continue;
    }

    if (typeof action.action_id !== 'string' || action.action_id.trim() === '') {
      errors.push(`${prefix}.action_id: must be a non-empty string`);
    } else {
      if (actionIds.has(action.action_id as string)) {
        errors.push(`${prefix}.action_id: duplicate ID "${action.action_id}"`);
      }
      actionIds.add(action.action_id as string);
    }

    if (!ALLOWED_ACTION_TYPES.has(action.type as string)) {
      errors.push(`${prefix}.type: "${action.type}" is not an allowed action type`);
    }

    const expectedModule = MODULE_MAP[action.type as string];
    if (expectedModule && action.module !== expectedModule) {
      errors.push(`${prefix}.module: expected "${expectedModule}" for type "${action.type}", got "${action.module}"`);
    }

    if (action.depends_on !== null && action.depends_on !== undefined) {
      if (typeof action.depends_on !== 'string') {
        errors.push(`${prefix}.depends_on: must be a string or null`);
      }
    }

    if (!action.payload || typeof action.payload !== 'object' || Array.isArray(action.payload)) {
      errors.push(`${prefix}.payload: must be an object`);
    }
  }

  for (let i = 0; i < obj.actions.length; i++) {
    const action = obj.actions[i] as Record<string, unknown>;
    if (action.depends_on && typeof action.depends_on === 'string' && !actionIds.has(action.depends_on)) {
      errors.push(`actions[${i}].depends_on: references unknown action_id "${action.depends_on}"`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    request: {
      intent: obj.intent as string,
      confidence: obj.confidence as number,
      requires_confirmation: obj.requires_confirmation as boolean,
      confirmation_reason: (obj.confirmation_reason as string) || null,
      actions: obj.actions as ITSAction[],
      response_to_user: obj.response_to_user as string,
    },
  };
}

export function validateActionPayload(action: ITSAction): { valid: boolean; errors: string[] } {
  const schema = PAYLOAD_SCHEMAS[action.type];
  if (!schema) {
    return { valid: false, errors: [`Unknown action type: ${action.type}`] };
  }

  const errors: string[] = [];
  const payload = action.payload || {};

  for (const [fieldName, fieldDef] of Object.entries(schema)) {
    const value = payload[fieldName];
    const err = validateFieldValue(value, fieldDef);
    if (err) {
      errors.push(`${action.type}.${fieldName}: ${err}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function stripUnknownKeys(action: ITSAction): ITSAction {
  const schema = PAYLOAD_SCHEMAS[action.type];
  if (!schema) return action;

  const allowedKeys = new Set(Object.keys(schema));
  const cleanPayload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(action.payload || {})) {
    if (allowedKeys.has(key)) {
      cleanPayload[key] = value;
    }
  }

  return { ...action, payload: cleanPayload };
}

export function getModuleForActionType(actionType: string): string {
  return MODULE_MAP[actionType] || 'general';
}
