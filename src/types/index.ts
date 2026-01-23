export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  hierarchy_level: number;
  created_at: string;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
  module_name: string;
  created_at: string;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
}

export type UserStatus = 'active' | 'inactive' | 'pending' | 'invited' | 'disabled';

export interface User {
  id: string;
  organization_id: string;
  department_id: string | null;
  role_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  phone: string | null;
  timezone: string;
  status: UserStatus;
  invited_by: string | null;
  disabled_at: string | null;
  disabled_by: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
  role?: Role;
  department?: Department | null;
  organization?: Organization;
  invited_by_user?: User | null;
  disabled_by_user?: User | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  timestamp: string;
  user?: User;
}

export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  created_at: string;
}

export interface UserWithDetails extends User {
  role: Role;
  department: Department | null;
  permissions: string[];
}

export type PermissionKey =
  | 'conversations.view' | 'conversations.send' | 'conversations.assign'
  | 'conversations.close' | 'conversations.manage' | 'channels.configure'
  | 'calendars.view' | 'calendars.manage'
  | 'appointments.view' | 'appointments.create' | 'appointments.edit' | 'appointments.cancel'
  | 'contacts.view' | 'contacts.create' | 'contacts.edit' | 'contacts.delete'
  | 'contacts.merge' | 'contacts.export' | 'contacts.import' | 'contacts.bulk_delete'
  | 'opportunities.view' | 'opportunities.create' | 'opportunities.edit'
  | 'opportunities.move_stage' | 'opportunities.close' | 'opportunities.delete'
  | 'pipelines.manage'
  | 'payments.view' | 'payments.manage'
  | 'invoices.create' | 'invoices.send' | 'invoices.void'
  | 'products.manage'
  | 'ai_agents.view' | 'ai_agents.run' | 'ai_agents.manage' | 'ai_agents.memory.reset'
  | 'ai.settings.view' | 'ai.settings.manage' | 'ai.models.manage' | 'ai.voices.manage'
  | 'ai.knowledge.manage' | 'ai.prompts.manage'
  | 'marketing.view' | 'marketing.manage'
  | 'marketing.forms.view' | 'marketing.forms.manage' | 'marketing.forms.publish'
  | 'marketing.surveys.view' | 'marketing.surveys.manage' | 'marketing.surveys.publish'
  | 'marketing.social.view' | 'marketing.social.manage' | 'marketing.social.approve'
  | 'marketing.social.publish' | 'marketing.social.connect'
  | 'automation.view' | 'automation.manage'
  | 'media.view' | 'media.manage'
  | 'reputation.view' | 'reputation.request' | 'reputation.manage' | 'reputation.providers.manage'
  | 'reporting.view' | 'reporting.manage' | 'reporting.schedule' | 'reporting.export'
  | 'users.view' | 'users.invite' | 'users.manage'
  | 'staff.view' | 'staff.manage' | 'staff.invite' | 'staff.disable' | 'staff.reset_password'
  | 'departments.manage'
  | 'settings.view' | 'settings.manage'
  | 'audit.view' | 'audit_logs.view'
  | 'email.settings.view' | 'email.settings.manage' | 'email.send.test'
  | 'phone.settings.view' | 'phone.settings.manage' | 'phone.numbers.manage'
  | 'phone.routing.manage' | 'phone.test.run' | 'phone.compliance.manage';

export interface InviteStaffInput {
  first_name: string;
  last_name: string;
  email: string;
  role_id: string;
  department_id: string | null;
  phone?: string;
  timezone: string;
}

export interface StaffFilters {
  search?: string;
  status?: UserStatus[];
  role_id?: string;
  department_id?: string;
}

export interface Contact {
  id: string;
  organization_id: string;
  department_id: string;
  owner_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  source: string | null;
  status: 'active' | 'archived';
  merged_into_contact_id: string | null;
  merged_at: string | null;
  merged_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
  owner?: User | null;
  department?: Department | null;
  tags?: Tag[];
  custom_field_values?: ContactCustomFieldValue[];
}

