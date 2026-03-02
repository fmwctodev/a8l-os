export type WorkflowActionType =
  // Communication Actions
  | 'send_sms'
  | 'send_email'
  | 'send_internal_sms'
  | 'send_internal_email'
  | 'call_contact'
  | 'voicemail_drop'
  | 'send_webchat_message'
  | 'send_facebook_dm'
  | 'send_instagram_dm'
  // Contact Management Actions
  | 'add_tag'
  | 'remove_tag'
  | 'add_contact_to_list'
  | 'remove_contact_from_list'
  | 'update_contact_field'
  | 'update_custom_field'
  | 'update_contact_status'
  | 'assign_contact_owner'
  | 'remove_contact_owner'
  | 'add_to_campaign'
  | 'remove_from_campaign'
  // Task Actions
  | 'create_task'
  | 'assign_task'
  | 'mark_task_complete'
  // Opportunity Actions
  | 'create_opportunity'
  | 'update_opportunity'
  | 'move_opportunity_stage'
  | 'assign_opportunity_owner'
  | 'mark_opportunity_won'
  | 'mark_opportunity_lost'
  | 'set_lost_reason'
  // Appointment Actions
  | 'create_appointment'
  | 'cancel_appointment'
  | 'reschedule_appointment'
  | 'confirm_appointment'
  | 'send_appointment_reminder'
  | 'mark_no_show'
  // Payment Actions
  | 'create_invoice'
  | 'send_invoice'
  | 'void_invoice'
  | 'apply_discount'
  | 'create_subscription'
  | 'pause_subscription'
  | 'cancel_subscription'
  | 'resume_subscription'
  // Marketing and Reputation Actions
  | 'send_review_request'
  | 'add_to_review_campaign'
  | 'add_to_email_campaign'
  | 'remove_from_email_campaign'
  | 'reply_to_review'
  | 'generate_ai_review_reply'
  | 'flag_review_spam'
  | 'hide_review'
  | 'create_review_followup_task'
  // Flow Control Actions
  | 'delay'
  | 'wait_for_condition'
  | 'if_else'
  | 'go_to_step'
  | 'repeat_until'
  | 'stop_workflow'
  | 'trigger_another_workflow'
  | 'add_to_workflow'
  | 'remove_from_workflow'
  | 'set_workflow_variable'
  // System Actions
  | 'update_lead_score'
  | 'set_dnd'
  | 'remove_dnd'
  | 'notify_user'
  | 'log_custom_event'
  | 'webhook'
  // Meeting Actions
  | 'generate_meeting_follow_up';

export type ActionCategory =
  | 'communication'
  | 'contact_management'
  | 'tasks'
  | 'opportunities'
  | 'appointments'
  | 'payments'
  | 'marketing'
  | 'flow_control'
  | 'ai'
  | 'system';

export type RecipientType = 'contact' | 'user_id' | 'role' | 'team' | 'contact_owner';
export type AssigneeType = 'contact_owner' | 'specific_user' | 'round_robin' | 'least_busy';
export type DueType = 'relative' | 'absolute';
export type OpportunitySource = 'most_recent' | 'specific_id' | 'context';
export type AppointmentSource = 'most_recent' | 'specific_id' | 'context';
export type InvoiceSource = 'most_recent' | 'specific_id' | 'context';
export type SubscriptionSource = 'most_recent' | 'specific_id' | 'context';
export type DiscountType = 'flat' | 'percentage';
export type DNDChannel = 'sms' | 'email' | 'calls' | 'all';
export type DNDDuration = 'permanent' | 'temporary';
export type NotifyChannel = 'in_app' | 'email' | 'sms';
export type FallbackBehavior = 'skip' | 'stop' | 'notify';

export interface SendSmsConfig {
  message: string;
  fromNumberId?: string;
  mediaUrls?: string[];
  trackLinks?: boolean;
}

