import type { Node, Edge } from '@xyflow/react';
import type {
  WorkflowNodeType,
  WorkflowNodeData,
  TriggerNodeData,
  ActionNodeData,
  ConditionNodeData,
  DelayNodeData,
  GoalNodeData,
  EndNodeData,
  ConditionGroup,
} from './index';

export interface BuilderNodeData extends Record<string, unknown> {
  nodeType: WorkflowNodeType;
  nodeData: WorkflowNodeData;
  label: string;
  description?: string;
  isValid: boolean;
  validationErrors: string[];
}

export type BuilderNode = Node<BuilderNodeData>;
export type BuilderEdge = Edge<{ insertable: boolean }>;

export type DrawerMode =
  | { type: 'closed' }
  | { type: 'trigger-picker' }
  | { type: 'action-picker'; insertionEdgeId: string }
  | { type: 'node-config'; nodeId: string }
  | { type: 'workflow-settings' }
  | { type: 'version-history' };

export interface NodeStats {
  nodeId: string;
  entered: number;
  completed: number;
  failed: number;
  conversionRate: number;
  avgDurationMs?: number;
  messageSent?: number;
  messageDelivered?: number;
  messageOpened?: number;
  messageClicked?: number;
}

export interface WorkflowLevelStats {
  totalEnrolled: number;
  active: number;
  completed: number;
  failed: number;
  avgCompletionTimeMs: number;
}

export interface TestWorkflowStep {
  nodeId: string;
  nodeType: WorkflowNodeType;
  label: string;
  status: 'executed' | 'skipped' | 'waiting' | 'failed';
  detail?: string;
  branchTaken?: string;
}

export interface TestWorkflowResult {
  triggerId: string;
  triggerLabel: string;
  steps: TestWorkflowStep[];
  completed: boolean;
  failureReason?: string;
}