export interface Tag {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface CustomField {
  id: string;
  organization_id: string;
  name: string;
  field_key: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'boolean';
  options: string[] | null;
  is_required: boolean;
  display_order: number;
  created_at: string;
}

export interface ContactCustomFieldValue {
  id: string;
  contact_id: string;
  custom_field_id: string;
  value: unknown;
  custom_field?: CustomField;
}

export interface ContactNote {
  id: string;
  contact_id: string;
  user_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface ContactTask {
  id: string;
  contact_id: string;
  opportunity_id: string | null;
  assigned_to_user_id: string | null;
  created_by_user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_to?: User | null;
  created_by?: User;
}

export interface ContactTimelineEvent {
  id: string;
  contact_id: string;
  user_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
  user?: User | null;
}

export type MessageChannel = 'sms' | 'email' | 'voice' | 'webchat';
export type MessageDirection = 'inbound' | 'outbound' | 'system';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
export type ConversationStatus = 'open' | 'pending' | 'closed';
export type InboxEventType = 'assigned' | 'status_changed' | 'contact_merged' | 'conversation_created' | 'ambiguous_contact' | 'note_added';

export interface Conversation {
  id: string;
  organization_id: string;
  contact_id: string;
  assigned_user_id: string | null;
  department_id: string | null;
  status: ConversationStatus;
  last_message_at: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
  contact?: Contact;
  assigned_user?: User | null;
  department?: Department | null;
  last_message?: Message;
}

export interface Message {
  id: string;
  organization_id: string;
  conversation_id: string;
  contact_id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  body: string;
  subject: string | null;
  metadata: MessageMetadata;
  status: MessageStatus;
  external_id: string | null;
  sent_at: string;
  created_at: string;
  contact?: Contact;
}

export interface MessageMetadata {
  from_number?: string;
  to_number?: string;
  from_email?: string;
  to_email?: string;
  thread_id?: string;
  media_urls?: string[];
  segment_count?: number;
  error_message?: string;
  [key: string]: unknown;
}

export interface CallLog {
  id: string;
  organization_id: string;
  conversation_id: string;
  contact_id: string;
  twilio_call_sid: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  duration: number;
  recording_url: string | null;
  status: string;
  created_at: string;
}

export interface InboxEvent {
  id: string;
  organization_id: string;
  conversation_id: string;
  event_type: InboxEventType;
  payload: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
  actor?: User | null;
}

export interface ChannelConfiguration {
  id: string;
  organization_id: string;
  channel_type: 'twilio' | 'gmail' | 'webchat';
  config: TwilioConfig | GmailConfig | WebchatConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TwilioConfig {
  account_sid: string;
  auth_token: string;
  phone_numbers: string[];
  webhook_url?: string;
}

export interface GmailConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export interface WebchatConfig {
  enabled: boolean;
  primary_color: string;
  welcome_message: string;
  pre_chat_form: boolean;
  required_fields: ('name' | 'email')[];
}

export interface GmailOAuthToken {
  id: string;
  organization_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface WebchatSession {
  id: string;
  organization_id: string;
  conversation_id: string | null;
  visitor_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  metadata: Record<string, unknown>;
  last_activity_at: string;
  created_at: string;
}

export interface ConversationFilters {
  status?: ConversationStatus[];
  channels?: MessageChannel[];
  assignedUserId?: string | null;
  departmentId?: string;
  unreadOnly?: boolean;
  search?: string;
}

export type CalendarType = 'user' | 'team';
export type LocationType = 'phone' | 'google_meet' | 'zoom' | 'in_person' | 'custom';
export type AppointmentStatus = 'scheduled' | 'canceled' | 'completed' | 'no_show';
export type AppointmentSource = 'booking' | 'manual';
export type AssignmentMode = 'round_robin' | 'priority';
export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface CalendarSettings {
  assignment_mode: AssignmentMode;
  last_assigned_index: number;
}

export interface Calendar {
  id: string;
  org_id: string;
  type: CalendarType;
  name: string;
  slug: string;
  department_id: string | null;
  owner_user_id: string | null;
  settings: CalendarSettings;
  active: boolean;
  created_at: string;
  updated_at: string;
  owner?: User | null;
  department?: Department | null;
  members?: CalendarMember[];
  appointment_types?: AppointmentType[];
}

export interface CalendarMember {
  id: string;
  calendar_id: string;
  user_id: string;
  weight: number;
  priority: number;
  active: boolean;
  created_at: string;
  user?: User;
}

export interface AppointmentTypeQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
}

export interface AppointmentTypeLocation {
  phone_number?: string;
  address?: string;
  custom_link?: string;
  instructions?: string;
}

export interface AppointmentType {
  id: string;
  org_id: string;
  calendar_id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  location_type: LocationType;
  location_value: AppointmentTypeLocation;
  questions: AppointmentTypeQuestion[];
  slot_interval_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  booking_window_days: number;
  max_per_day: number | null;
  generate_google_meet: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  calendar?: Calendar;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface DaySchedule {
  monday: TimeRange[];
  tuesday: TimeRange[];
  wednesday: TimeRange[];
  thursday: TimeRange[];
  friday: TimeRange[];
  saturday: TimeRange[];
  sunday: TimeRange[];
}

export interface DateOverride {
  date: string;
  available: boolean;
  ranges?: TimeRange[];
}

export interface AvailabilityRule {
  id: string;
  org_id: string;
  calendar_id: string;
  user_id: string | null;
  timezone: string;
  rules: DaySchedule;
  overrides: DateOverride[];
  created_at: string;
  updated_at: string;
}

export interface AppointmentAnswers {
  name: string;
  email: string;
  phone?: string;
  [key: string]: unknown;
}

export interface AppointmentHistory {
  action: 'created' | 'rescheduled' | 'canceled';
  timestamp: string;
  previous_start?: string;
  previous_end?: string;
}

export interface Appointment {
  id: string;
  org_id: string;
  calendar_id: string;
  appointment_type_id: string;
  contact_id: string | null;
  assigned_user_id: string | null;
  status: AppointmentStatus;
  start_at_utc: string;
  end_at_utc: string;
  visitor_timezone: string;
  answers: AppointmentAnswers;
  source: AppointmentSource;
  google_meet_link: string | null;
  reschedule_token: string;
  cancel_token: string;
  notes: string | null;
  history: AppointmentHistory[];
  created_at: string;
  updated_at: string;
  canceled_at: string | null;
  calendar?: Calendar;
  appointment_type?: AppointmentType;
  contact?: Contact | null;
  assigned_user?: User | null;
}

export interface GoogleCalendarConnection {
  id: string;
  org_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  email: string;
  selected_calendar_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface AppointmentSync {
  id: string;
  org_id: string;
  appointment_id: string;
  provider: 'google';
  external_event_id: string | null;
  sync_status: SyncStatus;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  eligible_user_ids: string[];
}

export interface CalendarFilters {
  type?: CalendarType;
  departmentId?: string;
  search?: string;
}

export interface AppointmentFilters {
  calendarId?: string;
  assignedUserId?: string;
  departmentId?: string;
  status?: AppointmentStatus[];
  startDate?: string;
  endDate?: string;
}

export type WorkflowStatus = 'draft' | 'published' | 'archived';
export type EnrollmentStatus = 'active' | 'completed' | 'stopped' | 'errored';
export type WorkflowJobStatus = 'pending' | 'running' | 'done' | 'failed';

export type WorkflowTriggerType =
  | 'contact_created'
  | 'contact_updated'
  | 'contact_tag_added'
  | 'contact_tag_removed'
  | 'contact_owner_changed'
  | 'contact_department_changed'
  | 'conversation_message_received'
  | 'conversation_status_changed'
  | 'conversation_assigned'
  | 'appointment_booked'
  | 'appointment_rescheduled'
  | 'appointment_canceled'
  | 'form_submitted'
  | 'survey_submitted'
  | 'review_requested'
  | 'review_clicked'
  | 'review_submitted'
  | 'review_negative_received'
  | 'invoice_created'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'payment_received'
  | 'recurring_invoice_created';

export type WorkflowActionType =
  | 'add_tag'
  | 'remove_tag'
  | 'update_field'
  | 'assign_owner'
  | 'move_department'
  | 'create_note'
  | 'send_sms'
  | 'send_email'
  | 'webhook_post'
  | 'internal_notification'
  | 'invoke_ai_agent';

export type WorkflowNodeType = 'trigger' | 'condition' | 'delay' | 'action' | 'end';

export type DelayType = 'wait_duration' | 'wait_until_datetime' | 'wait_until_weekday_time';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'has_tag'
  | 'does_not_have_tag';

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface TriggerNodeData {
  triggerType: WorkflowTriggerType;
  filters?: ConditionGroup;
}

export interface ConditionRule {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean | null;
}

export interface ConditionGroup {
  logic: 'and' | 'or';
  rules: (ConditionRule | ConditionGroup)[];
}

export interface ConditionNodeData {
  conditions: ConditionGroup;
}

export interface DelayNodeData {
  delayType: DelayType;
  duration?: { value: number; unit: 'minutes' | 'hours' | 'days' };
  datetime?: string;
  weekday?: number;
  time?: string;
}

export interface ActionNodeData {
  actionType: WorkflowActionType;
  config: ActionConfig;
}

export type ActionConfig =
  | AddTagConfig
  | RemoveTagConfig
  | UpdateFieldConfig
  | AssignOwnerConfig
  | MoveDepartmentConfig
  | CreateNoteConfig
  | SendSmsConfig
  | SendEmailConfig
  | WebhookPostConfig
  | InternalNotificationConfig
  | InvokeAIAgentActionConfig;

export interface InvokeAIAgentActionConfig {
  agentId: string;
  agentName?: string;
  instructions?: string;
  outputVariable?: string;
}

export interface AddTagConfig {
  tagId: string;
  tagName?: string;
}

export interface RemoveTagConfig {
  tagId: string;
  tagName?: string;
}

export interface UpdateFieldConfig {
  field: string;
  value: string;
}

export interface AssignOwnerConfig {
  userId: string;
  userName?: string;
}

export interface MoveDepartmentConfig {
  departmentId: string;
  departmentName?: string;
}

export interface CreateNoteConfig {
  content: string;
}

export interface SendSmsConfig {
  body: string;
}

export interface SendEmailConfig {
  subject: string;
  body: string;
}

export interface WebhookPostConfig {
  url: string;
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
}

export interface InternalNotificationConfig {
  userIds: string[];
  message: string;
}

export interface EndNodeData {
  label?: string;
}

export type WorkflowNodeData =
  | TriggerNodeData
  | ConditionNodeData
  | DelayNodeData
  | ActionNodeData
  | EndNodeData;

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: WorkflowNodePosition;
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: WorkflowViewport;
}

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  draft_definition: WorkflowDefinition;
  published_definition: WorkflowDefinition | null;
  published_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  created_by?: User | null;
  triggers?: WorkflowTrigger[];
  enrollment_count?: number;
  active_enrollment_count?: number;
}

export interface WorkflowVersion {
  id: string;
  org_id: string;
  workflow_id: string;
  version_number: number;
  definition: WorkflowDefinition;
  created_by_user_id: string | null;
  created_at: string;
  created_by?: User | null;
}

export interface WorkflowTrigger {
  id: string;
  org_id: string;
  workflow_id: string;
  trigger_type: WorkflowTriggerType;
  trigger_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowEnrollment {
  id: string;
  org_id: string;
  workflow_id: string;
  version_id: string;
  contact_id: string;
  status: EnrollmentStatus;
  current_node_id: string | null;
  context_data: Record<string, unknown>;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  stopped_reason: string | null;
  contact?: Contact;
  workflow?: Workflow;
  version?: WorkflowVersion;
}

export interface WorkflowJob {
  id: string;
  org_id: string;
  enrollment_id: string;
  node_id: string;
  run_at: string;
  status: WorkflowJobStatus;
  attempts: number;
  last_error: string | null;
  execution_key: string;
  created_at: string;
  updated_at: string;
  enrollment?: WorkflowEnrollment;
}

export interface WorkflowExecutionLog {
  id: string;
  org_id: string;
  enrollment_id: string;
  node_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

export interface EventOutbox {
  id: string;
  org_id: string;
  event_type: string;
  contact_id: string | null;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
}

export interface WorkflowFilters {
  status?: WorkflowStatus[];
  search?: string;
}

export interface EnrollmentFilters {
  workflowId?: string;
  status?: EnrollmentStatus[];
  contactSearch?: string;
}

export type AIAgentRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'stopped';
export type AIAgentTriggerType = 'user' | 'automation';
export type AIToolCallStatus = 'success' | 'failed';

export type AIAgentToolName =
  | 'get_contact'
  | 'get_timeline'
  | 'get_conversation_history'
  | 'get_appointment_history'
  | 'add_note'
  | 'update_field'
  | 'add_tag'
  | 'remove_tag'
  | 'assign_owner'
  | 'create_appointment'
  | 'send_sms'
  | 'send_email';

export type AIAgentChannel = 'sms' | 'email' | 'internal_note';

export interface AIAgent {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  allowed_tools: AIAgentToolName[];
  allowed_channels: AIAgentChannel[];
  temperature: number;
  max_tokens: number;
  enabled: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  created_by?: User | null;
  stats?: AIAgentStats;
}

export interface AIAgentStats {
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  success_rate: number;
  last_run_at: string | null;
}

export interface AIAgentMemory {
  id: string;
  org_id: string;
  agent_id: string;
  contact_id: string;
  memory_summary: string | null;
  key_facts: Record<string, string>;
  conversation_summary: string | null;
  last_decision: string | null;
  confidence_level: string | null;
  lead_stage: string | null;
  last_updated_at: string;
  contact?: Contact;
  agent?: AIAgent;
}

export interface AIAgentRun {
  id: string;
  org_id: string;
  agent_id: string;
  contact_id: string;
  conversation_id: string | null;
  triggered_by: AIAgentTriggerType;
  trigger_source_id: string | null;
  status: AIAgentRunStatus;
  input_prompt: string;
  output_summary: string | null;
  draft_message: string | null;
  draft_channel: AIAgentChannel | null;
  draft_subject: string | null;
  user_approved: boolean | null;
  approved_at: string | null;
  approved_by_user_id: string | null;
  messages_sent: number;
  tool_calls_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  agent?: AIAgent;
  contact?: Contact;
  conversation?: Conversation;
  tool_calls?: AIAgentToolCall[];
  approved_by?: User | null;
}

export interface AIAgentToolCall {
  id: string;
  org_id: string;
  agent_run_id: string;
  tool_name: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown> | null;
  status: AIToolCallStatus;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}

export interface AIAgentFilters {
  enabled?: boolean;
  search?: string;
}

export interface AIAgentRunFilters {
  agentId?: string;
  contactId?: string;
  status?: AIAgentRunStatus[];
  triggeredBy?: AIAgentTriggerType;
  startDate?: string;
  endDate?: string;
}

export interface InvokeAIAgentConfig {
  agentId: string;
  instructions?: string;
  outputVariable?: string;
}

export type FormStatus = 'draft' | 'published' | 'archived';
export type SurveyStatus = 'draft' | 'published' | 'archived';
export type SubmissionProcessedStatus = 'pending' | 'processed' | 'failed';

export type FormFieldType =
  | 'first_name' | 'last_name' | 'full_name' | 'email' | 'phone'
  | 'company' | 'website' | 'address'
  | 'text' | 'textarea' | 'number' | 'dropdown' | 'multi_select'
  | 'checkbox' | 'date' | 'hidden' | 'consent';

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldMapping {
  contactField?: string;
  customFieldId?: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  defaultValue?: string;
  options?: FormFieldOption[];
  mapping?: FormFieldMapping;
  width?: 'full' | 'half';
}

export interface FormDefinition {
  fields: FormField[];
}

export interface FormSettings {
  thankYouMessage?: string;
  redirectUrl?: string;
  contactMatching: 'email_first' | 'phone_first' | 'create_new';
  fieldOverwrite: 'always' | 'only_if_empty';
  tagIds?: string[];
  ownerId?: string;
  departmentId?: string;
  honeypotEnabled?: boolean;
  rateLimitPerIp?: number;
}

export interface Form {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  status: FormStatus;
  definition: FormDefinition;
  settings: FormSettings;
  public_slug: string | null;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_user?: User | null;
  submission_count?: number;
  recent_submission_count?: number;
}

export interface AttributionData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface FormSubmission {
  id: string;
  organization_id: string;
  form_id: string;
  contact_id: string | null;
  payload: Record<string, unknown>;
  attribution: AttributionData;
  processed_status: SubmissionProcessedStatus;
  error: string | null;
  idempotency_key: string | null;
  submitted_at: string;
  form?: Form;
  contact?: Contact | null;
}

export type SurveyQuestionType =
  | 'multiple_choice' | 'multi_select' | 'short_answer' | 'long_answer'
  | 'number' | 'date' | 'yes_no' | 'nps' | 'rating' | 'contact_capture' | 'hidden';

export interface SurveyQuestionOption {
  id: string;
  label: string;
  value: string;
  score?: number;
}

export interface SurveyBranchRule {
  questionId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string | number;
  goToStepIndex: number;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  label: string;
  description?: string;
  required: boolean;
  options?: SurveyQuestionOption[];
  mapping?: FormFieldMapping;
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface SurveyStep {
  id: string;
  title?: string;
  description?: string;
  questions: SurveyQuestion[];
  branchRules?: SurveyBranchRule[];
}

export interface SurveyDefinition {
  steps: SurveyStep[];
}

export interface SurveyScoreBand {
  label: string;
  minScore: number;
  maxScore: number;
  tagId?: string;
}

export interface SurveySettings {
  thankYouMessage?: string;
  redirectUrl?: string;
  contactMatching: 'email_first' | 'phone_first' | 'create_new';
  scoringEnabled?: boolean;
  scoreBands?: SurveyScoreBand[];
  completionTagId?: string;
  tagRules?: Array<{
    questionId: string;
    answerValue: string;
    tagId: string;
  }>;
}

export interface Survey {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  status: SurveyStatus;
  definition: SurveyDefinition;
  settings: SurveySettings;
  public_slug: string | null;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_user?: User | null;
  submission_count?: number;
}

export interface SurveySubmission {
  id: string;
  organization_id: string;
  survey_id: string;
  contact_id: string | null;
  answers: Record<string, unknown>;
  score_total: number;
  score_band: string | null;
  attribution: AttributionData;
  processed_status: SubmissionProcessedStatus;
  error: string | null;
  idempotency_key: string | null;
  submitted_at: string;
  survey?: Survey;
  contact?: Contact | null;
}

export type SocialProvider = 'facebook' | 'instagram' | 'linkedin' | 'google_business' | 'tiktok' | 'youtube';
export type SocialAccountType = 'page' | 'profile' | 'channel' | 'location' | 'business';
export type SocialAccountStatus = 'connected' | 'disconnected' | 'error' | 'token_expiring';
export type SocialPostStatus = 'draft' | 'scheduled' | 'queued' | 'posting' | 'posted' | 'failed' | 'cancelled';
export type SocialPostLogAction = 'created' | 'scheduled' | 'queued' | 'attempt' | 'success' | 'failure' | 'cancelled' | 'approved';

export interface SocialAccount {
  id: string;
  organization_id: string;
  provider: SocialProvider;
  external_account_id: string;
  display_name: string;
  profile_image_url: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expiry: string | null;
  token_meta: Record<string, unknown>;
  account_type: SocialAccountType;
  status: SocialAccountStatus;
  last_error: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
  connected_by_user?: User | null;
}

export interface SocialOAuthState {
  id: string;
  organization_id: string;
  user_id: string;
  provider: SocialProvider;
  state_token: string;
  redirect_uri: string;
  meta: Record<string, unknown>;
  created_at: string;
  expires_at: string;
}

export interface SocialPostMedia {
  url: string;
  type: 'image' | 'video';
  thumbnail_url?: string;
  alt_text?: string;
}

export interface SocialPost {
  id: string;
  organization_id: string;
  created_by: string | null;
  body: string;
  media: SocialPostMedia[];
  targets: string[];
  status: SocialPostStatus;
  scheduled_at_utc: string | null;
  scheduled_timezone: string;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  posted_at: string | null;
  provider_post_ids: Record<string, string>;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  created_by_user?: User | null;
  approved_by_user?: User | null;
  target_accounts?: SocialAccount[];
}

export interface SocialPostLog {
  id: string;
  post_id: string;
  account_id: string | null;
  action: SocialPostLogAction;
  details: Record<string, unknown>;
  created_at: string;
  account?: SocialAccount | null;
}

export interface FormFilters {
  status?: FormStatus[];
  search?: string;
}

export interface SurveyFilters {
  status?: SurveyStatus[];
  search?: string;
}

export interface SocialPostFilters {
  status?: SocialPostStatus[];
  accountId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface FormStats {
  totalForms: number;
  publishedForms: number;
  totalSubmissions: number;
  recentSubmissions: number;
}

export interface SurveyStats {
  totalSurveys: number;
  publishedSurveys: number;
  totalSubmissions: number;
  averageScore: number | null;
}

export interface SocialStats {
  connectedAccounts: number;
  scheduledPosts: number;
  postedThisWeek: number;
  failedPosts: number;
}

export type ReportDataSource = 'contacts' | 'conversations' | 'appointments' | 'forms' | 'surveys' | 'workflows';
export type ReportVisualizationType = 'table' | 'bar' | 'line' | 'pie';
export type ReportVisibility = 'private' | 'department' | 'organization';
export type ReportTriggeredBy = 'user' | 'schedule';
export type ReportRunStatus = 'running' | 'success' | 'failed';
export type ReportExportStatus = 'queued' | 'running' | 'complete' | 'failed';
export type ReportScheduleCadence = 'daily' | 'weekly' | 'monthly';
export type ReportEmailStatus = 'pending' | 'sent' | 'failed';

export type ReportDateGrouping = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type ReportAggregation = 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max';
export type ReportFilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equals'
  | 'less_than_or_equals'
  | 'in'
  | 'not_in'
  | 'between';

export interface ReportDimension {
  id: string;
  field: string;
  label: string;
  dataSource: ReportDataSource;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  dateGrouping?: ReportDateGrouping;
}

export interface ReportMetric {
  id: string;
  field: string;
  label: string;
  dataSource: ReportDataSource;
  aggregation: ReportAggregation;
  format?: 'number' | 'percentage' | 'currency' | 'duration';
}

export interface ReportFilter {
  id: string;
  field: string;
  operator: ReportFilterOperator;
  value: string | number | boolean | string[] | number[] | null;
  dataType: 'string' | 'number' | 'date' | 'boolean';
}

export interface ReportTimeRange {
  type: 'preset' | 'custom';
  preset?: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'all_time';
  customStart?: string;
  customEnd?: string;
}

export interface ReportSorting {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ReportConfig {
  dimensions: ReportDimension[];
  metrics: ReportMetric[];
  filters: ReportFilter[];
  timeRange: ReportTimeRange;
  sorting: ReportSorting[];
  limit?: number;
}

export interface Report {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  data_source: ReportDataSource;
  config: ReportConfig;
  visualization_type: ReportVisualizationType;
  visibility: ReportVisibility;
  department_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  created_by_user?: User;
  department?: Department | null;
  last_run?: ReportRun | null;
  schedules?: ReportSchedule[];
}

export interface ReportRun {
  id: string;
  organization_id: string;
  report_id: string;
  triggered_by: ReportTriggeredBy;
  triggered_by_user_id: string | null;
  status: ReportRunStatus;
  row_count: number | null;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  report?: Report;
  triggered_by_user?: User | null;
  exports?: ReportExport[];
}

export interface ReportExport {
  id: string;
  organization_id: string;
  report_run_id: string;
  status: ReportExportStatus;
  file_path: string | null;
  file_size: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
  report_run?: ReportRun;
}

export interface ReportScheduleRecipients {
  user_ids: string[];
  emails: string[];
}

export interface ReportSchedule {
  id: string;
  organization_id: string;
  report_id: string;
  cadence: ReportScheduleCadence;
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  timezone: string;
  recipients: ReportScheduleRecipients;
  enabled: boolean;
  created_by: string;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  report?: Report;
  created_by_user?: User;
}

export interface ReportEmailQueue {
  id: string;
  organization_id: string;
  schedule_id: string;
  report_run_id: string;
  recipient_email: string;
  status: ReportEmailStatus;
  sendgrid_message_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface ReportFilters {
  dataSource?: ReportDataSource;
  visibility?: ReportVisibility;
  createdBy?: string;
  search?: string;
}

export interface ReportQueryResult {
  columns: Array<{
    key: string;
    label: string;
    type: 'dimension' | 'metric';
    dataType: string;
    format?: string;
  }>;
  rows: Array<Record<string, unknown>>;
  totalRows: number;
  executionTime: number;
}

export interface ReportStats {
  totalReports: number;
  scheduledReports: number;
  exportsThisMonth: number;
  lastRunDate: string | null;
}

export type OpportunityStatus = 'open' | 'won' | 'lost';

export interface Pipeline {
  id: string;
  org_id: string;
  name: string;
  department_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  department?: Department | null;
  stages?: PipelineStage[];
  custom_fields?: PipelineCustomField[];
}

export interface PipelineStage {
  id: string;
  org_id: string;
  pipeline_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  opportunities_count?: number;
  opportunities_value?: number;
}

export interface Opportunity {
  id: string;
  org_id: string;
  contact_id: string;
  pipeline_id: string;
  stage_id: string;
  assigned_user_id: string | null;
  department_id: string | null;
  value_amount: number;
  currency: string;
  status: OpportunityStatus;
  source: string | null;
  close_date: string | null;
  created_by: string;
  closed_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
  pipeline?: Pipeline;
  stage?: PipelineStage;
  assigned_user?: User | null;
  department?: Department | null;
  custom_field_values?: OpportunityCustomFieldValue[];
}

export type PipelineCustomFieldType = 'text' | 'number' | 'date' | 'dropdown' | 'multi_select' | 'boolean';

export interface PipelineCustomField {
  id: string;
  org_id: string;
  pipeline_id: string;
  field_key: string;
  label: string;
  field_type: PipelineCustomFieldType;
  options: string[];
  required: boolean;
  filterable: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OpportunityCustomFieldValue {
  id: string;
  org_id: string;
  opportunity_id: string;
  pipeline_custom_field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_json: unknown | null;
  updated_at: string;
  custom_field?: PipelineCustomField;
}

export interface OpportunityNote {
  id: string;
  org_id: string;
  opportunity_id: string;
  body: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by_user?: User;
}

export type OpportunityTimelineEventType =
  | 'opportunity_created'
  | 'stage_changed'
  | 'assigned_changed'
  | 'value_changed'
  | 'status_changed'
  | 'note_added'
  | 'task_created'
  | 'task_completed'
  | 'custom_field_updated'
  | 'contact_merged';

export interface OpportunityTimelineEvent {
  id: string;
  org_id: string;
  opportunity_id: string;
  contact_id: string;
  event_type: OpportunityTimelineEventType;
  summary: string;
  payload: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
  actor?: User | null;
}

export interface OpportunityFilters {
  pipelineId?: string;
  stageId?: string;
  status?: OpportunityStatus[];
  assignedUserId?: string | null;
  departmentId?: string;
  search?: string;
  tagIds?: string[];
  excludeTagIds?: string[];
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  minValue?: number;
  maxValue?: number;
}

export interface PipelineFilters {
  departmentId?: string;
  search?: string;
}

export interface OpportunityStats {
  totalOpportunities: number;
  openOpportunities: number;
  wonOpportunities: number;
  lostOpportunities: number;
  totalValue: number;
  wonValue: number;
  conversionRate: number;
}

export interface StageStats {
  stageId: string;
  stageName: string;
  count: number;
  value: number;
}

export interface OpportunityBoardData {
  pipeline: Pipeline;
  stages: (PipelineStage & {
    opportunities: Opportunity[];
  })[];
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'cash' | 'check' | 'other';
export type BillingType = 'one_time' | 'recurring';
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'annually';
export type RecurringProfileStatus = 'active' | 'paused' | 'cancelled';
export type DiscountType = 'flat' | 'percentage';

export interface QBOConnection {
  id: string;
  org_id: string;
  realm_id: string;
  company_name: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expiry: string;
  last_sync_at: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
  connected_by_user?: User | null;
}

export interface Product {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  price_amount: number;
  currency: string;
  billing_type: BillingType;
  qbo_item_id: string | null;
  income_account: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  created_by_user?: User | null;
}

export interface Invoice {
  id: string;
  org_id: string;
  contact_id: string;
  opportunity_id: string | null;
  qbo_invoice_id: string | null;
  doc_number: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discount_amount: number;
  discount_type: DiscountType;
  total: number;
  currency: string;
  due_date: string | null;
  payment_link_url: string | null;
  memo: string | null;
  internal_notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  contact?: Contact;
  opportunity?: Opportunity | null;
  created_by_user?: User;
  line_items?: InvoiceLineItem[];
  payments?: Payment[];
}

export interface InvoiceLineItem {
  id: string;
  org_id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
  created_at: string;
  product?: Product | null;
}

export interface Payment {
  id: string;
  org_id: string;
  contact_id: string;
  invoice_id: string;
  qbo_payment_id: string | null;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  received_at: string;
  created_at: string;
  contact?: Contact;
  invoice?: Invoice;
}

export interface RecurringProfile {
  id: string;
  org_id: string;
  contact_id: string;
  qbo_recurring_template_id: string | null;
  name: string;
  frequency: RecurringFrequency;
  status: RecurringProfileStatus;
  next_invoice_date: string | null;
  end_date: string | null;
  auto_send: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
  created_by_user?: User | null;
  items?: RecurringProfileItem[];
}

export interface RecurringProfileItem {
  id: string;
  org_id: string;
  recurring_profile_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  sort_order: number;
  created_at: string;
  product?: Product | null;
}

export interface QBOWebhookLog {
  id: string;
  org_id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
}

export interface InvoiceFilters {
  status?: InvoiceStatus[];
  contactId?: string;
  opportunityId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface ProductFilters {
  active?: boolean;
  billingType?: BillingType;
  search?: string;
}

export interface PaymentFilters {
  contactId?: string;
  invoiceId?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: PaymentMethod;
}

export interface RecurringProfileFilters {
  status?: RecurringProfileStatus[];
  contactId?: string;
  search?: string;
}

export interface InvoiceStats {
  totalInvoices: number;
  draftInvoices: number;
  sentInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalOutstanding: number;
  totalPaid: number;
}

export interface ContactPaymentSummary {
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  invoiceCount: number;
  paymentCount: number;
}

export interface CreateInvoiceLineItem {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface CreateInvoiceInput {
  contact_id: string;
  opportunity_id?: string;
  line_items: CreateInvoiceLineItem[];
  discount_amount?: number;
  discount_type?: DiscountType;
  due_date?: string;
  memo?: string;
  internal_notes?: string;
  auto_send?: boolean;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  price_amount: number;
  currency?: string;
  billing_type: BillingType;
  income_account?: string;
}

export interface CreateRecurringProfileInput {
  contact_id: string;
  name: string;
  frequency: RecurringFrequency;
  items: CreateInvoiceLineItem[];
  start_date: string;
  end_date?: string;
  auto_send?: boolean;
}

export type ReviewProvider = 'google' | 'facebook' | 'internal';
export type ReviewProviderStatus = 'connected' | 'disconnected';
export type ReviewRequestStatus = 'pending' | 'sent' | 'clicked' | 'completed';

export interface ReviewProviderConfig {
  id: string;
  organization_id: string;
  provider: ReviewProvider;
  external_location_id: string | null;
  display_name: string;
  api_credentials: Record<string, unknown>;
  status: ReviewProviderStatus;
  redirect_threshold: number;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewRequest {
  id: string;
  organization_id: string;
  contact_id: string;
  public_slug: string;
  provider_preference: 'smart' | 'google' | 'facebook' | 'internal';
  channel: 'sms' | 'email';
  message_template: string;
  review_link_url: string;
  sent_at: string | null;
  clicked_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  contact?: Contact;
  created_by_user?: User | null;
  rating?: number;
}

export interface Review {
  id: string;
  organization_id: string;
  provider: ReviewProvider;
  provider_review_id: string | null;
  contact_id: string | null;
  review_request_id: string | null;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  reviewer_email: string | null;
  published: boolean;
  received_at: string;
  created_at: string;
  updated_at: string;
  contact?: Contact | null;
  review_request?: ReviewRequest | null;
}

export interface ReputationSettings {
  organization_id: string;
  smart_threshold: number;
  default_channel: 'sms' | 'email';
  default_sms_template: string;
  default_email_template: string;
  default_email_subject: string;
  google_review_url: string | null;
  facebook_review_url: string | null;
  brand_name: string | null;
  brand_logo_url: string | null;
  brand_primary_color: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewFilters {
  provider?: ReviewProvider[];
  rating?: number[];
  linked?: boolean;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface ReviewRequestFilters {
  status?: ReviewRequestStatus[];
  channel?: ('sms' | 'email')[];
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface ReputationStats {
  avgRating: number;
  totalReviews: number;
  reviewsByProvider: Record<ReviewProvider, number>;
  ratingBreakdown: Record<number, number>;
  recentReviews: Review[];
  conversionRate: number;
  totalRequests: number;
  clickedRequests: number;
  completedRequests: number;
}

export interface CreateReviewRequestInput {
  contact_id: string;
  channel: 'sms' | 'email';
  message_template: string;
  provider_preference?: 'smart' | 'google' | 'facebook' | 'internal';
}

export interface CreateManualReviewInput {
  provider: ReviewProvider;
  contact_id?: string;
  rating: number;
  comment?: string;
  reviewer_name: string;
  reviewer_email?: string;
  received_at?: string;
}

export type DriveFileStatus = 'available' | 'unavailable' | 'deleted' | 'access_revoked';
export type FileAttachmentEntityType = 'contacts' | 'opportunities' | 'conversations' | 'forms' | 'social_posts' | 'invoices';

export interface DriveConnection {
  id: string;
  organization_id: string;
  email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expiry: string;
  scopes: string[];
  root_folder_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriveFolder {
  id: string;
  organization_id: string;
  drive_folder_id: string;
  name: string;
  parent_drive_folder_id: string | null;
  path: string;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface DriveFile {
  id: string;
  organization_id: string;
  drive_file_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  drive_owner_email: string | null;
  parent_drive_folder_id: string | null;
  thumbnail_url: string | null;
  web_view_link: string | null;
  icon_link: string | null;
  is_deleted: boolean;
  access_revoked: boolean;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface FileAttachment {
  id: string;
  organization_id: string;
  drive_file_id: string;
  entity_type: FileAttachmentEntityType;
  entity_id: string;
  attached_by: string;
  note: string | null;
  attached_at: string;
  drive_file?: DriveFile;
  attached_by_user?: User;
}

export interface DriveFilters {
  folderId?: string | null;
  mimeType?: string[];
  search?: string;
  showDeleted?: boolean;
  showUnavailable?: boolean;
}

export interface FileAttachmentFilters {
  entityType?: FileAttachmentEntityType;
  entityId?: string;
}

export interface DriveStats {
  totalFiles: number;
  totalFolders: number;
  availableFiles: number;
  unavailableFiles: number;
  totalAttachments: number;
}

export interface DriveConnectionStatus {
  connected: boolean;
  email: string | null;
  tokenExpired: boolean;
  lastSyncAt: string | null;
}

export type LLMProviderType = 'openai' | 'anthropic' | 'google' | 'custom';

export interface LLMProvider {
  id: string;
  org_id: string;
  provider: LLMProviderType;
  api_key_encrypted: string;
  base_url: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface LLMModel {
  id: string;
  org_id: string;
  provider_id: string;
  model_key: string;
  display_name: string;
  enabled: boolean;
  is_default: boolean;
  context_window: number | null;
  metadata: {
    cost_per_1k_input?: number;
    cost_per_1k_output?: number;
    capabilities?: string[];
  };
  created_at: string;
  updated_at: string;
  provider?: LLMProvider;
}

export interface ElevenLabsConnection {
  id: string;
  org_id: string;
  api_key_encrypted: string;
  enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ElevenLabsVoiceMetadata {
  accent?: string;
  age?: string;
  gender?: string;
  use_case?: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

export interface ElevenLabsVoice {
  id: string;
  org_id: string;
  voice_id: string;
  voice_name: string;
  enabled: boolean;
  is_default: boolean;
  metadata: ElevenLabsVoiceMetadata;
  created_at: string;
  updated_at: string;
}

export type KnowledgeStatus = 'active' | 'inactive';

export interface KnowledgeCollection {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: KnowledgeStatus;
  apply_to_all_agents: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  created_by_user?: User | null;
  latest_version?: KnowledgeVersion | null;
  agent_count?: number;
}

export interface KnowledgeVersion {
  id: string;
  collection_id: string;
  version_number: number;
  body_text: string | null;
  drive_file_ids: string[] | null;
  created_by: string | null;
  created_at: string;
  created_by_user?: User | null;
}

export interface KnowledgeEmbedding {
  id: string;
  collection_id: string;
  version_id: string;
  chunk_index: number;
  chunk_text: string;
  created_at: string;
}

export interface KnowledgeSearchResult {
  collection_id: string;
  collection_name: string;
  chunk_text: string;
  similarity: number;
}

export type PromptStatus = 'active' | 'inactive';
export type PromptCategory =
  | 'lead_qualification'
  | 'appointment_booking'
  | 'follow_up'
  | 'objection_handling'
  | 'internal_ops'
  | 'custom';

export interface PromptTemplate {
  id: string;
  org_id: string;
  name: string;
  category: PromptCategory;
  status: PromptStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  created_by_user?: User | null;
  latest_version?: PromptTemplateVersion | null;
  agent_count?: number;
}

export interface PromptTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  body: string;
  variables: string[];
  created_by: string | null;
  created_at: string;
  created_by_user?: User | null;
}

export interface AgentKnowledgeLink {
  agent_id: string;
  collection_id: string;
  created_at: string;
  collection?: KnowledgeCollection;
}

export interface AgentPromptLink {
  agent_id: string;
  template_id: string;
  sort_order: number;
  created_at: string;
  template?: PromptTemplate;
}

export interface AIAgentSettingsDefaults {
  org_id: string;
  default_model_id: string | null;
  default_allowed_tools: AIAgentToolName[];
  require_human_approval_default: boolean;
  max_outbound_per_run_default: number;
  created_at: string;
  updated_at: string;
  default_model?: LLMModel | null;
}

export interface AIAgentWithSettings extends AIAgent {
  model_id: string | null;
  require_human_approval: boolean;
  max_outbound_per_run: number;
  enable_memory: boolean;
  model?: LLMModel | null;
  knowledge_links?: AgentKnowledgeLink[];
  prompt_links?: AgentPromptLink[];
}

export interface LLMProviderFilters {
  enabled?: boolean;
}

export interface LLMModelFilters {
  providerId?: string;
  enabled?: boolean;
  search?: string;
}

export interface KnowledgeCollectionFilters {
  status?: KnowledgeStatus;
  applyToAllAgents?: boolean;
  search?: string;
}

export interface PromptTemplateFilters {
  status?: PromptStatus;
  category?: PromptCategory;
  search?: string;
}

export interface CreateLLMProviderInput {
  provider: LLMProviderType;
  api_key: string;
  base_url?: string;
  enabled?: boolean;
}

export interface UpdateLLMProviderInput {
  api_key?: string;
  base_url?: string;
  enabled?: boolean;
}

export interface CreateLLMModelInput {
  provider_id: string;
  model_key: string;
  display_name: string;
  enabled?: boolean;
  is_default?: boolean;
  context_window?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateLLMModelInput {
  display_name?: string;
  enabled?: boolean;
  is_default?: boolean;
  context_window?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateKnowledgeCollectionInput {
  name: string;
  description?: string;
  status?: KnowledgeStatus;
  apply_to_all_agents?: boolean;
  body_text?: string;
  drive_file_ids?: string[];
}

export interface UpdateKnowledgeCollectionInput {
  name?: string;
  description?: string;
  status?: KnowledgeStatus;
  apply_to_all_agents?: boolean;
}

export interface CreateKnowledgeVersionInput {
  body_text?: string;
  drive_file_ids?: string[];
}

export interface CreatePromptTemplateInput {
  name: string;
  category: PromptCategory;
  status?: PromptStatus;
  body: string;
}

export interface UpdatePromptTemplateInput {
  name?: string;
  category?: PromptCategory;
  status?: PromptStatus;
}

export interface CreatePromptVersionInput {
  body: string;
}

export interface UpdateAIAgentSettingsDefaultsInput {
  default_model_id?: string | null;
  default_allowed_tools?: AIAgentToolName[];
  require_human_approval_default?: boolean;
  max_outbound_per_run_default?: number;
}

export interface CreateAIAgentInput {
  name: string;
  description?: string;
  system_prompt: string;
  allowed_tools?: AIAgentToolName[];
  allowed_channels?: AIAgentChannel[];
  temperature?: number;
  max_tokens?: number;
  enabled?: boolean;
  model_id?: string;
  require_human_approval?: boolean;
  max_outbound_per_run?: number;
  enable_memory?: boolean;
  knowledge_collection_ids?: string[];
  prompt_template_ids?: string[];
}

export interface UpdateAIAgentInput {
  name?: string;
  description?: string;
  system_prompt?: string;
  allowed_tools?: AIAgentToolName[];
  allowed_channels?: AIAgentChannel[];
  temperature?: number;
  max_tokens?: number;
  enabled?: boolean;
  model_id?: string | null;
  require_human_approval?: boolean;
  max_outbound_per_run?: number;
  enable_memory?: boolean;
  knowledge_collection_ids?: string[];
  prompt_template_ids?: string[];
}

export interface AIToolDefinition {
  name: AIAgentToolName;
  displayName: string;
  description: string;
  category: 'read' | 'write' | 'calendar' | 'communication';
  parameters: AIToolParameter[];
}

export interface AIToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
}

export const AI_TOOL_DEFINITIONS: AIToolDefinition[] = [
  {
    name: 'get_contact',
    displayName: 'Get Contact Info',
    description: 'Retrieve contact details including name, email, phone, and custom fields',
    category: 'read',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true }
    ]
  },
  {
    name: 'get_timeline',
    displayName: 'Get Contact Timeline',
    description: 'Retrieve the activity timeline for a contact',
    category: 'read',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true },
      { name: 'limit', type: 'number', description: 'Max number of events', required: false }
    ]
  },
  {
    name: 'get_conversation_history',
    displayName: 'Get Conversation History',
    description: 'Retrieve message history from conversations with a contact',
    category: 'read',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true },
      { name: 'limit', type: 'number', description: 'Max number of messages', required: false }
    ]
  },
  {
    name: 'get_appointment_history',
    displayName: 'Get Appointment History',
    description: 'Retrieve past and upcoming appointments for a contact',
    category: 'read',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true }
    ]
  },
  {
    name: 'add_note',
    displayName: 'Add Note',
    description: 'Add a note to a contact record',
    category: 'write',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true },
      { name: 'content', type: 'string', description: 'The note content', required: true }
    ]
  },
  {
    name: 'update_field',
    displayName: 'Update Contact Field',
    description: 'Update a field on the contact record',
    category: 'write',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true },
      { name: 'field', type: 'string', description: 'Field name to update', required: true },
      { name: 'value', type: 'string', description: 'New value', required: true }
    ]
  },
  {
    name: 'add_tag',
    displayName: 'Add Tag',
    description: 'Add a tag to a contact',
    category: 'write',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true },
      { name: 'tag_id', type: 'string', description: 'The tag ID to add', required: true }
    ]
  },
  {
    name: 'remove_tag',
    displayName: 'Remove Tag',
    description: 'Remove a tag from a contact',
    category: 'write',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true },
      { name: 'tag_id', type: 'string', description: 'The tag ID to remove', required: true }
    ]
  },
  {
    name: 'assign_owner',
    displayName: 'Assign Owner',
    description: 'Assign a user as the owner of a contact',
    category: 'write',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true },
      { name: 'user_id', type: 'string', description: 'The user ID to assign', required: true }
    ]
  },
  {
    name: 'create_appointment',
    displayName: 'Create Appointment',
    description: 'Schedule an appointment with a contact',
    category: 'calendar',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true },
      { name: 'calendar_id', type: 'string', description: 'The calendar ID', required: true },
      { name: 'appointment_type_id', type: 'string', description: 'The appointment type', required: true },
      { name: 'start_time', type: 'string', description: 'Start time in ISO format', required: true }
    ]
  },
  {
    name: 'send_sms',
    displayName: 'Send SMS',
    description: 'Send an SMS message to a contact',
    category: 'communication',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true },
      { name: 'body', type: 'string', description: 'Message content', required: true }
    ]
  },
  {
    name: 'send_email',
    displayName: 'Send Email',
    description: 'Send an email to a contact',
    category: 'communication',
    parameters: [
      { name: 'contact_id', type: 'string', description: 'The contact ID', required: true },
      { name: 'subject', type: 'string', description: 'Email subject', required: true },
      { name: 'body', type: 'string', description: 'Email body', required: true }
    ]
  }
];

export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  lead_qualification: 'Lead Qualification',
  appointment_booking: 'Appointment Booking',
  follow_up: 'Follow-Up',
  objection_handling: 'Objection Handling',
  internal_ops: 'Internal Operations',
  custom: 'Custom'
};

