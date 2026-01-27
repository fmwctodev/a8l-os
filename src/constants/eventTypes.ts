export const WorkflowTriggerType = {
  CONTACT_CREATED: 'contact_created',
  CONTACT_UPDATED: 'contact_updated',
  CONTACT_TAG_ADDED: 'contact_tag_added',
  CONTACT_TAG_REMOVED: 'contact_tag_removed',
  CONTACT_STATUS_CHANGED: 'contact_status_changed',
  CONTACT_OWNER_ASSIGNED: 'contact_owner_assigned',

  OPPORTUNITY_CREATED: 'opportunity_created',
  OPPORTUNITY_UPDATED: 'opportunity_updated',
  OPPORTUNITY_STAGE_CHANGED: 'opportunity_stage_changed',
  OPPORTUNITY_WON: 'opportunity_won',
  OPPORTUNITY_LOST: 'opportunity_lost',
  OPPORTUNITY_VALUE_CHANGED: 'opportunity_value_changed',

  APPOINTMENT_BOOKED: 'appointment_booked',
  APPOINTMENT_CONFIRMED: 'appointment_confirmed',
  APPOINTMENT_CANCELLED: 'appointment_cancelled',
  APPOINTMENT_RESCHEDULED: 'appointment_rescheduled',
  APPOINTMENT_COMPLETED: 'appointment_completed',
  APPOINTMENT_NO_SHOW: 'appointment_no_show',

  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_SENT: 'message_sent',
  CONVERSATION_OPENED: 'conversation_opened',
  CONVERSATION_CLOSED: 'conversation_closed',

  FORM_SUBMITTED: 'form_submitted',
  SURVEY_SUBMITTED: 'survey_submitted',

  INVOICE_SENT: 'invoice_sent',
  INVOICE_PAID: 'invoice_paid',
  INVOICE_OVERDUE: 'invoice_overdue',
  PAYMENT_RECEIVED: 'payment_received',

  REVIEW_RECEIVED: 'review_received',
  REVIEW_POSITIVE_RECEIVED: 'review_positive_received',
  REVIEW_NEGATIVE_RECEIVED: 'review_negative_received',
  REVIEW_REQUEST_SENT: 'review_request_sent',
  REVIEW_REQUEST_CLICKED: 'review_request_clicked',
  REVIEW_REPLIED: 'review_replied',
  REVIEW_FLAGGED_SPAM: 'review_flagged_spam',

  PROPOSAL_SENT: 'proposal_sent',
  PROPOSAL_VIEWED: 'proposal_viewed',
  PROPOSAL_ACCEPTED: 'proposal_accepted',
  PROPOSAL_DECLINED: 'proposal_declined',

  SCORE_THRESHOLD_REACHED: 'score_threshold_reached',
  SCORE_DECAY_APPLIED: 'score_decay_applied',

  MANUAL_TRIGGER: 'manual_trigger',
  SCHEDULED_TRIGGER: 'scheduled_trigger',
  WEBHOOK_RECEIVED: 'webhook_received',
  API_TRIGGER: 'api_trigger',
} as const;

export type WorkflowTriggerType = typeof WorkflowTriggerType[keyof typeof WorkflowTriggerType];