export interface SendEmailConfig {
  subject: string;
  body: string;
  fromAddressId?: string;
  replyTo?: string;
  templateId?: string;
  attachments?: string[];
  trackOpens?: boolean;
  trackClicks?: boolean;
}

export interface SendInternalSmsConfig {
  recipientType: RecipientType;
  recipientIds?: string[];
  roleNames?: string[];
  message: string;
  includeContactInfo: boolean;
  includeOpportunityInfo?: boolean;
}

export interface SendInternalEmailConfig {
  recipientType: RecipientType;
  recipientIds?: string[];
  roleNames?: string[];
  subject: string;
  body: string;
  attachments?: string[];
  trackOpens?: boolean;
}

export interface VoiceActionConfig {
  callScript?: string;
  mediaUrl?: string;
  assignedNumberId?: string;
  retryOnBusy?: boolean;
  maxRetries?: number;
  recordCall?: boolean;
}

export interface VoicemailDropConfig {
  mediaUrl: string;
  fromNumberId?: string;
}

export interface WebchatMessageConfig {
  message: string;
  senderName?: string;
  showTypingIndicator?: boolean;
}

export interface SocialDMConfig {
  message: string;
  accountId: string;
  mediaUrls?: string[];
}

export interface TagActionConfig {
  tagIds: string[];
  tagNames?: string[];
}

export interface ListActionConfig {
  listId: string;
  listName?: string;
}

export interface UpdateContactFieldConfig {
  fieldName: string;
  value: string;
  valueType: 'static' | 'merge_field' | 'expression';
}

export interface UpdateCustomFieldConfig {
  fieldId: string;
  fieldKey: string;
  value: string;
  valueType: 'static' | 'merge_field' | 'expression';
}

export interface UpdateContactStatusConfig {
  status: 'active' | 'inactive' | 'do_not_contact';
  reason?: string;
}

export interface AssignContactOwnerConfig {
  assigneeType: AssigneeType;
  assigneeId?: string;
  teamId?: string;
  notifyOwner?: boolean;
}

export interface CampaignConfig {
  campaignId: string;
  campaignName?: string;
  skipIfAlreadyEnrolled?: boolean;
}

export interface CreateTaskConfig {
  title: string;
  description?: string;
  dueType: DueType;
  dueDays?: number;
  dueDate?: string;
  dueTime?: string;
  assigneeType: AssigneeType;
  assigneeId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  linkedToOpportunity?: boolean;
  linkedToContact?: boolean;
  reminderMinutes?: number;
}

export interface AssignTaskConfig {
  taskSource: 'most_recent' | 'specific_id';
  taskId?: string;
  assigneeType: AssigneeType;
  assigneeId?: string;
}

export interface MarkTaskCompleteConfig {
  taskSource: 'most_recent' | 'specific_id';
  taskId?: string;
  completionNotes?: string;
}

export interface CreateOpportunityConfig {
  pipelineId: string;
  stageId: string;
  name?: string;
  nameTemplate?: string;
  value?: number;
  valueFromField?: string;
  currency?: string;
  source?: string;
  closeDate?: string;
  closeDateDays?: number;
  assigneeType: AssigneeType;
  assigneeId?: string;
  customFields?: Record<string, unknown>;
}

export interface UpdateOpportunityConfig {
  opportunitySource: OpportunitySource;
  opportunityId?: string;
  updates: {
    name?: string;
    value?: number;
    source?: string;
    closeDate?: string;
    customFields?: Record<string, unknown>;
  };
}

export interface MoveStageConfig {
  opportunitySource: OpportunitySource;
  opportunityId?: string;
  targetStageId: string;
  validateSequence?: boolean;
  createTimelineEvent?: boolean;
}

export interface AssignOpportunityOwnerConfig {
  opportunitySource: OpportunitySource;
  opportunityId?: string;
  ownerType: 'specific' | 'contact_owner' | 'round_robin';
  ownerId?: string;
  teamId?: string;
  notifyOwner?: boolean;
}