export const LLM_PROVIDER_LABELS: Record<LLMProviderType, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI',
  custom: 'Custom'
};

export const COMMON_PROMPT_VARIABLES = [
  { key: 'contact_name', description: 'Full name of the contact' },
  { key: 'contact_first_name', description: 'First name of the contact' },
  { key: 'contact_email', description: 'Email address of the contact' },
  { key: 'contact_phone', description: 'Phone number of the contact' },
  { key: 'contact_company', description: 'Company name of the contact' },
  { key: 'last_message', description: 'Content of the last message' },
  { key: 'conversation_summary', description: 'Summary of conversation history' },
  { key: 'agent_name', description: 'Name of the AI agent' },
  { key: 'current_date', description: 'Current date' },
  { key: 'current_time', description: 'Current time' }
];

export type EmailProviderStatus = 'connected' | 'disconnected';
export type EmailDomainStatus = 'pending' | 'verified' | 'failed';

export interface EmailProvider {
  id: string;
  org_id: string;
  provider: string;
  account_nickname: string | null;
  status: EmailProviderStatus;
  created_at: string;
  updated_at: string;
}

export interface EmailDomainDnsRecord {
  type: string;
  host: string;
  value: string;
  valid?: boolean;
}

export interface EmailDomain {
  id: string;
  org_id: string;
  domain: string;
  sendgrid_domain_id: string | null;
  status: EmailDomainStatus;
  dns_records: EmailDomainDnsRecord[];
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailFromAddress {
  id: string;
  org_id: string;
  display_name: string;
  email: string;
  domain_id: string | null;
  reply_to: string | null;
  sendgrid_sender_id: string | null;
  is_default: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  domain?: EmailDomain | null;
}

export interface EmailUnsubscribeGroup {
  id: string;
  org_id: string;
  sendgrid_group_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailDefaults {
  org_id: string;
  default_from_address_id: string | null;
  default_reply_to: string | null;
  default_unsubscribe_group_id: string | null;
  track_opens: boolean;
  track_clicks: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailTestLog {
  id: string;
  org_id: string;
  sent_by: string;
  to_email: string;
  from_address_id: string | null;
  status: 'success' | 'failed';
  error_message: string | null;
  sendgrid_message_id: string | null;
  sent_at: string;
  from_address?: EmailFromAddress | null;
  sent_by_user?: User | null;
}

export interface EmailSetupStatus {
  isConfigured: boolean;
  providerConnected: boolean;
  verifiedDomainsCount: number;
  activeFromAddressesCount: number;
  hasDefaultFromAddress: boolean;
  hasDefaultUnsubscribeGroup: boolean;
  blockingReasons: string[];
}

export type PhoneProviderStatus = 'connected' | 'disconnected';
export type PhoneNumberStatus = 'active' | 'disabled';
export type SmsMode = 'number' | 'messaging_service';
export type RoutingStrategy = 'simultaneous' | 'sequential';

export interface PhoneNumberCapabilities {
  sms: boolean;
  mms: boolean;
  voice: boolean;
}

export interface TwilioConnection {
  id: string;
  accountSid: string;
  subaccountSid?: string;
  friendlyName?: string;
  status: PhoneProviderStatus;
  connectedAt?: string;
}

export interface TwilioNumber {
  id: string;
  org_id: string;
  phone_number: string;
  phone_sid: string;
  friendly_name?: string;
  capabilities: PhoneNumberCapabilities;
  country_code?: string;
  status: PhoneNumberStatus;
  is_default_sms: boolean;
  is_default_voice: boolean;
  department_id?: string;
  department?: Department;
  webhook_configured: boolean;
  created_at: string;
  updated_at: string;
}

export interface TwilioMessagingService {
  id: string;
  org_id: string;
  service_sid: string;
  name: string;
  description?: string;
  is_default: boolean;
  status: PhoneNumberStatus;
  a2p_registered: boolean;
  sender_count?: number;
  created_at: string;
  updated_at: string;
}

export interface MessagingServiceSender {
  id: string;
  service_id: string;
  number_id: string;
  number?: TwilioNumber;
  created_at: string;
}

export interface VoiceRoutingDestination {
  id: string;
  org_id: string;
  group_id: string;
  phone_number: string;
  label?: string;
  sort_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoiceRoutingGroup {
  id: string;
  org_id: string;
  name: string;
  strategy: RoutingStrategy;
  ring_timeout: number;
  fallback_number?: string;
  is_default: boolean;
  enabled: boolean;
  destinations?: VoiceRoutingDestination[];
  created_at: string;
  updated_at: string;
}

export interface PhoneSettings {
  id: string;
  org_id: string;
  default_sms_mode: SmsMode;
  default_sms_number_id?: string;
  default_messaging_service_id?: string;
  default_voice_number_id?: string;
  default_routing_group_id?: string;
  call_timeout: number;
  voicemail_fallback_number?: string;
  record_inbound_calls: boolean;
  record_outbound_calls: boolean;
  record_voicemail: boolean;
  recording_retention_days: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone: string;
  business_name?: string;
  opt_out_language: string;
  auto_append_opt_out: boolean;
  default_sms_number?: TwilioNumber;
  default_voice_number?: TwilioNumber;
  default_messaging_service?: TwilioMessagingService;
  default_routing_group?: VoiceRoutingGroup;
  created_at: string;
  updated_at: string;
}

export interface DncNumber {
  id: string;
  phoneNumber: string;
  reason?: string;
  source: 'manual' | 'contact';
  addedBy?: string;
  contactName?: string;
  createdAt?: string;
}

export interface PhoneTestLog {
  id: string;
  org_id: string;
  test_type: 'sms' | 'call';
  to_number: string;
  from_number: string;
  message_body?: string;
  status: string;
  twilio_sid?: string;
  error_message?: string;
  tested_by: string;
  tested_by_user?: User;
  created_at: string;
}

export interface WebhookHealth {
  webhook_type: 'sms' | 'voice' | 'status';
  last_received_at?: string;
  success_count: number;
  failure_count: number;
  last_error?: string;
}

export interface WebhookHealthStatus {
  lastReceived?: string;
  successCount: number;
  failureCount: number;
  failureRate: number;
  lastError?: string;
  status: 'healthy' | 'degraded' | 'never_received';
}

export interface PhoneSetupStatus {
  isConfigured: boolean;
  isConnected: boolean;
  activeNumbers: number;
  hasDefaultSms: boolean;
  hasDefaultVoice: boolean;
  webhookHealth: WebhookHealth[];
  blockingReasons: string[];
}

export interface PhoneSettingsResponse {
  settings: PhoneSettings | null;
  connection: TwilioConnection | null;
  numberCount: number;
  webhookHealth: WebhookHealth[];
  isConfigured: boolean;
  blockingReasons: string[];
}
