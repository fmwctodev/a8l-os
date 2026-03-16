export interface ContactChangedConfig {
  watchedFields: string[];
  matchMode: 'any' | 'all';
  fieldConditions?: {
    field: string;
    operator: string;
    oldValue?: string;
    newValue?: string;
  }[];
}

export interface ContactCreatedConfig {
  sourceFilter?: string[];
  tagFilter?: string[];
  ownerFilter?: string[];
}

export interface ContactDndConfig {
  channel: 'all' | 'sms' | 'email' | 'call';
  state: 'turned_on' | 'turned_off' | 'any';
}

export interface ContactTagChangedConfig {
  tagId?: string;
  tagName?: string;
  action: 'added' | 'removed' | 'either';
}

export interface CustomDateReminderConfig {
  customDateField: string;
  timing: 'before' | 'on' | 'after';
  offsetValue: number;
  offsetUnit: 'minutes' | 'hours' | 'days';
}

export interface NoteAddedConfig {
  visibilityFilter?: 'internal' | 'client' | 'any';
  authorFilter?: string[];
}

export interface NoteChangedConfig {
  authorFilter?: string[];
}

export interface TaskAddedConfig {
  assigneeFilter?: string[];
  taskTypeFilter?: string[];
  priorityFilter?: ('low' | 'medium' | 'high' | 'urgent')[];
}

export interface TaskReminderConfig {
  taskFilter?: string[];
  reminderTimingMode?: 'at_time' | 'before_due';
}

export interface TaskCompletedConfig {
  assigneeFilter?: string[];
  taskTypeFilter?: string[];
}

export interface EngagementScoreConfig {
  operator: 'equals' | 'greater_than' | 'less_than' | 'crosses_above' | 'crosses_below';
  scoreValue: number;
}

export interface EventSchedulerConfig {
  frequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom_cron';
  timezone: string;
  startDate?: string;
  endDate?: string;
  timeOfDay?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  cronExpression?: string;
}

export interface CallDetailsConfig {
  direction?: 'inbound' | 'outbound' | 'any';
  minDuration?: number;
  maxDuration?: number;
  outcome?: string[];
  answeredStatus?: 'answered' | 'missed' | 'any';
  provider?: string[];
}

export interface EmailEventsConfig {
  eventTypes: ('delivered' | 'opened' | 'clicked' | 'bounced' | 'spam' | 'unsubscribe')[];
  templateFilter?: string[];
  senderFilter?: string[];
}

export interface CustomerRepliedConfig {
  channels: ('email' | 'sms' | 'webchat' | 'facebook_dm' | 'instagram_dm' | 'linkedin_dm' | 'x_dm' | 'vapi_sms' | 'vapi_webchat')[];
  replyContains?: string;
}

export interface ConversationAIConfig {
  eventName?: string;
  classificationFilter?: string;
  confidenceThreshold?: number;
}

export interface CustomTriggerConfig {
  eventName: string;
  payloadKeyFilters?: { key: string; operator: string; value: string }[];
}

export interface FormSubmittedConfig {
  formId?: string;
  formName?: string;
  sourceFilter?: string;
}

export interface SurveySubmittedConfig {
  surveyId?: string;
  surveyName?: string;
  minScore?: number;
  maxScore?: number;
}

export interface ReviewReceivedConfig {
  platform?: string[];
  minRating?: number;
  maxRating?: number;
  accountFilter?: string[];
}

export interface ProspectGeneratedConfig {
  sourceFilter?: string[];
  ownerFilter?: string[];
  campaignFilter?: string[];
}

export interface AppointmentStatusConfig {
  statuses: ('booked' | 'rescheduled' | 'cancelled' | 'no_show' | 'confirmed' | 'completed')[];
  calendarFilter?: string[];
  appointmentTypeFilter?: string[];
  assignedUserFilter?: string[];
}

export interface CustomerBookedConfig {
  calendarFilter?: string[];
  appointmentTypeFilter?: string[];
}

export interface OpportunityStatusChangedConfig {
  statuses: ('open' | 'won' | 'lost')[];
  oldStatusFilter?: string;
  newStatusFilter?: string;
  pipelineFilter?: string[];
}

export interface OpportunityCreatedConfig {
  pipelineFilter?: string[];
  stageFilter?: string[];
  ownerFilter?: string[];
}

export interface OpportunityChangedConfig {
  watchedFields: string[];
  matchMode: 'any' | 'all';
  fieldConditions?: {
    field: string;
    operator: string;
    oldValue?: string;
    newValue?: string;
  }[];
  pipelineFilter?: string[];
}

export interface OpportunityStageChangedConfig {
  pipelineFilter?: string[];
  fromStage?: string;
  toStage?: string;
  anyStageMove?: boolean;
}

export interface OpportunityStaleConfig {
  pipelineFilter?: string[];
  stageFilter?: string[];
  inactivityThreshold: number;
  inactivityUnit: 'hours' | 'days';
  basedOn: ('no_note' | 'no_message' | 'no_stage_movement' | 'no_task_completed')[];
}

