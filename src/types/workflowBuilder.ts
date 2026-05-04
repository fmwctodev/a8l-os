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
  /** Auto-remove a contact from this workflow as soon as they reply on any channel after enrollment. */
  stopOnResponse?: boolean;
  /** Workflow-level drip throttle: cap how many contacts can pass through ANY node per window. */
  dripBatchSize?: number;
  /** Window length for the drip throttle, in minutes. */
  dripIntervalMinutes?: number;
}

export const TRIGGER_CATEGORIES = [
  { key: 'contact', label: 'Contact', icon: 'User' },
  { key: 'events', label: 'Events', icon: 'Zap' },
  { key: 'appointments', label: 'Appointments', icon: 'Calendar' },
  { key: 'opportunities', label: 'Opportunities', icon: 'TrendingUp' },
  { key: 'conversations', label: 'Conversations', icon: 'MessageSquare' },
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
  { type: 'contact_created', label: 'Contact Created', description: 'When a new contact is created in CRM', category: 'contact' },
  { type: 'contact_changed', label: 'Contact Changed', description: 'When selected contact fields change', category: 'contact' },
  { type: 'contact_updated', label: 'Contact Updated', description: 'When contact details change', category: 'contact' },
  { type: 'contact_tag_changed', label: 'Contact Tag', description: 'When a tag is added or removed from a contact', category: 'contact' },
  { type: 'contact_tag_added', label: 'Tag Added', description: 'When a tag is added to a contact', category: 'contact' },
  { type: 'contact_tag_removed', label: 'Tag Removed', description: 'When a tag is removed from a contact', category: 'contact' },
  { type: 'contact_dnd_changed', label: 'Contact DND', description: 'When Do Not Disturb is turned on or off', category: 'contact' },
  { type: 'contact_custom_date_reminder', label: 'Custom Date Reminder', description: 'Fires before, on, or after a custom date field', category: 'contact' },
  { type: 'contact_note_added', label: 'Note Added', description: 'When a new note is added to a contact', category: 'contact' },
  { type: 'contact_note_changed', label: 'Note Changed', description: 'When an existing contact note is edited', category: 'contact' },
  { type: 'contact_task_added', label: 'Task Added', description: 'When a task is created for a contact', category: 'contact' },
  { type: 'contact_task_reminder', label: 'Task Reminder', description: 'When a task reminder time is reached', category: 'contact' },
  { type: 'contact_task_completed', label: 'Task Completed', description: 'When a task linked to a contact is completed', category: 'contact' },
  { type: 'contact_engagement_score', label: 'Engagement Score', description: 'When engagement score meets a threshold rule', category: 'contact' },
  { type: 'contact_owner_changed', label: 'Owner Changed', description: 'When contact owner is reassigned', category: 'contact' },
  { type: 'contact_status_changed', label: 'Status Changed', description: 'When contact status changes', category: 'contact' },

  { type: 'event_scheduler', label: 'Scheduler', description: 'Fire on a time-based schedule without a contact', category: 'events' },
  { type: 'event_call_details', label: 'Call Details', description: 'When a call log matches selected details', category: 'events' },
  { type: 'event_email', label: 'Email Events', description: 'On email delivered, opened, clicked, bounced, or unsubscribe', category: 'events' },
  { type: 'event_customer_replied', label: 'Customer Replied', description: 'When a contact replies on any connected channel', category: 'events' },
  { type: 'event_conversation_ai', label: 'Conversation AI', description: 'When a Conversation AI event occurs', category: 'events' },
  { type: 'event_custom', label: 'Custom Trigger', description: 'Fires from a custom event emitted by system or integration', category: 'events' },
  { type: 'event_form_submitted', label: 'Form Submitted', description: 'When a selected form is submitted', category: 'events' },
  { type: 'event_survey_submitted', label: 'Survey Submitted', description: 'When a selected survey is submitted', category: 'events' },
  { type: 'event_review_received', label: 'New Review Received', description: 'When a new review arrives', category: 'events' },
  { type: 'event_prospect_generated', label: 'Prospect Generated', description: 'When a new prospect record is created', category: 'events' },

  { type: 'appointment_status_changed', label: 'Appointment Status', description: 'When appointment status changes (booked, cancelled, etc.)', category: 'appointments' },
  { type: 'appointment_customer_booked', label: 'Customer Booked Appointment', description: 'When a customer books an appointment', category: 'appointments' },
  { type: 'appointment_booked', label: 'Appointment Booked', description: 'When an appointment is booked', category: 'appointments' },
  { type: 'appointment_confirmed', label: 'Appointment Confirmed', description: 'When an appointment is confirmed', category: 'appointments' },
  { type: 'appointment_rescheduled', label: 'Appointment Rescheduled', description: 'When an appointment is rescheduled', category: 'appointments' },
  { type: 'appointment_canceled', label: 'Appointment Canceled', description: 'When an appointment is canceled', category: 'appointments' },
  { type: 'appointment_completed', label: 'Appointment Completed', description: 'When an appointment is marked complete', category: 'appointments' },
  { type: 'appointment_no_show', label: 'No Show', description: 'When a contact does not show up', category: 'appointments' },

  { type: 'opportunity_status_changed', label: 'Opportunity Status Changed', description: 'When opportunity status changes (open, won, lost)', category: 'opportunities' },
  { type: 'opportunity_created', label: 'Opportunity Created', description: 'When a new opportunity is created', category: 'opportunities' },
  { type: 'opportunity_changed', label: 'Opportunity Changed', description: 'When selected opportunity fields change', category: 'opportunities' },
  { type: 'opportunity_stage_changed', label: 'Pipeline Stage Changed', description: 'When an opportunity moves stages', category: 'opportunities' },
  { type: 'opportunity_stale', label: 'Stale Opportunities', description: 'When opportunity meets inactivity threshold', category: 'opportunities' },
  { type: 'opportunity_won', label: 'Opportunity Won', description: 'When an opportunity is marked won', category: 'opportunities' },
  { type: 'opportunity_lost', label: 'Opportunity Lost', description: 'When an opportunity is marked lost', category: 'opportunities' },
  { type: 'opportunity_value_changed', label: 'Value Changed', description: 'When the monetary value changes', category: 'opportunities' },

  { type: 'conversation_message_received', label: 'Message Received', description: 'When a new message arrives in a conversation', category: 'conversations' },
  { type: 'conversation_status_changed', label: 'Conversation Status Changed', description: 'When conversation status changes', category: 'conversations' },
  { type: 'conversation_assigned', label: 'Conversation Assigned', description: 'When a conversation is assigned to a user', category: 'conversations' },
  { type: 'message_received', label: 'Inbound Message', description: 'When any inbound message is received', category: 'communication' },
  { type: 'message_sent', label: 'Message Sent', description: 'When a message is sent', category: 'communication' },

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

  // Tier 2 — call / IVR
  { type: 'missed_call', label: 'Missed Call', description: 'When an inbound call is missed (text-back trigger)', category: 'communication' },
  { type: 'inbound_call', label: 'Inbound Call', description: 'When an inbound call is received', category: 'communication' },
  { type: 'call_completed', label: 'Call Completed', description: 'When a call ends (status = completed)', category: 'communication' },

  // Tier 2 — date reminders
  { type: 'birthday_reminder', label: 'Birthday Reminder', description: "Fires on the contact's birthday (or N days before/after)", category: 'contact' },
  { type: 'custom_date_reminder', label: 'Custom Date Reminder', description: 'Fires before, on, or after any custom date field', category: 'contact' },

  // Tier 2 — ecommerce
  { type: 'abandoned_cart', label: 'Abandoned Cart', description: 'When a cart sits inactive past the threshold', category: 'payments' },
  { type: 'abandoned_checkout', label: 'Abandoned Checkout', description: 'When a checkout is started but not completed', category: 'payments' },
  { type: 'ecom_order_placed', label: 'Order Placed', description: 'When an ecommerce order is placed', category: 'payments' },
  { type: 'ecom_order_fulfilled', label: 'Order Fulfilled', description: 'When an order is fulfilled', category: 'payments' },
  { type: 'subscription_started', label: 'Subscription Started', description: 'When a recurring subscription starts', category: 'payments' },
  { type: 'subscription_cancelled', label: 'Subscription Cancelled', description: 'When a subscription is cancelled', category: 'payments' },
  { type: 'subscription_payment_failed', label: 'Subscription Payment Failed', description: 'When a recurring charge fails', category: 'payments' },
  { type: 'refund_issued', label: 'Refund Issued', description: 'When a refund is processed', category: 'payments' },
  { type: 'estimate_sent', label: 'Estimate Sent', description: 'When an estimate is sent to a contact', category: 'payments' },
  { type: 'estimate_accepted', label: 'Estimate Accepted', description: 'When an estimate is accepted', category: 'payments' },
  { type: 'contract_signed', label: 'Contract Signed', description: 'When a contract is signed', category: 'payments' },
  { type: 'coupon_redeemed', label: 'Coupon Redeemed', description: 'When a coupon is used at checkout', category: 'payments' },
  { type: 'product_review_submitted', label: 'Product Review Submitted', description: 'When a buyer submits a product review', category: 'reputation' },

  // Tier 2 — social / ads
  { type: 'social_facebook_lead', label: 'Facebook Lead Form', description: 'When a Facebook Lead Ad form is submitted', category: 'marketing' },
  { type: 'social_google_lead', label: 'Google Lead Form', description: 'When a Google Lead Form is submitted', category: 'marketing' },
  { type: 'social_linkedin_lead', label: 'LinkedIn Lead Form', description: 'When a LinkedIn Lead Gen form is submitted', category: 'marketing' },
  { type: 'social_tiktok_lead', label: 'TikTok Lead Form', description: 'When a TikTok Lead Generation form is submitted', category: 'marketing' },
  { type: 'social_facebook_comment', label: 'Facebook Comment', description: 'When a comment is posted on your Facebook page', category: 'marketing' },
  { type: 'social_instagram_comment', label: 'Instagram Comment', description: 'When a comment is posted on your Instagram', category: 'marketing' },
  { type: 'social_tiktok_comment', label: 'TikTok Comment', description: 'When a comment is posted on your TikTok', category: 'marketing' },
  { type: 'click_to_whatsapp', label: 'Click-to-WhatsApp Ad', description: 'When a click-to-WhatsApp ad starts a conversation', category: 'marketing' },
  { type: 'fb_conversion_event', label: 'Facebook Conversion Event', description: 'When a Facebook Conversion API event fires', category: 'marketing' },

  // Tier 2 — tracking
  { type: 'trigger_link_clicked', label: 'Trigger Link Clicked', description: 'When a contact clicks a tracked trigger link', category: 'events' },
  { type: 'funnel_page_visited', label: 'Funnel Page Visited', description: 'When a tracked funnel page is visited', category: 'events' },
  { type: 'website_page_visited', label: 'Website Page Visited', description: 'When a tracked website page is visited', category: 'events' },
  { type: 'video_tracking_event', label: 'Video Tracking', description: 'When a tracked video reaches a milestone', category: 'events' },
  { type: 'external_tracking_event', label: 'External Tracking', description: 'When an external tracking pixel fires', category: 'events' },

  // Tier 2 — error / messaging
  { type: 'messaging_error', label: 'Messaging Error', description: 'When an SMS or email fails to deliver', category: 'communication' },
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
  { type: 'send_email', label: 'Send Email', description: 'Send an email to the contact', category: 'communication' },
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

  // New GHL-Style Contact Actions
  { type: 'create_contact', label: 'Create Contact', description: 'Create a new contact record', category: 'contact_management' },
  { type: 'find_contact', label: 'Find Contact', description: 'Lookup a contact by field value', category: 'contact_management' },
  { type: 'copy_contact', label: 'Copy Contact', description: 'Duplicate a contact with selected fields', category: 'contact_management' },
  { type: 'delete_contact', label: 'Delete Contact', description: 'Remove a contact from the system', category: 'contact_management' },
  { type: 'modify_engagement_score', label: 'Modify Engagement Score', description: 'Set, increase, or decrease engagement score', category: 'contact_management' },
  { type: 'modify_followers', label: 'Modify Followers', description: 'Add or remove contact followers', category: 'contact_management' },
  { type: 'add_note', label: 'Add Note', description: 'Add a note to the contact record', category: 'contact_management' },
  { type: 'edit_conversation', label: 'Edit Conversation', description: 'Update conversation status or read state', category: 'contact_management' },

  // New GHL-Style Communication Actions
  { type: 'send_slack_message', label: 'Send Slack Message', description: 'Send a message to a Slack channel or user', category: 'communication' },
  { type: 'send_messenger', label: 'Send Messenger', description: 'Send a message via Facebook/Instagram/WhatsApp', category: 'communication' },
  { type: 'send_gmb_message', label: 'Send GMB Message', description: 'Send a Google Business Profile message', category: 'communication' },
  { type: 'send_internal_notification', label: 'Send Internal Notification', description: 'Notify team members via multiple channels', category: 'communication' },
  { type: 'conversation_ai_reply', label: 'Conversation AI Reply', description: 'Use AI agent to draft or auto-reply', category: 'ai' },
  { type: 'facebook_interactive_messenger', label: 'Facebook Interactive', description: 'Send an interactive Facebook Messenger message', category: 'communication' },
  { type: 'instagram_interactive_messenger', label: 'Instagram Interactive', description: 'Send an interactive Instagram message', category: 'communication' },
  { type: 'reply_in_comments', label: 'Reply in Comments', description: 'Reply to a social media comment', category: 'communication' },
  { type: 'send_live_chat_message', label: 'Send Live Chat', description: 'Send a message in a live chat widget', category: 'communication' },

  // Internal / Logic Actions
  { type: 'manual_action', label: 'Manual Action', description: 'Pause and assign a manual task', category: 'system' },
  { type: 'split_test', label: 'A/B Split Test', description: 'Randomly split contacts into test variants', category: 'flow_control' },
  { type: 'go_to', label: 'Go To', description: 'Jump to a specific node or workflow', category: 'flow_control' },
  { type: 'remove_from_workflow_action', label: 'Remove from Workflow', description: 'Remove contact from workflows', category: 'flow_control' },
  { type: 'drip_mode', label: 'Drip Mode', description: 'Schedule contacts in timed batches', category: 'flow_control' },

  // Data Actions
  { type: 'update_custom_value', label: 'Update Custom Value', description: 'Set or modify a custom value field', category: 'system' },
  { type: 'array_operation', label: 'Array Operation', description: 'Manipulate array data in workflow context', category: 'system' },
  { type: 'text_formatter', label: 'Text Formatter', description: 'Transform text with formatting operations', category: 'system' },

  // AI Actions
  { type: 'ai_prompt', label: 'AI Prompt', description: 'Run a custom AI prompt and capture the output', category: 'ai' },

  // Extended Appointment Actions
  { type: 'update_appointment_status', label: 'Update Appointment Status', description: 'Change the status of an appointment', category: 'appointments' },
  { type: 'generate_booking_link', label: 'Generate Booking Link', description: 'Create a one-time booking link', category: 'appointments' },

  // Extended Opportunity Actions
  { type: 'create_or_update_opportunity', label: 'Create/Update Opportunity', description: 'Create or update an opportunity', category: 'opportunities' },
  { type: 'remove_opportunity', label: 'Remove Opportunity', description: 'Archive or delete an opportunity', category: 'opportunities' },

  // Extended Payment Actions
  { type: 'send_documents_and_contracts', label: 'Send Documents & Contracts', description: 'Send a document or contract for signing', category: 'payments' },

  // Tier 3 — Manual queue actions (assigned to a user; appear in their task queue)
  { type: 'manual_call', label: 'Manual Call', description: 'Add a call task to the assigned user’s queue', category: 'communication' },
  { type: 'manual_sms', label: 'Manual SMS', description: 'Queue an SMS for a user to send manually', category: 'communication' },
  { type: 'manual_email', label: 'Manual Email', description: 'Queue an email for a user to send manually', category: 'communication' },

  // Tier 3 — Course / Community access
  { type: 'grant_course_access', label: 'Grant Course Access', description: 'Grant a contact access to a course offer', category: 'system' },
  { type: 'revoke_course_access', label: 'Revoke Course Access', description: 'Remove a contact’s course access', category: 'system' },
  { type: 'grant_community_access', label: 'Grant Community Access', description: 'Add a contact to a paid community / group', category: 'system' },
  { type: 'revoke_community_access', label: 'Revoke Community Access', description: 'Remove a contact from a community / group', category: 'system' },

  // Tier 3 — Marketing audiences
  { type: 'add_to_facebook_audience', label: 'Add to Facebook Audience', description: 'Add to a Facebook Custom Audience', category: 'marketing' },
  { type: 'remove_from_facebook_audience', label: 'Remove from Facebook Audience', description: 'Remove from a Facebook Custom Audience', category: 'marketing' },
  { type: 'send_facebook_conversion', label: 'Facebook Conversion API', description: 'Send a conversion event to Facebook CAPI', category: 'marketing' },
  { type: 'send_google_ads_event', label: 'Google Ads Event', description: 'Send a conversion event to Google Ads', category: 'marketing' },
  { type: 'send_google_analytics_event', label: 'Google Analytics Event', description: 'Send an event to Google Analytics', category: 'marketing' },
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