export interface MarkWonConfig {
  opportunitySource: OpportunitySource;
  opportunityId?: string;
  closeDate?: string;
  notes?: string;
  createTimelineEvent?: boolean;
}

export interface MarkLostConfig {
  opportunitySource: OpportunitySource;
  opportunityId?: string;
  lostReasonId?: string;
  lostReasonText?: string;
  closeDate?: string;
  notes?: string;
  createTimelineEvent?: boolean;
}

export interface CreateAppointmentConfig {
  calendarId: string;
  appointmentTypeId: string;
  startTimeType: 'relative' | 'absolute' | 'next_available';
  startTimeDays?: number;
  startTimeHour?: number;
  startDate?: string;
  startTime?: string;
  duration?: number;
  assigneeType: AssigneeType;
  assigneeId?: string;
  notes?: string;
  sendConfirmation?: boolean;
  generateGoogleMeet?: boolean;
}

export interface CancelAppointmentConfig {
  appointmentSource: AppointmentSource;
  appointmentId?: string;
  reason?: string;
  notifyContact?: boolean;
  notifyAssignee?: boolean;
}

export interface RescheduleAppointmentConfig {
  appointmentSource: AppointmentSource;
  appointmentId?: string;
  newStartTimeType: 'relative' | 'absolute' | 'next_available';
  newStartTimeDays?: number;
  newStartDate?: string;
  newStartTime?: string;
  reason?: string;
  notifyContact?: boolean;
}

export interface ConfirmAppointmentConfig {
  appointmentSource: AppointmentSource;
  appointmentId?: string;
  confirmationChannel?: 'email' | 'sms' | 'both';
  templateId?: string;
}

export interface SendReminderConfig {
  appointmentSource: AppointmentSource;
  appointmentId?: string;
  reminderType: 'email' | 'sms' | 'both';
  templateId?: string;
  customMessage?: string;
}

export interface MarkNoShowConfig {
  appointmentSource: AppointmentSource;
  appointmentId?: string;
  reason?: string;
  createFollowUpTask?: boolean;
}

export interface InvoiceLineItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceConfig {
  lineItems: InvoiceLineItem[];
  dueType: DueType;
  dueDays?: number;
  dueDate?: string;
  memo?: string;
  internalNotes?: string;
  linkedOpportunitySource?: OpportunitySource;
  linkedOpportunityId?: string;
  syncToQBO?: boolean;
  autoSend?: boolean;
}

export interface SendInvoiceConfig {
  invoiceSource: InvoiceSource;
  invoiceId?: string;
  emailSubject?: string;
  emailBody?: string;
  includePaymentLink?: boolean;
  ccEmails?: string[];
}

export interface VoidInvoiceConfig {
  invoiceSource: InvoiceSource;
  invoiceId?: string;
  reason?: string;
  syncToQBO?: boolean;
  notifyContact?: boolean;
}

export interface ApplyDiscountConfig {
  invoiceSource: InvoiceSource;
  invoiceId?: string;
  discountType: DiscountType;
  discountValue: number;
  reason?: string;
}

export interface CreateSubscriptionConfig {
  profileName: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  lineItems: InvoiceLineItem[];
  autoSend: boolean;
  startDate?: string;
  endDate?: string;
  syncToQBO?: boolean;
}

export interface ManageSubscriptionConfig {
  subscriptionSource: SubscriptionSource;
  subscriptionId?: string;
  action: 'pause' | 'resume' | 'cancel';
  reason?: string;
  pauseUntil?: string;
  syncToQBO?: boolean;
}

export interface SendReviewRequestConfig {
  platform: 'google' | 'facebook' | 'trustpilot' | 'custom';
  templateId?: string;
  channel: 'email' | 'sms' | 'both';
  customMessage?: string;
  customUrl?: string;
  delayMinutes?: number;
}