export type TriggerConfigUnion =
  | { type: 'contact_changed'; config: ContactChangedConfig }
  | { type: 'contact_created'; config: ContactCreatedConfig }
  | { type: 'contact_dnd_changed'; config: ContactDndConfig }
  | { type: 'contact_tag_changed'; config: ContactTagChangedConfig }
  | { type: 'contact_custom_date_reminder'; config: CustomDateReminderConfig }
  | { type: 'contact_note_added'; config: NoteAddedConfig }
  | { type: 'contact_note_changed'; config: NoteChangedConfig }
  | { type: 'contact_task_added'; config: TaskAddedConfig }
  | { type: 'contact_task_reminder'; config: TaskReminderConfig }
  | { type: 'contact_task_completed'; config: TaskCompletedConfig }
  | { type: 'contact_engagement_score'; config: EngagementScoreConfig }
  | { type: 'event_scheduler'; config: EventSchedulerConfig }
  | { type: 'event_call_details'; config: CallDetailsConfig }
  | { type: 'event_email'; config: EmailEventsConfig }
  | { type: 'event_customer_replied'; config: CustomerRepliedConfig }
  | { type: 'event_conversation_ai'; config: ConversationAIConfig }
  | { type: 'event_custom'; config: CustomTriggerConfig }
  | { type: 'event_form_submitted'; config: FormSubmittedConfig }
  | { type: 'event_survey_submitted'; config: SurveySubmittedConfig }
  | { type: 'event_review_received'; config: ReviewReceivedConfig }
  | { type: 'event_prospect_generated'; config: ProspectGeneratedConfig }
  | { type: 'appointment_status_changed'; config: AppointmentStatusConfig }
  | { type: 'appointment_customer_booked'; config: CustomerBookedConfig }
  | { type: 'opportunity_status_changed'; config: OpportunityStatusChangedConfig }
  | { type: 'opportunity_created'; config: OpportunityCreatedConfig }
  | { type: 'opportunity_changed'; config: OpportunityChangedConfig }
  | { type: 'opportunity_stage_changed'; config: OpportunityStageChangedConfig }
  | { type: 'opportunity_stale'; config: OpportunityStaleConfig };

export interface ContactChangedPayload {
  contact_id: string;
  changed_fields: string[];
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  changed_at: string;
}

export interface ContactCreatedPayload {
  contact_id: string;
  source?: string;
  owner_id?: string;
  created_at: string;
}

export interface ContactDndPayload {
  contact_id: string;
  channel: string;
  old_state: boolean;
  new_state: boolean;
  changed_at: string;
}

export interface ContactTagChangedPayload {
  contact_id: string;
  tag: string;
  action: 'added' | 'removed';
  changed_at: string;
}

export interface CustomDateReminderPayload {
  contact_id: string;
  field_name: string;
  field_value: string;
  trigger_offset: string;
  reminder_time: string;
}

export interface NoteAddedPayload {
  contact_id: string;
  note_id: string;
  note_body: string;
  author_id: string;
  created_at: string;
}

export interface NoteChangedPayload {
  contact_id: string;
  note_id: string;
  old_body: string;
  new_body: string;
  updated_at: string;
}

export interface TaskAddedPayload {
  contact_id: string;
  task_id: string;
  assignee_id?: string;
  priority: string;
  due_date?: string;
  created_at: string;
}

export interface TaskReminderPayload {
  contact_id: string;
  task_id: string;
  reminder_at: string;
  assignee_id?: string;
}

export interface TaskCompletedPayload {
  contact_id: string;
  task_id: string;
  completed_at: string;
  completed_by: string;
}

export interface EngagementScorePayload {
  contact_id: string;
  old_score: number;
  new_score: number;
  triggered_rule: string;
}

export interface EventSchedulerPayload {
  schedule_id: string;
  triggered_at: string;
}

export interface CallDetailsPayload {
  call_id: string;
  contact_id?: string;
  direction: string;
  duration: number;
  outcome: string;
  provider: string;
  ended_at: string;
}

export interface EmailEventPayload {
  email_id: string;
  contact_id?: string;
  event_type: string;
  message_id: string;
  occurred_at: string;
}

export interface CustomerRepliedPayload {
  conversation_id: string;
  message_id: string;
  contact_id: string;
  channel: string;
  content: string;
  replied_at: string;
}

export interface ConversationAIPayload {
  conversation_id: string;
  contact_id?: string;
  ai_event_name: string;
  ai_result: unknown;
  confidence: number;
  occurred_at: string;
}

export interface CustomTriggerPayload {
  event_name: string;
  payload: Record<string, unknown>;
  triggered_at: string;
}

export interface FormSubmittedPayload {
  form_id: string;
  submission_id: string;
  contact_id?: string;
  submitted_fields: Record<string, unknown>;
  submitted_at: string;
}

export interface SurveySubmittedPayload {
  survey_id: string;
  submission_id: string;
  contact_id?: string;
  answers: Record<string, unknown>;
  score?: number;
  submitted_at: string;
}

export interface ReviewReceivedPayload {
  review_id: string;
  contact_id?: string;
  platform: string;
  rating: number;
  review_text: string;
  received_at: string;
}

export interface ProspectGeneratedPayload {
  prospect_id: string;
  contact_id?: string;
  source: string;
  created_at: string;
}

export interface AppointmentStatusPayload {
  appointment_id: string;
  contact_id?: string;
  calendar_id: string;
  old_status: string;
  new_status: string;
  start_time: string;
  changed_at: string;
}

export interface CustomerBookedPayload {
  appointment_id: string;
  contact_id?: string;
  calendar_id: string;
  appointment_type_id: string;
  booked_at: string;
  start_time: string;
}

export interface OpportunityStatusChangedPayload {
  opportunity_id: string;
  contact_id?: string;
  pipeline_id: string;
  old_status: string;
  new_status: string;
  changed_at: string;
}

export interface OpportunityChangedPayload {
  opportunity_id: string;
  changed_fields: string[];
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  changed_at: string;
}

export interface OpportunityStalePayload {
  opportunity_id: string;
  contact_id?: string;
  pipeline_id: string;
  stage_id: string;
  last_activity_at: string;
  stale_days: number;
  triggered_at: string;
}
