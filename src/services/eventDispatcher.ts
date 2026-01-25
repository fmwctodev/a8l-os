import { supabase } from '../lib/supabase';
import type { WorkflowTriggerType, ActivityEventType, AuditActionType, WebhookEventType } from '../constants/eventTypes';
import type { EntityType } from '../constants/enums';

interface EventOptions {
  skipWorkflow?: boolean;
  skipActivity?: boolean;
  skipAudit?: boolean;
  skipWebhook?: boolean;
  userId?: string;
  metadata?: Record<string, unknown>;
}

interface EventPayload {
  entityType: EntityType;
  entityId: string;
  orgId: string;
  data?: Record<string, unknown>;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

interface EventRouting {
  workflowTrigger?: WorkflowTriggerType;
  activityEvent?: ActivityEventType;
  auditAction?: AuditActionType;
  webhookEvent?: WebhookEventType;
}

const eventRoutingMap: Record<string, EventRouting> = {
  'contact.created': {
    workflowTrigger: 'contact_created',
    activityEvent: 'status_changed',
    auditAction: 'create',
    webhookEvent: 'contact.created',
  },
  'contact.updated': {
    workflowTrigger: 'contact_updated',
    activityEvent: 'field_updated',
    auditAction: 'update',
    webhookEvent: 'contact.updated',
  },
  'contact.deleted': {
    auditAction: 'delete',
    webhookEvent: 'contact.deleted',
  },
  'contact.tag_added': {
    workflowTrigger: 'contact_tag_added',
    activityEvent: 'tag_added',
  },
  'contact.tag_removed': {
    workflowTrigger: 'contact_tag_removed',
    activityEvent: 'tag_removed',
  },
  'contact.status_changed': {
    workflowTrigger: 'contact_status_changed',
    activityEvent: 'status_changed',
  },
  'contact.owner_assigned': {
    workflowTrigger: 'contact_owner_assigned',
    activityEvent: 'owner_changed',
  },

  'opportunity.created': {
    workflowTrigger: 'opportunity_created',
    auditAction: 'create',
    webhookEvent: 'opportunity.created',
  },
  'opportunity.updated': {
    workflowTrigger: 'opportunity_updated',
    auditAction: 'update',
    webhookEvent: 'opportunity.updated',
  },
  'opportunity.stage_changed': {
    workflowTrigger: 'opportunity_stage_changed',
    activityEvent: 'status_changed',
  },
  'opportunity.won': {
    workflowTrigger: 'opportunity_won',
    webhookEvent: 'opportunity.won',
  },
  'opportunity.lost': {
    workflowTrigger: 'opportunity_lost',
    webhookEvent: 'opportunity.lost',
  },
  'opportunity.deleted': {
    auditAction: 'delete',
    webhookEvent: 'opportunity.deleted',
  },

  'appointment.booked': {
    workflowTrigger: 'appointment_booked',
    activityEvent: 'meeting_scheduled',
    webhookEvent: 'appointment.booked',
  },
  'appointment.confirmed': {
    workflowTrigger: 'appointment_confirmed',
    webhookEvent: 'appointment.confirmed',
  },
  'appointment.cancelled': {
    workflowTrigger: 'appointment_cancelled',
    activityEvent: 'meeting_cancelled',
    webhookEvent: 'appointment.cancelled',
  },
  'appointment.rescheduled': {
    workflowTrigger: 'appointment_rescheduled',
  },
  'appointment.completed': {
    workflowTrigger: 'appointment_completed',
    activityEvent: 'meeting_completed',
    webhookEvent: 'appointment.completed',
  },
  'appointment.no_show': {
    workflowTrigger: 'appointment_no_show',
  },

  'message.sent': {
    workflowTrigger: 'message_sent',
  },
  'message.received': {
    workflowTrigger: 'message_received',
  },
  'conversation.opened': {
    workflowTrigger: 'conversation_opened',
  },
  'conversation.closed': {
    workflowTrigger: 'conversation_closed',
  },

  'email.sent': {
    activityEvent: 'email_sent',
    auditAction: 'send',
  },
  'email.received': {
    activityEvent: 'email_received',
  },
  'email.bounced': {
    activityEvent: 'email_bounced',
  },

  'sms.sent': {
    activityEvent: 'sms_sent',
    auditAction: 'send',
  },
  'sms.received': {
    activityEvent: 'sms_received',
  },

  'call.initiated': {
    activityEvent: 'call_initiated',
  },
  'call.completed': {
    activityEvent: 'call_completed',
  },

  'form.submitted': {
    workflowTrigger: 'form_submitted',
    webhookEvent: 'form.submitted',
  },
  'survey.submitted': {
    workflowTrigger: 'survey_submitted',
    webhookEvent: 'survey.completed',
  },

  'invoice.created': {
    auditAction: 'create',
    webhookEvent: 'invoice.created',
  },
  'invoice.sent': {
    workflowTrigger: 'invoice_sent',
    auditAction: 'send',
    webhookEvent: 'invoice.sent',
  },
  'invoice.paid': {
    workflowTrigger: 'invoice_paid',
    webhookEvent: 'invoice.paid',
  },
  'invoice.overdue': {
    workflowTrigger: 'invoice_overdue',
  },
  'invoice.voided': {
    auditAction: 'update',
    webhookEvent: 'invoice.voided',
  },

  'payment.received': {
    workflowTrigger: 'payment_received',
    webhookEvent: 'payment.received',
  },

  'proposal.sent': {
    workflowTrigger: 'proposal_sent',
    auditAction: 'send',
    webhookEvent: 'proposal.sent',
  },
  'proposal.viewed': {
    workflowTrigger: 'proposal_viewed',
  },
  'proposal.accepted': {
    workflowTrigger: 'proposal_accepted',
    webhookEvent: 'proposal.accepted',
  },
  'proposal.declined': {
    workflowTrigger: 'proposal_declined',
    webhookEvent: 'proposal.declined',
  },

  'review.received': {
    workflowTrigger: 'review_received',
    webhookEvent: 'review.received',
  },
  'review_request.sent': {
    workflowTrigger: 'review_request_sent',
  },
  'review_request.clicked': {
    workflowTrigger: 'review_request_clicked',
  },

  'note.added': {
    activityEvent: 'note_added',
  },
  'note.updated': {
    activityEvent: 'note_updated',
  },
  'note.deleted': {
    activityEvent: 'note_deleted',
  },

  'task.created': {
    activityEvent: 'task_created',
  },
  'task.completed': {
    activityEvent: 'task_completed',
  },

  'file.uploaded': {
    activityEvent: 'file_uploaded',
  },
  'file.deleted': {
    activityEvent: 'file_deleted',
  },

  'workflow.enrolled': {
    activityEvent: 'workflow_enrolled',
  },
  'workflow.completed': {
    activityEvent: 'workflow_completed',
  },

  'ai_agent.run': {
    activityEvent: 'ai_agent_run',
  },
  'ai_draft.created': {
    activityEvent: 'ai_draft_created',
  },

  'score.adjusted': {
    activityEvent: 'score_adjusted',
  },
  'score.threshold_reached': {
    workflowTrigger: 'score_threshold_reached',
  },
};

export async function emitEvent(
  eventKey: string,
  payload: EventPayload,
  options: EventOptions = {}
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  const routing = eventRoutingMap[eventKey];

  if (!routing) {
    console.warn(`Unknown event key: ${eventKey}`);
    return { success: true, errors: [] };
  }

  const promises: Promise<void>[] = [];

  if (routing.workflowTrigger && !options.skipWorkflow) {
    promises.push(
      publishToEventOutbox(routing.workflowTrigger, payload, options)
        .catch(err => { errors.push(`EventOutbox: ${err.message}`); })
    );
  }

  if (routing.activityEvent && !options.skipActivity) {
    promises.push(
      logToActivityTimeline(routing.activityEvent, payload, options)
        .catch(err => { errors.push(`ActivityLog: ${err.message}`); })
    );
  }

  if (routing.auditAction && !options.skipAudit) {
    promises.push(
      createAuditEntry(routing.auditAction, payload, options)
        .catch(err => { errors.push(`Audit: ${err.message}`); })
    );
  }

  if (routing.webhookEvent && !options.skipWebhook) {
    promises.push(
      queueWebhookDelivery(routing.webhookEvent, payload, options)
        .catch(err => { errors.push(`Webhook: ${err.message}`); })
    );
  }

  await Promise.all(promises);

  return {
    success: errors.length === 0,
    errors,
  };
}

async function publishToEventOutbox(
  triggerType: WorkflowTriggerType,
  payload: EventPayload,
  options: EventOptions
): Promise<void> {
  const { error } = await supabase.from('event_outbox').insert({
    org_id: payload.orgId,
    event_type: triggerType,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    payload: {
      ...payload.data,
      old_data: payload.oldData,
      new_data: payload.newData,
      metadata: options.metadata,
    },
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function logToActivityTimeline(
  eventType: ActivityEventType,
  payload: EventPayload,
  options: EventOptions
): Promise<void> {
  const timelineTable = getTimelineTable(payload.entityType);
  if (!timelineTable) {
    return;
  }

  const { error } = await supabase.from(timelineTable).insert({
    [`${payload.entityType}_id`]: payload.entityId,
    user_id: options.userId || null,
    event_type: eventType,
    event_data: {
      ...payload.data,
      metadata: options.metadata,
    },
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function createAuditEntry(
  action: AuditActionType,
  payload: EventPayload,
  options: EventOptions
): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    org_id: payload.orgId,
    user_id: options.userId || null,
    action,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    old_data: payload.oldData || null,
    new_data: payload.newData || null,
    metadata: options.metadata || null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function queueWebhookDelivery(
  eventType: WebhookEventType,
  payload: EventPayload,
  options: EventOptions
): Promise<void> {
  const { data: webhooks, error: fetchError } = await supabase
    .from('webhooks')
    .select('id, url, secret, headers')
    .eq('org_id', payload.orgId)
    .eq('active', true)
    .contains('events', [eventType]);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!webhooks || webhooks.length === 0) {
    return;
  }

  const deliveries = webhooks.map(webhook => ({
    org_id: payload.orgId,
    webhook_id: webhook.id,
    event_type: eventType,
    payload: {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: {
        entity_type: payload.entityType,
        entity_id: payload.entityId,
        ...payload.data,
      },
    },
    status: 'pending',
    attempts: 0,
    created_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase
    .from('webhook_deliveries')
    .insert(deliveries);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

function getTimelineTable(entityType: EntityType): string | null {
  const timelineTableMap: Record<string, string> = {
    contact: 'contact_timeline',
    opportunity: 'opportunity_timeline',
  };
  return timelineTableMap[entityType] || null;
}

export async function emitContactEvent(
  eventKey: string,
  contactId: string,
  orgId: string,
  data?: Record<string, unknown>,
  options?: EventOptions
): Promise<{ success: boolean; errors: string[] }> {
  return emitEvent(eventKey, {
    entityType: 'contact',
    entityId: contactId,
    orgId,
    data,
  }, options);
}

export async function emitOpportunityEvent(
  eventKey: string,
  opportunityId: string,
  orgId: string,
  data?: Record<string, unknown>,
  options?: EventOptions
): Promise<{ success: boolean; errors: string[] }> {
  return emitEvent(eventKey, {
    entityType: 'opportunity',
    entityId: opportunityId,
    orgId,
    data,
  }, options);
}

export async function emitAppointmentEvent(
  eventKey: string,
  appointmentId: string,
  orgId: string,
  data?: Record<string, unknown>,
  options?: EventOptions
): Promise<{ success: boolean; errors: string[] }> {
  return emitEvent(eventKey, {
    entityType: 'appointment',
    entityId: appointmentId,
    orgId,
    data,
  }, options);
}

export async function emitInvoiceEvent(
  eventKey: string,
  invoiceId: string,
  orgId: string,
  data?: Record<string, unknown>,
  options?: EventOptions
): Promise<{ success: boolean; errors: string[] }> {
  return emitEvent(eventKey, {
    entityType: 'invoice',
    entityId: invoiceId,
    orgId,
    data,
  }, options);
}

export async function emitProposalEvent(
  eventKey: string,
  proposalId: string,
  orgId: string,
  data?: Record<string, unknown>,
  options?: EventOptions
): Promise<{ success: boolean; errors: string[] }> {
  return emitEvent(eventKey, {
    entityType: 'proposal',
    entityId: proposalId,
    orgId,
    data,
  }, options);
}

export function getAvailableEventKeys(): string[] {
  return Object.keys(eventRoutingMap);
}

export function getEventRouting(eventKey: string): EventRouting | null {
  return eventRoutingMap[eventKey] || null;
}