export interface ReviewCampaignConfig {
  campaignId: string;
  campaignName?: string;
}

export interface ReplyToReviewConfig {
  reviewSource: 'context' | 'most_recent' | 'specific_id';
  reviewId?: string;
  replyText: string;
  postToProvider?: boolean;
}

export interface GenerateAIReviewReplyConfig {
  reviewSource: 'context' | 'most_recent' | 'specific_id';
  reviewId?: string;
  tone?: 'professional' | 'friendly' | 'apologetic' | 'casual';
  autoPost?: boolean;
  requireApproval?: boolean;
  notifyUserIds?: string[];
}

export interface FlagReviewSpamConfig {
  reviewSource: 'context' | 'most_recent' | 'specific_id';
  reviewId?: string;
  reason?: string;
}

export interface HideReviewConfig {
  reviewSource: 'context' | 'most_recent' | 'specific_id';
  reviewId?: string;
  reason?: string;
}

export interface CreateReviewFollowupTaskConfig {
  reviewSource: 'context' | 'most_recent' | 'specific_id';
  reviewId?: string;
  title?: string;
  description?: string;
  assigneeType: AssigneeType;
  assigneeId?: string;
  dueHours: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface EmailCampaignConfig {
  campaignId: string;
  campaignName?: string;
  skipIfAlreadyEnrolled?: boolean;
  enrollAtStep?: number;
}

export interface DelayConfig {
  delayType: 'fixed' | 'until_time' | 'until_day';
  delayValue?: number;
  delayUnit?: 'minutes' | 'hours' | 'days' | 'weeks';
  untilTime?: string;
  untilDay?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  timezone?: string;
}

export interface ConditionOperator {
  type:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'regex_matches'
    | 'is_empty'
    | 'is_not_empty'
    | 'greater_than'
    | 'less_than'
    | 'greater_than_or_equal'
    | 'less_than_or_equal'
    | 'date_before'
    | 'date_after'
    | 'date_between'
    | 'date_within_last'
    | 'date_within_next'
    | 'has_tag'
    | 'not_has_tag'
    | 'in_list'
    | 'not_in_list'
    | 'has_activity_in_days'
    | 'opportunity_in_stage'
    | 'appointment_scheduled_within'
    | 'invoice_status_is';
}

export interface Condition {
  id: string;
  field: string;
  fieldType?: 'contact' | 'opportunity' | 'appointment' | 'invoice' | 'custom_field' | 'workflow_variable';
  operator: ConditionOperator['type'];
  value: unknown;
  secondaryValue?: unknown;
}

export interface ConditionGroup {
  id: string;
  logicalOperator: 'and' | 'or';
  conditions: Array<Condition | ConditionGroup>;
}

export interface WaitForConditionConfig {
  conditions: ConditionGroup;
  checkIntervalMinutes: number;
  timeoutDays?: number;
  timeoutBranch?: string;
}

export interface IfElseConfig {
  conditions: ConditionGroup;
  trueBranch: string;
  falseBranch: string;
}

export interface GoToStepConfig {
  targetNodeId: string;
  maxJumps?: number;
}

export interface RepeatUntilConfig {
  conditions: ConditionGroup;
  maxIterations: number;
  includeCurrentNode?: boolean;
  startNodeId?: string;
}

export interface StopWorkflowConfig {
  reason?: string;
  markAsCompleted?: boolean;
}

export interface TriggerWorkflowConfig {
  workflowId: string;
  workflowName?: string;
  passThroughContext?: boolean;
  contextMapping?: Record<string, string>;
  waitForCompletion?: boolean;
}

export interface WorkflowEnrollmentConfig {
  workflowId: string;
  workflowName?: string;
  action: 'add' | 'remove';
}

export interface SetVariableConfig {
  variableName: string;
  valueType: 'static' | 'merge_field' | 'expression';
  value: string;
}

export interface UpdateLeadScoreConfig {
  operation: 'set' | 'increment' | 'decrement';
  value: number;
  reason?: string;
  modelId?: string;
}

export interface DNDConfig {
  channels: DNDChannel[];
  reason?: string;
  duration: DNDDuration;
  endDate?: string;
}

export interface NotifyUserConfig {
  recipientType: RecipientType;
  recipientIds?: string[];
  roleNames?: string[];
  channels: NotifyChannel[];
  subject?: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  includeContactLink?: boolean;
}

export interface LogEventConfig {
  eventName: string;
  eventData?: Record<string, unknown>;
  logToTimeline?: boolean;
}

export interface WebhookConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  bodyTemplate?: string;
  includeContactData?: boolean;
  includeOpportunityData?: boolean;
  responseMapping?: Record<string, string>;
  timeoutSeconds?: number;
}

