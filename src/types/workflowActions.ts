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
  // Proposal Actions
  | 'create_proposal'
  | 'send_proposal'
  // Project Actions
  | 'create_project'
  | 'update_project_stage'
  // Booking Actions
  | 'send_booking_link'
  // Goal Actions
  | 'goal_check'
  // Meeting Actions
  | 'generate_meeting_follow_up'
  // New GHL-Style Contact Actions
  | 'create_contact'
  | 'find_contact'
  | 'copy_contact'
  | 'delete_contact'
  | 'modify_engagement_score'
  | 'modify_followers'
  | 'add_note'
  | 'edit_conversation'
  // New GHL-Style Communication Actions
  | 'send_slack_message'
  | 'send_messenger'
  | 'send_gmb_message'
  | 'send_internal_notification'
  | 'conversation_ai_reply'
  | 'facebook_interactive_messenger'
  | 'instagram_interactive_messenger'
  | 'reply_in_comments'
  | 'send_live_chat_message'
  // Internal / Logic Actions
  | 'manual_action'
  | 'split_test'
  | 'go_to'
  | 'remove_from_workflow_action'
  | 'drip_mode'
  // Data Actions
  | 'update_custom_value'
  | 'array_operation'
  | 'text_formatter'
  // AI Actions
  | 'ai_prompt'
  // Extended Appointment Actions
  | 'update_appointment_status'
  | 'generate_booking_link'
  // Extended Opportunity Actions
  | 'create_or_update_opportunity'
  | 'remove_opportunity'
  // Extended Payment Actions
  | 'send_documents_and_contracts';

export type ActionCategory =
  | 'communication'
  | 'contact_management'
  | 'tasks'
  | 'opportunities'
  | 'appointments'
  | 'payments'
  | 'marketing'
  | 'proposals'
  | 'projects'
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

export interface CreateContactConfig {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  tags?: string[];
  assigneeType?: AssigneeType;
  assigneeId?: string;
  customFields?: Record<string, unknown>;
  duplicateRule?: 'skip' | 'update' | 'create_new';
}

export interface FindContactConfig {
  lookupField: 'email' | 'phone' | 'id' | 'custom_field';
  lookupValue: string;
  customFieldKey?: string;
  matchMode?: 'first' | 'last' | 'newest';
  fallbackBehavior?: FallbackBehavior;
  storeResultAs?: string;
}

export interface CopyContactConfig {
  fieldsToCopy: string[];
  newTags?: string[];
  assigneeType?: AssigneeType;
  assigneeId?: string;
  overwriteExisting?: boolean;
}

export interface DeleteContactConfig {
  mode: 'soft' | 'hard';
  requireApproval?: boolean;
  reason?: string;
}

export interface ModifyEngagementScoreConfig {
  operation: 'set' | 'increase' | 'decrease';
  value: number;
  floor?: number;
  ceiling?: number;
  modelId?: string;
  reason?: string;
}

export interface ModifyFollowersConfig {
  action: 'add' | 'remove';
  followerType: 'specific_user' | 'role' | 'contact_owner';
  userIds?: string[];
  roleNames?: string[];
}

export interface AddNoteConfig {
  content: string;
  visibility?: 'public' | 'private' | 'internal';
  prependTimestamp?: boolean;
}

export interface EditConversationConfig {
  operation: 'mark_read' | 'mark_unread' | 'archive' | 'close' | 'reopen';
  conversationSource?: 'current' | 'most_recent';
}

export interface SendSlackMessageConfig {
  channelType: 'channel' | 'webhook' | 'user';
  channelId?: string;
  webhookUrl?: string;
  userId?: string;
  message: string;
  includeContactLink?: boolean;
  includeRecordLinks?: boolean;
}

export interface SendMessengerConfig {
  accountId: string;
  message: string;
  channel: 'facebook' | 'instagram' | 'whatsapp';
}

export interface SendGmbMessageConfig {
  accountId: string;
  message: string;
}

export interface SendInternalNotificationConfig {
  recipientType: RecipientType;
  recipientIds?: string[];
  roleNames?: string[];
  title: string;
  body: string;
  urgency?: 'low' | 'normal' | 'high' | 'urgent';
  channels: Array<'in_app' | 'email' | 'sms' | 'slack'>;
  includeContactLink?: boolean;
}