export const ActivityEventType = {
  NOTE_ADDED: 'note_added',
  NOTE_UPDATED: 'note_updated',
  NOTE_DELETED: 'note_deleted',

  TASK_CREATED: 'task_created',
  TASK_COMPLETED: 'task_completed',
  TASK_UPDATED: 'task_updated',

  EMAIL_SENT: 'email_sent',
  EMAIL_RECEIVED: 'email_received',
  EMAIL_OPENED: 'email_opened',
  EMAIL_CLICKED: 'email_clicked',
  EMAIL_BOUNCED: 'email_bounced',

  SMS_SENT: 'sms_sent',
  SMS_RECEIVED: 'sms_received',
  SMS_DELIVERED: 'sms_delivered',
  SMS_FAILED: 'sms_failed',

  CALL_INITIATED: 'call_initiated',
  CALL_COMPLETED: 'call_completed',
  CALL_MISSED: 'call_missed',
  VOICEMAIL_RECEIVED: 'voicemail_received',

  WEBCHAT_MESSAGE_SENT: 'webchat_message_sent',
  WEBCHAT_MESSAGE_RECEIVED: 'webchat_message_received',

  STATUS_CHANGED: 'status_changed',
  OWNER_CHANGED: 'owner_changed',
  TAG_ADDED: 'tag_added',
  TAG_REMOVED: 'tag_removed',
  FIELD_UPDATED: 'field_updated',

  FILE_UPLOADED: 'file_uploaded',
  FILE_DELETED: 'file_deleted',

  MEETING_SCHEDULED: 'meeting_scheduled',
  MEETING_COMPLETED: 'meeting_completed',
  MEETING_CANCELLED: 'meeting_cancelled',

  WORKFLOW_ENROLLED: 'workflow_enrolled',
  WORKFLOW_COMPLETED: 'workflow_completed',
  WORKFLOW_STEP_EXECUTED: 'workflow_step_executed',

  AI_AGENT_RUN: 'ai_agent_run',
  AI_DRAFT_CREATED: 'ai_draft_created',

  SCORE_ADJUSTED: 'score_adjusted',
  SCORE_RULE_TRIGGERED: 'score_rule_triggered',

  REVIEW_SUBMITTED: 'review_submitted',
  REVIEW_REPLIED: 'review_replied',
  REVIEW_HIDDEN: 'review_hidden',
  REVIEW_SPAM_FLAGGED: 'review_spam_flagged',
  REVIEW_AI_ANALYZED: 'review_ai_analyzed',
  NEGATIVE_FEEDBACK_RECEIVED: 'negative_feedback_received',

  LINK_CREATED: 'link_created',
  LINK_REMOVED: 'link_removed',

  CUSTOM_EVENT: 'custom_event',
} as const;

export type ActivityEventType = typeof ActivityEventType[keyof typeof ActivityEventType];

export const AuditActionType = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  EXPORT: 'export',
  IMPORT: 'import',
  SEND: 'send',
  APPROVE: 'approve',
  REJECT: 'reject',
  PUBLISH: 'publish',
  UNPUBLISH: 'unpublish',
  ARCHIVE: 'archive',
  RESTORE: 'restore',
  ENABLE: 'enable',
  DISABLE: 'disable',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  INVITE: 'invite',
  REVOKE: 'revoke',
  RESET: 'reset',
  CONFIGURE: 'configure',
  EXECUTE: 'execute',
  SCHEDULE: 'schedule',
  CANCEL: 'cancel',
} as const;

export type AuditActionType = typeof AuditActionType[keyof typeof AuditActionType];

export const WebhookEventType = {
  CONTACT_CREATED: 'contact.created',
  CONTACT_UPDATED: 'contact.updated',
  CONTACT_DELETED: 'contact.deleted',

  OPPORTUNITY_CREATED: 'opportunity.created',
  OPPORTUNITY_UPDATED: 'opportunity.updated',
  OPPORTUNITY_WON: 'opportunity.won',
  OPPORTUNITY_LOST: 'opportunity.lost',
  OPPORTUNITY_DELETED: 'opportunity.deleted',

  APPOINTMENT_BOOKED: 'appointment.booked',
  APPOINTMENT_CONFIRMED: 'appointment.confirmed',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  APPOINTMENT_COMPLETED: 'appointment.completed',

  INVOICE_CREATED: 'invoice.created',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_VOIDED: 'invoice.voided',

  PAYMENT_RECEIVED: 'payment.received',
  PAYMENT_REFUNDED: 'payment.refunded',

  FORM_SUBMITTED: 'form.submitted',
  SURVEY_COMPLETED: 'survey.completed',

  PROPOSAL_SENT: 'proposal.sent',
  PROPOSAL_ACCEPTED: 'proposal.accepted',
  PROPOSAL_DECLINED: 'proposal.declined',

  REVIEW_RECEIVED: 'review.received',
  REVIEW_POSITIVE: 'review.positive',
  REVIEW_NEGATIVE: 'review.negative',
  REVIEW_REPLIED: 'review.replied',
  REVIEW_SPAM_FLAGGED: 'review.spam_flagged',
} as const;

export type WebhookEventType = typeof WebhookEventType[keyof typeof WebhookEventType];

export const ALL_WORKFLOW_TRIGGERS = Object.values(WorkflowTriggerType);
export const ALL_ACTIVITY_EVENTS = Object.values(ActivityEventType);
export const ALL_AUDIT_ACTIONS = Object.values(AuditActionType);
export const ALL_WEBHOOK_EVENTS = Object.values(WebhookEventType);