export interface GenerateMeetingFollowUpConfig {
  channel: 'sms' | 'email' | 'both';
  delayMinutes: number;
  autoSend: boolean;
  customInstructions?: string;
}

export type ActionConfig =
  | SendSmsConfig
  | SendEmailConfig
  | SendInternalSmsConfig
  | SendInternalEmailConfig
  | VoiceActionConfig
  | VoicemailDropConfig
  | WebchatMessageConfig
  | SocialDMConfig
  | TagActionConfig
  | ListActionConfig
  | UpdateContactFieldConfig
  | UpdateCustomFieldConfig
  | UpdateContactStatusConfig
  | AssignContactOwnerConfig
  | CampaignConfig
  | CreateTaskConfig
  | AssignTaskConfig
  | MarkTaskCompleteConfig
  | CreateOpportunityConfig
  | UpdateOpportunityConfig
  | MoveStageConfig
  | AssignOpportunityOwnerConfig
  | MarkWonConfig
  | MarkLostConfig
  | CreateAppointmentConfig
  | CancelAppointmentConfig
  | RescheduleAppointmentConfig
  | ConfirmAppointmentConfig
  | SendReminderConfig
  | MarkNoShowConfig
  | CreateInvoiceConfig
  | SendInvoiceConfig
  | VoidInvoiceConfig
  | ApplyDiscountConfig
  | CreateSubscriptionConfig
  | ManageSubscriptionConfig
  | SendReviewRequestConfig
  | ReviewCampaignConfig
  | EmailCampaignConfig
  | ReplyToReviewConfig
  | GenerateAIReviewReplyConfig
  | FlagReviewSpamConfig
  | HideReviewConfig
  | CreateReviewFollowupTaskConfig
  | DelayConfig
  | WaitForConditionConfig
  | IfElseConfig
  | GoToStepConfig
  | RepeatUntilConfig
  | StopWorkflowConfig
  | TriggerWorkflowConfig
  | WorkflowEnrollmentConfig
  | SetVariableConfig
  | UpdateLeadScoreConfig
  | DNDConfig
  | NotifyUserConfig
  | LogEventConfig
  | WebhookConfig
  | GenerateMeetingFollowUpConfig;

export interface WorkflowActionDefinition {
  type: WorkflowActionType;
  label: string;
  description: string;
  category: ActionCategory;
  icon: string;
  requiredPermission?: string;
  isPro?: boolean;
  configSchema?: Record<string, unknown>;
}