export interface ConversationAIReplyConfig {
  agentId: string;
  mode: 'draft' | 'auto_reply' | 'classify' | 'summarize';
  requireApproval?: boolean;
  outputField?: string;
}

export interface FacebookInteractiveConfig {
  accountId: string;
  responseText?: string;
  templateId?: string;
}

export interface InstagramInteractiveConfig {
  accountId: string;
  responseText?: string;
  templateId?: string;
}

export interface ReplyInCommentsConfig {
  platform: 'facebook' | 'instagram';
  accountId: string;
  replyText: string;
}

export interface SendLiveChatConfig {
  widgetId?: string;
  message: string;
  conversationTarget?: 'current' | 'most_recent';
}

export interface ManualActionConfig {
  instructionText: string;
  assigneeType: AssigneeType;
  assigneeId?: string;
  dueHours?: number;
  completionRule?: 'any_user' | 'assigned_user';
}

export interface SplitTestConfig {
  splitType: 'percentage' | 'random';
  variants: Array<{
    id: string;
    label: string;
    percentage: number;
  }>;
}

export interface GoToConfig {
  destinationType: 'node' | 'workflow';
  targetNodeId?: string;
  targetWorkflowId?: string;
  maxJumps?: number;
}

export interface RemoveFromWorkflowActionConfig {
  target: 'current' | 'selected';
  workflowIds?: string[];
}

export interface DripModeConfig {
  batchSize: number;
  intervalValue: number;
  intervalUnit: 'minutes' | 'hours' | 'days';
  queueOrdering: 'fifo' | 'lifo' | 'random';
  startTime?: string;
  endTime?: string;
}

export interface UpdateCustomValueConfig {
  customValueId: string;
  customValueKey?: string;
  operation: 'set' | 'append' | 'replace_token';
  value: string;
  token?: string;
}

export interface ArrayOperationConfig {
  inputSource: 'variable' | 'custom_field';
  inputKey: string;
  operation: 'create' | 'append' | 'remove' | 'sort' | 'dedupe' | 'iterate' | 'contains' | 'join';
  operandValue?: string;
  sortDirection?: 'asc' | 'desc';
  joinSeparator?: string;
  outputKey: string;
}

export interface TextFormatterConfig {
  inputValue: string;
  operation: 'uppercase' | 'lowercase' | 'title_case' | 'trim' | 'replace' | 'concatenate' | 'extract' | 'format_phone' | 'format_date';
  findText?: string;
  replaceText?: string;
  appendText?: string;
  extractPattern?: string;
  dateFormat?: string;
  outputKey: string;
}

export interface AIPromptConfig {
  promptTemplate: string;
  inputVariables?: Array<{ key: string; source: string }>;
  outputMode: 'plain_text' | 'json' | 'summary' | 'classification';
  saveOutputTo?: 'variable' | 'contact_field' | 'note';
  saveOutputKey?: string;
  requireApproval?: boolean;
  modelId?: string;
}

export interface UpdateAppointmentStatusConfig {
  appointmentSource: AppointmentSource;
  appointmentId?: string;
  newStatus: 'confirmed' | 'cancelled' | 'no_show' | 'completed' | 'rescheduled';
  reason?: string;
  notifyContact?: boolean;
}

export interface GenerateBookingLinkConfig {
  calendarId: string;
  appointmentTypeId: string;
  expirationHours?: number;
  usageLimit?: number;
  saveToField?: string;
}

export interface CreateOrUpdateOpportunityConfig {
  mode: 'create' | 'update' | 'upsert';
  pipelineId?: string;
  stageId?: string;
  title?: string;
  titleTemplate?: string;
  status?: 'open' | 'won' | 'lost' | 'abandoned';
  value?: number;
  closeDate?: string;
  closeDateDays?: number;
  assigneeType?: AssigneeType;
  assigneeId?: string;
  duplicateRule?: 'skip' | 'update' | 'create_new';
  customFields?: Record<string, unknown>;
}

