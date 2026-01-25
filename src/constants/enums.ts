export const EntityType = {
  CONTACT: 'contact',
  OPPORTUNITY: 'opportunity',
  APPOINTMENT: 'appointment',
  CONVERSATION: 'conversation',
  MESSAGE: 'message',
  INVOICE: 'invoice',
  PAYMENT: 'payment',
  FORM: 'form',
  FORM_SUBMISSION: 'form_submission',
  SURVEY: 'survey',
  SURVEY_SUBMISSION: 'survey_submission',
  WORKFLOW: 'workflow',
  WORKFLOW_ENROLLMENT: 'workflow_enrollment',
  AI_AGENT: 'ai_agent',
  AI_AGENT_RUN: 'ai_agent_run',
  CALENDAR: 'calendar',
  APPOINTMENT_TYPE: 'appointment_type',
  PIPELINE: 'pipeline',
  STAGE: 'stage',
  PRODUCT: 'product',
  PROPOSAL: 'proposal',
  REVIEW: 'review',
  REVIEW_REQUEST: 'review_request',
  SOCIAL_POST: 'social_post',
  SOCIAL_ACCOUNT: 'social_account',
  REPORT: 'report',
  USER: 'user',
  ROLE: 'role',
  DEPARTMENT: 'department',
  ORGANIZATION: 'organization',
  TAG: 'tag',
  CUSTOM_FIELD: 'custom_field',
  CUSTOM_VALUE: 'custom_value',
  INTEGRATION: 'integration',
  WEBHOOK: 'webhook',
  SCORING_MODEL: 'scoring_model',
  SCORING_RULE: 'scoring_rule',
  BRAND_KIT: 'brand_kit',
  BRAND_VOICE: 'brand_voice',
  KNOWLEDGE_COLLECTION: 'knowledge_collection',
  FILE: 'file',
  FOLDER: 'folder',
} as const;

export type EntityType = typeof EntityType[keyof typeof EntityType];

export const ChannelType = {
  SMS: 'sms',
  EMAIL: 'email',
  VOICE: 'voice',
  WEBCHAT: 'webchat',
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  WHATSAPP: 'whatsapp',
  LIVE_CHAT: 'live_chat',
} as const;

export type ChannelType = typeof ChannelType[keyof typeof ChannelType];

export const MessageStatus = {
  PENDING: 'pending',
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  BOUNCED: 'bounced',
  UNDELIVERED: 'undelivered',
} as const;

export type MessageStatus = typeof MessageStatus[keyof typeof MessageStatus];

export const MessageDirection = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export type MessageDirection = typeof MessageDirection[keyof typeof MessageDirection];

export const ContactStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  UNSUBSCRIBED: 'unsubscribed',
  BOUNCED: 'bounced',
  BLOCKED: 'blocked',
} as const;

export type ContactStatus = typeof ContactStatus[keyof typeof ContactStatus];

export const OpportunityStatus = {
  OPEN: 'open',
  WON: 'won',
  LOST: 'lost',
  ABANDONED: 'abandoned',
} as const;

export type OpportunityStatus = typeof OpportunityStatus[keyof typeof OpportunityStatus];

export const AppointmentStatus = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  RESCHEDULED: 'rescheduled',
} as const;

export type AppointmentStatus = typeof AppointmentStatus[keyof typeof AppointmentStatus];

export const InvoiceStatus = {
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  PAID: 'paid',
  PARTIALLY_PAID: 'partially_paid',
  OVERDUE: 'overdue',
  VOID: 'void',
  REFUNDED: 'refunded',
} as const;

export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export const PaymentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const;

export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus];

export const WorkflowStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
} as const;

export type WorkflowStatus = typeof WorkflowStatus[keyof typeof WorkflowStatus];

export const EnrollmentStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
} as const;

export type EnrollmentStatus = typeof EnrollmentStatus[keyof typeof EnrollmentStatus];

export const FormStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type FormStatus = typeof FormStatus[keyof typeof FormStatus];

export const SurveyStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
} as const;

export type SurveyStatus = typeof SurveyStatus[keyof typeof SurveyStatus];

export const ProposalStatus = {
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CONVERTED: 'converted',
} as const;

export type ProposalStatus = typeof ProposalStatus[keyof typeof ProposalStatus];

export const ReviewRequestStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  CLICKED: 'clicked',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
} as const;

export type ReviewRequestStatus = typeof ReviewRequestStatus[keyof typeof ReviewRequestStatus];

export const SocialPostStatus = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  DELETED: 'deleted',
} as const;

export type SocialPostStatus = typeof SocialPostStatus[keyof typeof SocialPostStatus];

export const IntegrationStatus = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  PENDING: 'pending',
  EXPIRED: 'expired',
} as const;

export type IntegrationStatus = typeof IntegrationStatus[keyof typeof IntegrationStatus];

export const CustomFieldType = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  CURRENCY: 'currency',
  DATE: 'date',
  DATETIME: 'datetime',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  EMAIL: 'email',
  PHONE: 'phone',
  URL: 'url',
  FILE: 'file',
  SIGNATURE: 'signature',
  RATING: 'rating',
  SLIDER: 'slider',
  COLOR: 'color',
} as const;

export type CustomFieldType = typeof CustomFieldType[keyof typeof CustomFieldType];

export const ConversationStatus = {
  OPEN: 'open',
  CLOSED: 'closed',
  SNOOZED: 'snoozed',
  PENDING: 'pending',
} as const;

export type ConversationStatus = typeof ConversationStatus[keyof typeof ConversationStatus];

export const CallDirection = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export type CallDirection = typeof CallDirection[keyof typeof CallDirection];

export const CallStatus = {
  INITIATED: 'initiated',
  RINGING: 'ringing',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  BUSY: 'busy',
  NO_ANSWER: 'no_answer',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type CallStatus = typeof CallStatus[keyof typeof CallStatus];