export const WORKFLOW_ACTION_DEFINITIONS: WorkflowActionDefinition[] = [
  // Communication Actions
  { type: 'send_sms', label: 'Send SMS', description: 'Send an SMS message to the contact', category: 'communication', icon: 'MessageSquare' },
  { type: 'send_email', label: 'Send Email', description: 'Send an email to the contact', category: 'communication', icon: 'Mail' },
  { type: 'send_internal_sms', label: 'Send Internal SMS', description: 'Send an SMS to team members', category: 'communication', icon: 'MessageCircle' },
  { type: 'send_internal_email', label: 'Send Internal Email', description: 'Send an email to team members', category: 'communication', icon: 'Send' },
  { type: 'call_contact', label: 'Call Contact', description: 'Initiate a phone call to the contact', category: 'communication', icon: 'Phone' },
  { type: 'voicemail_drop', label: 'Voicemail Drop', description: 'Drop a pre-recorded voicemail', category: 'communication', icon: 'Voicemail' },
  { type: 'send_webchat_message', label: 'Send Webchat Message', description: 'Send a message via webchat', category: 'communication', icon: 'MessagesSquare' },
  { type: 'send_facebook_dm', label: 'Send Facebook DM', description: 'Send a Facebook direct message', category: 'communication', icon: 'Facebook', isPro: true },
  { type: 'send_instagram_dm', label: 'Send Instagram DM', description: 'Send an Instagram direct message', category: 'communication', icon: 'Instagram', isPro: true },

  // Contact Management Actions
  { type: 'add_tag', label: 'Add Tag', description: 'Add one or more tags to the contact', category: 'contact_management', icon: 'Tag' },
  { type: 'remove_tag', label: 'Remove Tag', description: 'Remove tags from the contact', category: 'contact_management', icon: 'TagOff' },
  { type: 'add_contact_to_list', label: 'Add to List', description: 'Add contact to a static list', category: 'contact_management', icon: 'ListPlus' },
  { type: 'remove_contact_from_list', label: 'Remove from List', description: 'Remove contact from a static list', category: 'contact_management', icon: 'ListMinus' },
  { type: 'update_contact_field', label: 'Update Contact Field', description: 'Update a standard contact field', category: 'contact_management', icon: 'UserPen' },
  { type: 'update_custom_field', label: 'Update Custom Field', description: 'Update a custom field value', category: 'contact_management', icon: 'FileEdit' },
  { type: 'update_contact_status', label: 'Update Contact Status', description: 'Change contact status', category: 'contact_management', icon: 'UserCheck' },
  { type: 'assign_contact_owner', label: 'Assign Owner', description: 'Assign contact to a user', category: 'contact_management', icon: 'UserPlus' },
  { type: 'remove_contact_owner', label: 'Remove Owner', description: 'Remove assigned owner from contact', category: 'contact_management', icon: 'UserMinus' },
  { type: 'add_to_campaign', label: 'Add to Campaign', description: 'Enroll contact in a campaign', category: 'contact_management', icon: 'Megaphone' },
  { type: 'remove_from_campaign', label: 'Remove from Campaign', description: 'Remove contact from a campaign', category: 'contact_management', icon: 'MegaphoneOff' },

  // Task Actions
  { type: 'create_task', label: 'Create Task', description: 'Create a new task', category: 'tasks', icon: 'CheckSquare' },
  { type: 'assign_task', label: 'Assign Task', description: 'Assign a task to a user', category: 'tasks', icon: 'ClipboardCheck' },
  { type: 'mark_task_complete', label: 'Complete Task', description: 'Mark a task as completed', category: 'tasks', icon: 'CheckCheck' },

  // Opportunity Actions
  { type: 'create_opportunity', label: 'Create Opportunity', description: 'Create a new opportunity in a pipeline', category: 'opportunities', icon: 'CircleDollarSign' },
  { type: 'update_opportunity', label: 'Update Opportunity', description: 'Update opportunity details', category: 'opportunities', icon: 'Edit3' },
  { type: 'move_opportunity_stage', label: 'Move Stage', description: 'Move opportunity to a different stage', category: 'opportunities', icon: 'ArrowRightCircle' },
  { type: 'assign_opportunity_owner', label: 'Assign Opportunity Owner', description: 'Assign opportunity to a user', category: 'opportunities', icon: 'UserCog' },
  { type: 'mark_opportunity_won', label: 'Mark as Won', description: 'Mark opportunity as won', category: 'opportunities', icon: 'Trophy' },
  { type: 'mark_opportunity_lost', label: 'Mark as Lost', description: 'Mark opportunity as lost', category: 'opportunities', icon: 'XCircle' },
  { type: 'set_lost_reason', label: 'Set Lost Reason', description: 'Set the reason for a lost opportunity', category: 'opportunities', icon: 'FileQuestion' },

  // Appointment Actions
  { type: 'create_appointment', label: 'Create Appointment', description: 'Schedule a new appointment', category: 'appointments', icon: 'CalendarPlus' },
  { type: 'cancel_appointment', label: 'Cancel Appointment', description: 'Cancel an existing appointment', category: 'appointments', icon: 'CalendarX' },
  { type: 'reschedule_appointment', label: 'Reschedule Appointment', description: 'Reschedule an appointment', category: 'appointments', icon: 'CalendarClock' },
  { type: 'confirm_appointment', label: 'Confirm Appointment', description: 'Send appointment confirmation', category: 'appointments', icon: 'CalendarCheck' },
  { type: 'send_appointment_reminder', label: 'Send Reminder', description: 'Send an appointment reminder', category: 'appointments', icon: 'Bell' },
  { type: 'mark_no_show', label: 'Mark No-Show', description: 'Mark appointment as no-show', category: 'appointments', icon: 'UserX' },

  // Payment Actions
  { type: 'create_invoice', label: 'Create Invoice', description: 'Create a new invoice', category: 'payments', icon: 'FileText' },
  { type: 'send_invoice', label: 'Send Invoice', description: 'Send invoice to contact', category: 'payments', icon: 'SendHorizontal' },
  { type: 'void_invoice', label: 'Void Invoice', description: 'Void an existing invoice', category: 'payments', icon: 'FileX' },
  { type: 'apply_discount', label: 'Apply Discount', description: 'Apply a discount to an invoice', category: 'payments', icon: 'Percent' },
  { type: 'create_subscription', label: 'Create Subscription', description: 'Create a recurring billing profile', category: 'payments', icon: 'Repeat' },
  { type: 'pause_subscription', label: 'Pause Subscription', description: 'Pause a subscription', category: 'payments', icon: 'PauseCircle' },
  { type: 'cancel_subscription', label: 'Cancel Subscription', description: 'Cancel a subscription', category: 'payments', icon: 'XOctagon' },
  { type: 'resume_subscription', label: 'Resume Subscription', description: 'Resume a paused subscription', category: 'payments', icon: 'PlayCircle' },

  // Marketing and Reputation Actions
  { type: 'send_review_request', label: 'Send Review Request', description: 'Request a review from the contact', category: 'marketing', icon: 'Star' },
  { type: 'add_to_review_campaign', label: 'Add to Review Campaign', description: 'Add contact to a review campaign', category: 'marketing', icon: 'Stars' },
  { type: 'add_to_email_campaign', label: 'Add to Email Campaign', description: 'Enroll contact in an email campaign', category: 'marketing', icon: 'Mails' },
  { type: 'remove_from_email_campaign', label: 'Remove from Email Campaign', description: 'Remove contact from email campaign', category: 'marketing', icon: 'MailMinus' },
  { type: 'reply_to_review', label: 'Reply to Review', description: 'Post a reply to a review', category: 'marketing', icon: 'MessageSquareReply' },
  { type: 'generate_ai_review_reply', label: 'Generate AI Review Reply', description: 'Generate an AI-powered reply to a review', category: 'marketing', icon: 'Sparkles', isPro: true },
  { type: 'flag_review_spam', label: 'Flag Review as Spam', description: 'Mark a review as spam', category: 'marketing', icon: 'Flag' },
  { type: 'hide_review', label: 'Hide Review', description: 'Hide a review from public view', category: 'marketing', icon: 'EyeOff' },
  { type: 'create_review_followup_task', label: 'Create Review Follow-up Task', description: 'Create a task to follow up on a review', category: 'marketing', icon: 'ListTodo' },

  // Flow Control Actions
  { type: 'delay', label: 'Delay', description: 'Wait for a specified time', category: 'flow_control', icon: 'Clock' },
  { type: 'wait_for_condition', label: 'Wait for Condition', description: 'Wait until a condition is met', category: 'flow_control', icon: 'Timer' },
  { type: 'if_else', label: 'If/Else', description: 'Branch based on conditions', category: 'flow_control', icon: 'GitBranch' },
  { type: 'go_to_step', label: 'Go to Step', description: 'Jump to a specific workflow step', category: 'flow_control', icon: 'CornerDownRight' },
  { type: 'repeat_until', label: 'Repeat Until', description: 'Loop until condition is met', category: 'flow_control', icon: 'RefreshCw' },
  { type: 'stop_workflow', label: 'Stop Workflow', description: 'End the workflow execution', category: 'flow_control', icon: 'StopCircle' },
  { type: 'trigger_another_workflow', label: 'Trigger Workflow', description: 'Start another workflow', category: 'flow_control', icon: 'Workflow' },
  { type: 'add_to_workflow', label: 'Add to Workflow', description: 'Enroll contact in another workflow', category: 'flow_control', icon: 'LogIn' },
  { type: 'remove_from_workflow', label: 'Remove from Workflow', description: 'Remove contact from a workflow', category: 'flow_control', icon: 'LogOut' },
  { type: 'set_workflow_variable', label: 'Set Variable', description: 'Set a workflow variable', category: 'flow_control', icon: 'Variable' },

  // System Actions
  { type: 'update_lead_score', label: 'Update Lead Score', description: 'Modify the contact lead score', category: 'system', icon: 'TrendingUp' },
  { type: 'set_dnd', label: 'Set Do Not Disturb', description: 'Enable DND for contact', category: 'system', icon: 'BellOff' },
  { type: 'remove_dnd', label: 'Remove Do Not Disturb', description: 'Disable DND for contact', category: 'system', icon: 'BellRing' },
  { type: 'notify_user', label: 'Notify User', description: 'Send notification to a team member', category: 'system', icon: 'Bell' },
  { type: 'log_custom_event', label: 'Log Event', description: 'Log a custom event to timeline', category: 'system', icon: 'FileCode' },
  { type: 'webhook', label: 'Webhook', description: 'Send data to external URL', category: 'system', icon: 'Webhook' },

  // Meeting Actions
  { type: 'generate_meeting_follow_up', label: 'Generate Meeting Follow-Up', description: 'Generate and send AI follow-up messages after a meeting', category: 'ai', icon: 'Video' },
];

export const ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  communication: 'Communication',
  contact_management: 'Contact Management',
  tasks: 'Tasks',
  opportunities: 'Opportunities',
  appointments: 'Appointments',
  payments: 'Payments',
  marketing: 'Marketing & Reputation',
  flow_control: 'Flow Control',
  ai: 'AI Actions',
  system: 'System',
};

export const ACTION_CATEGORY_ICONS: Record<ActionCategory, string> = {
  communication: 'MessageSquare',
  contact_management: 'Users',
  tasks: 'CheckSquare',
  opportunities: 'CircleDollarSign',
  appointments: 'Calendar',
  payments: 'CreditCard',
  marketing: 'Megaphone',
  flow_control: 'GitBranch',
  ai: 'Sparkles',
  system: 'Settings',
};

export function getActionsByCategory(category: ActionCategory): WorkflowActionDefinition[] {
  return WORKFLOW_ACTION_DEFINITIONS.filter(action => action.category === category);
}

export function getActionDefinition(type: WorkflowActionType): WorkflowActionDefinition | undefined {
  return WORKFLOW_ACTION_DEFINITIONS.find(action => action.type === type);
}