export interface RemoveOpportunityConfig {
  opportunitySource: OpportunitySource;
  opportunityId?: string;
  scope?: 'current' | 'all_pipelines' | 'selected_pipelines';
  pipelineIds?: string[];
  mode?: 'archive' | 'delete';
  requireApproval?: boolean;
}

export interface SendDocumentsAndContractsConfig {
  templateId: string;
  recipientType: RecipientType;
  recipientIds?: string[];
  deliveryChannel: 'email' | 'sms' | 'both';
  requireSignature?: boolean;
  linkedEntityType?: 'contact' | 'opportunity' | 'project';
  linkedEntityId?: string;
  expirationDays?: number;
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
  | GenerateMeetingFollowUpConfig
  | CreateContactConfig
  | FindContactConfig
  | CopyContactConfig
  | DeleteContactConfig
  | ModifyEngagementScoreConfig
  | ModifyFollowersConfig
  | AddNoteConfig
  | EditConversationConfig
  | SendSlackMessageConfig
  | SendMessengerConfig
  | SendGmbMessageConfig
  | SendInternalNotificationConfig
  | ConversationAIReplyConfig
  | FacebookInteractiveConfig
  | InstagramInteractiveConfig
  | ReplyInCommentsConfig
  | SendLiveChatConfig
  | ManualActionConfig
  | SplitTestConfig
  | GoToConfig
  | RemoveFromWorkflowActionConfig
  | DripModeConfig
  | UpdateCustomValueConfig
  | ArrayOperationConfig
  | TextFormatterConfig
  | AIPromptConfig
  | UpdateAppointmentStatusConfig
  | GenerateBookingLinkConfig
  | CreateOrUpdateOpportunityConfig
  | RemoveOpportunityConfig
  | SendDocumentsAndContractsConfig;

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

  // Proposal Actions
  { type: 'create_proposal', label: 'Create Proposal', description: 'Create a new proposal for the contact', category: 'proposals', icon: 'FileText' },
  { type: 'send_proposal', label: 'Send Proposal', description: 'Send a proposal to the contact', category: 'proposals', icon: 'Send' },

  // Project Actions
  { type: 'create_project', label: 'Create Project', description: 'Create a new project from the contact', category: 'projects', icon: 'FolderKanban' },
  { type: 'update_project_stage', label: 'Move Project Stage', description: 'Move a project to a different stage', category: 'projects', icon: 'ArrowRightCircle' },

  // Booking Actions
  { type: 'send_booking_link', label: 'Send Booking Link', description: 'Send a calendar booking link to the contact', category: 'appointments', icon: 'Link' },

  // Goal Check
  { type: 'goal_check', label: 'Goal Check', description: 'Check if a goal condition is met and branch accordingly', category: 'flow_control', icon: 'Target' },

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

  // New GHL-Style Contact Actions
  { type: 'create_contact', label: 'Create Contact', description: 'Create a new contact record', category: 'contact_management', icon: 'UserPlus2' },
  { type: 'find_contact', label: 'Find Contact', description: 'Lookup a contact by field value', category: 'contact_management', icon: 'UserSearch' },
  { type: 'copy_contact', label: 'Copy Contact', description: 'Duplicate a contact with selected fields', category: 'contact_management', icon: 'Copy' },
  { type: 'delete_contact', label: 'Delete Contact', description: 'Remove a contact from the system', category: 'contact_management', icon: 'UserX' },
  { type: 'modify_engagement_score', label: 'Modify Engagement Score', description: 'Set, increase, or decrease engagement score', category: 'contact_management', icon: 'TrendingUp' },
  { type: 'modify_followers', label: 'Modify Followers', description: 'Add or remove contact followers', category: 'contact_management', icon: 'Users2' },
  { type: 'add_note', label: 'Add Note', description: 'Add a note to the contact record', category: 'contact_management', icon: 'StickyNote' },
  { type: 'edit_conversation', label: 'Edit Conversation', description: 'Update conversation status or read state', category: 'contact_management', icon: 'MessageSquarePen' },