export interface ValidationIssue {
  nodeId: string;
  nodeLabel: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface WorkflowSettings {
  enrollmentRules: {
    allow_re_enrollment: 'never' | 'after_completion' | 'always';
    stop_existing_on_re_entry: boolean;
    max_concurrent_enrollments: number;
  };
  waitTimeoutDays: number;
  loggingVerbosity: 'minimal' | 'standard' | 'verbose';
  failureNotificationUserIds: string[];
  folder?: string;
  category?: string;
}

export const TRIGGER_CATEGORIES = [
  { key: 'contact', label: 'Contact', icon: 'User' },
  { key: 'conversations', label: 'Conversations', icon: 'MessageSquare' },
  { key: 'appointments', label: 'Appointments', icon: 'Calendar' },
  { key: 'opportunities', label: 'Opportunities', icon: 'TrendingUp' },
  { key: 'payments', label: 'Payments', icon: 'CreditCard' },
  { key: 'communication', label: 'Communication', icon: 'Send' },
  { key: 'marketing', label: 'Marketing', icon: 'Megaphone' },
  { key: 'reputation', label: 'Reputation / Reviews', icon: 'Star' },
  { key: 'projects', label: 'Projects', icon: 'FolderKanban' },
  { key: 'proposals', label: 'Proposals', icon: 'FileText' },
  { key: 'ai', label: 'AI', icon: 'Sparkles' },
  { key: 'custom', label: 'Custom / Webhook / Scheduler', icon: 'Webhook' },
] as const;

export type TriggerCategoryKey = typeof TRIGGER_CATEGORIES[number]['key'];

export interface TriggerOption {
  type: string;
  label: string;
  description: string;
  category: TriggerCategoryKey;
}

export const TRIGGER_OPTIONS: TriggerOption[] = [
  { type: 'contact_created', label: 'Contact Created', description: 'When a new contact is created', category: 'contact' },
  { type: 'contact_updated', label: 'Contact Updated', description: 'When contact details change', category: 'contact' },
  { type: 'contact_tag_added', label: 'Tag Added', description: 'When a tag is added to a contact', category: 'contact' },
  { type: 'contact_tag_removed', label: 'Tag Removed', description: 'When a tag is removed from a contact', category: 'contact' },
  { type: 'contact_owner_changed', label: 'Owner Changed', description: 'When contact owner is reassigned', category: 'contact' },
  { type: 'contact_status_changed', label: 'Status Changed', description: 'When contact status changes', category: 'contact' },

  { type: 'conversation_message_received', label: 'Message Received', description: 'When a new message arrives in a conversation', category: 'conversations' },
  { type: 'conversation_status_changed', label: 'Conversation Status Changed', description: 'When conversation status changes', category: 'conversations' },
  { type: 'conversation_assigned', label: 'Conversation Assigned', description: 'When a conversation is assigned to a user', category: 'conversations' },
  { type: 'message_received', label: 'Inbound Message', description: 'When any inbound message is received', category: 'communication' },
  { type: 'message_sent', label: 'Message Sent', description: 'When a message is sent', category: 'communication' },

  { type: 'appointment_booked', label: 'Appointment Booked', description: 'When an appointment is booked', category: 'appointments' },
  { type: 'appointment_confirmed', label: 'Appointment Confirmed', description: 'When an appointment is confirmed', category: 'appointments' },
  { type: 'appointment_rescheduled', label: 'Appointment Rescheduled', description: 'When an appointment is rescheduled', category: 'appointments' },
  { type: 'appointment_canceled', label: 'Appointment Canceled', description: 'When an appointment is canceled', category: 'appointments' },
  { type: 'appointment_completed', label: 'Appointment Completed', description: 'When an appointment is marked complete', category: 'appointments' },
  { type: 'appointment_no_show', label: 'No Show', description: 'When a contact does not show up', category: 'appointments' },

  { type: 'opportunity_created', label: 'Opportunity Created', description: 'When a new opportunity is created', category: 'opportunities' },
  { type: 'opportunity_stage_changed', label: 'Stage Changed', description: 'When an opportunity moves stages', category: 'opportunities' },
  { type: 'opportunity_won', label: 'Opportunity Won', description: 'When an opportunity is marked won', category: 'opportunities' },
  { type: 'opportunity_lost', label: 'Opportunity Lost', description: 'When an opportunity is marked lost', category: 'opportunities' },
  { type: 'opportunity_value_changed', label: 'Value Changed', description: 'When the monetary value changes', category: 'opportunities' },

  { type: 'payment_received', label: 'Payment Received', description: 'When a payment is received', category: 'payments' },
  { type: 'invoice_created', label: 'Invoice Created', description: 'When a new invoice is created', category: 'payments' },
  { type: 'invoice_sent', label: 'Invoice Sent', description: 'When an invoice is sent to a contact', category: 'payments' },
  { type: 'invoice_paid', label: 'Invoice Paid', description: 'When an invoice is fully paid', category: 'payments' },
  { type: 'invoice_overdue', label: 'Invoice Overdue', description: 'When an invoice becomes overdue', category: 'payments' },

  { type: 'form_submitted', label: 'Form Submitted', description: 'When a form submission is received', category: 'marketing' },
  { type: 'survey_submitted', label: 'Survey Submitted', description: 'When a survey response is received', category: 'marketing' },
  { type: 'social_post_published', label: 'Social Post Published', description: 'When a social post goes live', category: 'marketing' },

  { type: 'review_received', label: 'Review Received', description: 'When a new review is posted', category: 'reputation' },
  { type: 'review_response_needed', label: 'Review Response Needed', description: 'When a review needs a response', category: 'reputation' },
  { type: 'score_threshold_reached', label: 'Lead Score Threshold', description: 'When lead score reaches a threshold', category: 'reputation' },

  { type: 'project_created', label: 'Project Created', description: 'When a new project is created', category: 'projects' },
  { type: 'project_stage_changed', label: 'Project Stage Changed', description: 'When project moves to a new stage', category: 'projects' },
  { type: 'project_completed', label: 'Project Completed', description: 'When a project is marked complete', category: 'projects' },
  { type: 'project_overdue', label: 'Project Overdue', description: 'When a project passes its due date', category: 'projects' },

  { type: 'proposal_sent', label: 'Proposal Sent', description: 'When a proposal is sent', category: 'proposals' },
  { type: 'proposal_viewed', label: 'Proposal Viewed', description: 'When a proposal is viewed by client', category: 'proposals' },
  { type: 'proposal_accepted', label: 'Proposal Accepted', description: 'When a proposal is accepted', category: 'proposals' },
  { type: 'proposal_declined', label: 'Proposal Declined', description: 'When a proposal is declined', category: 'proposals' },

  { type: 'ai_agent_completed', label: 'AI Agent Completed', description: 'When an AI agent finishes a task', category: 'ai' },
  { type: 'ai_agent_failed', label: 'AI Agent Failed', description: 'When an AI agent task fails', category: 'ai' },
  { type: 'meeting_processed', label: 'Meeting Processed', description: 'When a meeting transcription is ready', category: 'ai' },

  { type: 'webhook_received', label: 'Webhook Received', description: 'When an external webhook fires', category: 'custom' },
  { type: 'scheduled', label: 'Scheduled Trigger', description: 'Run on a time-based schedule', category: 'custom' },
  { type: 'manual_trigger', label: 'Manual Trigger', description: 'Manually enroll contacts', category: 'custom' },
];

export const ACTION_CATEGORIES = [
  { key: 'communication', label: 'Communication', icon: 'Send' },
  { key: 'contact_management', label: 'Contact Management', icon: 'Users' },
  { key: 'tasks', label: 'Tasks', icon: 'CheckSquare' },
  { key: 'opportunities', label: 'Opportunities', icon: 'TrendingUp' },
  { key: 'appointments', label: 'Appointments', icon: 'Calendar' },
  { key: 'payments', label: 'Payments', icon: 'CreditCard' },
  { key: 'marketing', label: 'Marketing', icon: 'Megaphone' },
  { key: 'proposals', label: 'Proposals', icon: 'FileText' },
  { key: 'projects', label: 'Projects', icon: 'FolderKanban' },
  { key: 'flow_control', label: 'Flow Control', icon: 'GitBranch' },
  { key: 'ai', label: 'AI Actions', icon: 'Sparkles' },
  { key: 'system', label: 'System', icon: 'Settings' },
] as const;

export type ActionCategoryKey = typeof ACTION_CATEGORIES[number]['key'];

export interface ActionOption {
  type: string;
  label: string;
  description: string;
  category: ActionCategoryKey;
  createsNodeType?: WorkflowNodeType;
}

export const ACTION_OPTIONS: ActionOption[] = [
  { type: 'send_sms', label: 'Send SMS', description: 'Send a text message to the contact', category: 'communication' },
  { type: 'send_email', label: 'Send Email', description: 'Send an email to the contact', category: 'communication' },
  { type: 'send_internal_sms', label: 'Internal SMS', description: 'Send SMS to a team member', category: 'communication' },
  { type: 'send_internal_email', label: 'Internal Email', description: 'Send email to a team member', category: 'communication' },
  { type: 'call_contact', label: 'Call Contact', description: 'Initiate a phone call', category: 'communication' },
  { type: 'voicemail_drop', label: 'Voicemail Drop', description: 'Leave a voicemail', category: 'communication' },
  { type: 'send_facebook_dm', label: 'Facebook DM', description: 'Send a Facebook direct message', category: 'communication' },
  { type: 'send_instagram_dm', label: 'Instagram DM', description: 'Send an Instagram direct message', category: 'communication' },

  { type: 'add_tag', label: 'Add Tag', description: 'Add a tag to the contact', category: 'contact_management' },
  { type: 'remove_tag', label: 'Remove Tag', description: 'Remove a tag from the contact', category: 'contact_management' },
  { type: 'update_contact_field', label: 'Update Contact Field', description: 'Update a contact property', category: 'contact_management' },
  { type: 'update_custom_field', label: 'Update Custom Field', description: 'Update a custom field value', category: 'contact_management' },
  { type: 'assign_contact_owner', label: 'Assign Owner', description: 'Assign a contact owner', category: 'contact_management' },
  { type: 'update_contact_status', label: 'Update Status', description: 'Change contact status', category: 'contact_management' },
  { type: 'add_to_campaign', label: 'Add to Campaign', description: 'Enroll in an email campaign', category: 'contact_management' },

  { type: 'create_task', label: 'Create Task', description: 'Create a new task', category: 'tasks' },
  { type: 'assign_task', label: 'Assign Task', description: 'Assign task to a team member', category: 'tasks' },
  { type: 'mark_task_complete', label: 'Complete Task', description: 'Mark a task as complete', category: 'tasks' },

  { type: 'create_opportunity', label: 'Create Opportunity', description: 'Create a new opportunity', category: 'opportunities' },
  { type: 'move_opportunity_stage', label: 'Move Stage', description: 'Move opportunity to a stage', category: 'opportunities' },
  { type: 'assign_opportunity_owner', label: 'Assign Owner', description: 'Assign opportunity owner', category: 'opportunities' },
  { type: 'mark_opportunity_won', label: 'Mark Won', description: 'Mark opportunity as won', category: 'opportunities' },
  { type: 'mark_opportunity_lost', label: 'Mark Lost', description: 'Mark opportunity as lost', category: 'opportunities' },

  { type: 'create_appointment', label: 'Create Appointment', description: 'Schedule an appointment', category: 'appointments' },
  { type: 'send_appointment_reminder', label: 'Send Reminder', description: 'Send appointment reminder', category: 'appointments' },
  { type: 'cancel_appointment', label: 'Cancel Appointment', description: 'Cancel an appointment', category: 'appointments' },

  { type: 'create_invoice', label: 'Create Invoice', description: 'Create a new invoice', category: 'payments' },
  { type: 'send_invoice', label: 'Send Invoice', description: 'Send invoice to contact', category: 'payments' },
  { type: 'send_review_request', label: 'Request Review', description: 'Send a review request', category: 'marketing' },
  { type: 'add_to_email_campaign', label: 'Add to Email Campaign', description: 'Add contact to email campaign', category: 'marketing' },

  { type: 'create_proposal', label: 'Create Proposal', description: 'Create a new proposal', category: 'proposals' },
  { type: 'send_proposal', label: 'Send Proposal', description: 'Send proposal to contact', category: 'proposals' },

  { type: 'create_project', label: 'Create Project', description: 'Create a new project', category: 'projects' },
  { type: 'update_project_stage', label: 'Update Project Stage', description: 'Move project to new stage', category: 'projects' },

  { type: 'if_else', label: 'If / Else', description: 'Branch based on conditions', category: 'flow_control', createsNodeType: 'condition' },
  { type: 'delay', label: 'Wait / Delay', description: 'Wait for a period of time', category: 'flow_control', createsNodeType: 'delay' },
  { type: 'wait_for_condition', label: 'Wait for Condition', description: 'Wait until a condition is met', category: 'flow_control', createsNodeType: 'delay' },
  { type: 'goal_check', label: 'Goal Event', description: 'Skip ahead when goal is met', category: 'flow_control', createsNodeType: 'goal' },
  { type: 'stop_workflow', label: 'End Workflow', description: 'Stop the workflow', category: 'flow_control', createsNodeType: 'end' },
  { type: 'trigger_another_workflow', label: 'Trigger Workflow', description: 'Start another workflow', category: 'flow_control' },
  { type: 'add_to_workflow', label: 'Add to Workflow', description: 'Enroll in another workflow', category: 'flow_control' },

  { type: 'ai_conversation_reply', label: 'AI Conversation Reply', description: 'Generate AI reply for conversation', category: 'ai' },
  { type: 'ai_email_draft', label: 'AI Email Draft', description: 'Draft an email with AI', category: 'ai' },
  { type: 'ai_lead_qualification', label: 'AI Lead Qualification', description: 'Qualify a lead with AI', category: 'ai' },
  { type: 'ai_decision_step', label: 'AI Decision', description: 'AI-powered branching decision', category: 'ai' },
  { type: 'generate_meeting_follow_up', label: 'Meeting Follow-up', description: 'Generate meeting follow-up with AI', category: 'ai' },

  { type: 'update_lead_score', label: 'Update Lead Score', description: 'Adjust the lead score', category: 'system' },
  { type: 'notify_user', label: 'Notify User', description: 'Send internal notification', category: 'system' },
  { type: 'webhook', label: 'Webhook', description: 'Send data to external URL', category: 'system' },
  { type: 'log_custom_event', label: 'Log Event', description: 'Log a custom event', category: 'system' },
  { type: 'set_dnd', label: 'Set DND', description: 'Enable Do Not Disturb', category: 'system' },
];

export function getNodeTypeForAction(actionType: string): WorkflowNodeType {
  const option = ACTION_OPTIONS.find(a => a.type === actionType);
  return option?.createsNodeType ?? 'action';
}

export function getDefaultNodeData(nodeType: WorkflowNodeType, actionType?: string): WorkflowNodeData {
  switch (nodeType) {
    case 'trigger':
      return { triggerType: 'manual_trigger', triggerCategory: 'event' } as TriggerNodeData;
    case 'condition':
      return { conditions: { logic: 'and', rules: [] } } as ConditionNodeData;
    case 'delay':
      return { delayType: 'wait_duration', duration: { value: 1, unit: 'hours' } } as DelayNodeData;
    case 'goal':
      return { goalCondition: { logic: 'and', rules: [] }, continueOnMet: true } as GoalNodeData;
    case 'action':
      return { actionType: actionType ?? 'add_tag', config: {} } as unknown as ActionNodeData;
    case 'end':
      return { label: 'End' } as EndNodeData;
  }
}

export function getDefaultLabel(nodeType: WorkflowNodeType, actionType?: string): string {
  if (nodeType === 'trigger') return 'New Trigger';
  if (nodeType === 'condition') return 'If / Else';
  if (nodeType === 'delay') {
    if (actionType === 'wait_for_condition') return 'Wait for Condition';
    return 'Wait / Delay';
  }
  if (nodeType === 'goal') return 'Goal Event';
  if (nodeType === 'end') return 'End';
  const option = ACTION_OPTIONS.find(a => a.type === actionType);
  return option?.label ?? 'Action';
}
