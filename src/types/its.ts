export const ITS_ACTION_TYPES = [
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
  'create_invoice_draft',
  'query_analytics',
  'remember',
] as const;

export type ITSActionType = typeof ITS_ACTION_TYPES[number];

export const ITS_MODULE_NAMES = [
  'contacts',
  'opportunities',
  'projects',
  'tasks',
  'email',
  'sms',
  'calendar',
  'proposals',
  'payments',
  'reporting',
  'memory',
] as const;

export type ITSModuleName = typeof ITS_MODULE_NAMES[number];

export type ITSExecutionStatus =
  | 'pending'
  | 'executing'
  | 'success'
  | 'partial'
  | 'failed'
  | 'awaiting_confirmation';

export type ITSActionResultStatus =
  | 'success'
  | 'failed'
  | 'skipped'
  | 'awaiting_confirmation';

export interface CreateContactPayload {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
}

export interface UpdateContactPayload {
  contact_id: string;
  updates: Record<string, unknown>;
}

export interface CreateOpportunityPayload {
  contact_id: string;
  pipeline_id: string;
  stage_id: string;
  value_amount?: number;
  close_date?: string;
  source?: string;
}

export interface MoveOpportunityPayload {
  opportunity_id: string;
  new_stage_id: string;
}

export interface CreateProjectPayload {
  opportunity_id?: string;
  name: string;
  description?: string;
  budget_amount?: number;
  start_date?: string;
  target_end_date?: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  related_to_type?: 'contact' | 'opportunity' | 'project';
  related_to_id?: string;
}

export interface DraftEmailPayload {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  thread_id?: string | null;
}

export interface SendEmailPayload {
  draft_id?: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  reply_to_message_id?: string | null;
}

export interface SendSmsPayload {
  contact_id: string;
  message: string;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  attendees?: string[];
  location?: string | null;
}

export interface UpdateEventPayload {
  event_id: string;
  updates: Record<string, unknown>;
}

export interface CancelEventPayload {
  event_id: string;
}

export interface CreateProposalDraftPayload {
  contact_id: string;
  opportunity_id?: string | null;
  title: string;
  scope_summary?: string;
  pricing_items?: {
    name: string;
    description?: string;
    quantity: number;
    unit_price: number;
  }[];
  total_estimate?: number;
}

export interface CreateInvoiceDraftPayload {
  contact_id: string;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
  }[];
  due_date?: string;
}

export interface QueryAnalyticsPayload {
  metric: string;
  filters?: Record<string, unknown>;
  date_range?: {
    from: string;
    to: string;
  };
}

export interface RememberPayload {
  key: string;
  value: string;
  category?: string;
}

export type ITSPayload =
  | CreateContactPayload
  | UpdateContactPayload
  | CreateOpportunityPayload
  | MoveOpportunityPayload
  | CreateProjectPayload
  | CreateTaskPayload
  | DraftEmailPayload
  | SendEmailPayload
  | SendSmsPayload
  | CreateEventPayload
  | UpdateEventPayload
  | CancelEventPayload
  | CreateProposalDraftPayload
  | CreateInvoiceDraftPayload
  | QueryAnalyticsPayload
  | RememberPayload;

export interface ITSAction {
  action_id: string;
  type: ITSActionType;
  module: ITSModuleName;
  payload: Record<string, unknown>;
  depends_on: string | null;
}

export interface ITSRequest {
  intent: string;
  confidence: number;
  requires_confirmation: boolean;
  confirmation_reason: string | null;
  actions: ITSAction[];
  response_to_user: string;
}

export interface ITSActionResult {
  action_id: string;
  status: ITSActionResultStatus;
  resource_id: string | null;
  error: string | null;
}

export interface ITSExecutionResult {
  execution_id: string;
  status: ITSExecutionStatus;
  results: ITSActionResult[];
}

export interface ITSExecutionRequest {
  id: string;
  user_id: string;
  org_id: string;
  thread_id: string | null;
  intent: string;
  confidence: number;
  requires_confirmation: boolean;
  confirmation_reason: string | null;
  actions: ITSAction[];
  response_to_user: string;
  execution_status: ITSExecutionStatus;
  results: ITSActionResult[];
  model_used: string;
  raw_llm_output: unknown;
  created_at: string;
  completed_at: string | null;
}