  // New GHL-Style Communication Actions
  { type: 'send_slack_message', label: 'Send Slack Message', description: 'Send a message to a Slack channel or user', category: 'communication', icon: 'Slack', isPro: true },
  { type: 'send_messenger', label: 'Send Messenger', description: 'Send a message via Facebook/Instagram/WhatsApp', category: 'communication', icon: 'MessageCircle', isPro: true },
  { type: 'send_gmb_message', label: 'Send GMB Message', description: 'Send a Google Business Profile message', category: 'communication', icon: 'MapPin', isPro: true },
  { type: 'send_internal_notification', label: 'Send Internal Notification', description: 'Notify team members via multiple channels', category: 'communication', icon: 'BellDot' },
  { type: 'conversation_ai_reply', label: 'Conversation AI Reply', description: 'Use AI agent to draft or auto-reply in a conversation', category: 'ai', icon: 'BotMessageSquare', isPro: true },
  { type: 'facebook_interactive_messenger', label: 'Facebook Interactive', description: 'Send an interactive Facebook Messenger message', category: 'communication', icon: 'Facebook', isPro: true },
  { type: 'instagram_interactive_messenger', label: 'Instagram Interactive', description: 'Send an interactive Instagram message', category: 'communication', icon: 'Instagram', isPro: true },
  { type: 'reply_in_comments', label: 'Reply in Comments', description: 'Reply to a social media comment', category: 'communication', icon: 'Reply', isPro: true },
  { type: 'send_live_chat_message', label: 'Send Live Chat Message', description: 'Send a message in a live chat widget', category: 'communication', icon: 'MessageSquareDot' },

  // Internal / Logic Actions
  { type: 'manual_action', label: 'Manual Action', description: 'Pause and assign a manual task to a team member', category: 'system', icon: 'HandMetal' },
  { type: 'split_test', label: 'A/B Split Test', description: 'Randomly split contacts into test variants', category: 'flow_control', icon: 'Split' },
  { type: 'go_to', label: 'Go To', description: 'Jump to a specific node or trigger another workflow', category: 'flow_control', icon: 'CornerDownRight' },
  { type: 'remove_from_workflow_action', label: 'Remove from Workflow', description: 'Remove contact from current or other workflows', category: 'flow_control', icon: 'LogOut' },
  { type: 'drip_mode', label: 'Drip Mode', description: 'Schedule contacts in timed batches', category: 'flow_control', icon: 'Droplets' },

  // Data Actions
  { type: 'update_custom_value', label: 'Update Custom Value', description: 'Set or modify a custom value field', category: 'system', icon: 'Database' },
  { type: 'array_operation', label: 'Array Operation', description: 'Manipulate array data in workflow context', category: 'system', icon: 'Brackets' },
  { type: 'text_formatter', label: 'Text Formatter', description: 'Transform text with formatting operations', category: 'system', icon: 'Type' },

  // AI Actions
  { type: 'ai_prompt', label: 'AI Prompt', description: 'Run a custom AI prompt and capture the output', category: 'ai', icon: 'Sparkles', isPro: true },

  // Extended Appointment Actions
  { type: 'update_appointment_status', label: 'Update Appointment Status', description: 'Change the status of an appointment', category: 'appointments', icon: 'CalendarCheck2' },
  { type: 'generate_booking_link', label: 'Generate Booking Link', description: 'Create a one-time booking link for the contact', category: 'appointments', icon: 'Link2' },

  // Extended Opportunity Actions
  { type: 'create_or_update_opportunity', label: 'Create/Update Opportunity', description: 'Create a new opportunity or update existing one', category: 'opportunities', icon: 'PlusCircle' },
  { type: 'remove_opportunity', label: 'Remove Opportunity', description: 'Archive or delete an opportunity', category: 'opportunities', icon: 'MinusCircle' },

  // Extended Payment Actions
  { type: 'send_documents_and_contracts', label: 'Send Documents & Contracts', description: 'Send a document or contract for signing', category: 'payments', icon: 'FileSignature' },
];

export const ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  communication: 'Communication',
  contact_management: 'Contact Management',
  tasks: 'Tasks',
  opportunities: 'Opportunities',
  appointments: 'Appointments',
  payments: 'Payments',
  proposals: 'Proposals',
  projects: 'Projects',
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
  proposals: 'FileText',
  projects: 'FolderKanban',
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
