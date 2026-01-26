import type { FieldDefinition, FieldType, EntityType } from '../types/conditions';

export const FIELD_REGISTRY: FieldDefinition[] = [
  { key: 'contact.id', label: 'Contact ID', type: 'text', category: 'contact' },
  { key: 'contact.first_name', label: 'First Name', type: 'text', category: 'contact' },
  { key: 'contact.last_name', label: 'Last Name', type: 'text', category: 'contact' },
  { key: 'contact.full_name', label: 'Full Name', type: 'text', category: 'contact' },
  { key: 'contact.email', label: 'Email', type: 'email', category: 'contact' },
  { key: 'contact.phone', label: 'Phone', type: 'phone', category: 'contact' },
  { key: 'contact.company', label: 'Company', type: 'text', category: 'contact' },
  { key: 'contact.job_title', label: 'Job Title', type: 'text', category: 'contact' },
  { key: 'contact.source', label: 'Lead Source', type: 'select', category: 'contact', dynamicOptionsSource: 'lead_sources' },
  { key: 'contact.status', label: 'Contact Status', type: 'select', category: 'contact', options: [
    { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'unsubscribed', label: 'Unsubscribed' }
  ]},
  { key: 'contact.lead_score', label: 'Lead Score', type: 'number', category: 'contact' },
  { key: 'contact.lifetime_value', label: 'Lifetime Value', type: 'currency', category: 'contact' },
  { key: 'contact.owner_id', label: 'Contact Owner', type: 'user_reference', category: 'contact' },
  { key: 'contact.created_at', label: 'Created Date', type: 'datetime', category: 'contact' },
  { key: 'contact.updated_at', label: 'Last Updated', type: 'datetime', category: 'contact' },
  { key: 'contact.last_activity_at', label: 'Last Activity', type: 'datetime', category: 'contact' },
  { key: 'contact.tags', label: 'Tags', type: 'tags', category: 'contact' },
  { key: 'contact.city', label: 'City', type: 'text', category: 'contact' },
  { key: 'contact.state', label: 'State', type: 'text', category: 'contact' },
  { key: 'contact.country', label: 'Country', type: 'text', category: 'contact' },
  { key: 'contact.postal_code', label: 'Postal Code', type: 'text', category: 'contact' },

  { key: 'opportunity.id', label: 'Opportunity ID', type: 'text', category: 'opportunity' },
  { key: 'opportunity.name', label: 'Opportunity Name', type: 'text', category: 'opportunity' },
  { key: 'opportunity.status', label: 'Status', type: 'select', category: 'opportunity', options: [
    { value: 'open', label: 'Open' }, { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }, { value: 'abandoned', label: 'Abandoned' }
  ]},
  { key: 'opportunity.pipeline_id', label: 'Pipeline', type: 'select', category: 'opportunity', dynamicOptionsSource: 'pipelines' },
  { key: 'opportunity.stage_id', label: 'Stage', type: 'select', category: 'opportunity', dynamicOptionsSource: 'stages' },
  { key: 'opportunity.value_amount', label: 'Value', type: 'currency', category: 'opportunity' },
  { key: 'opportunity.probability', label: 'Probability', type: 'percentage', category: 'opportunity' },
  { key: 'opportunity.expected_close_date', label: 'Expected Close Date', type: 'date', category: 'opportunity' },
  { key: 'opportunity.owner_id', label: 'Owner', type: 'user_reference', category: 'opportunity' },
  { key: 'opportunity.contact_id', label: 'Contact', type: 'contact_reference', category: 'opportunity' },
  { key: 'opportunity.created_at', label: 'Created Date', type: 'datetime', category: 'opportunity' },
  { key: 'opportunity.days_in_stage', label: 'Days in Stage', type: 'number', category: 'opportunity' },
  { key: 'opportunity.lost_reason_id', label: 'Lost Reason', type: 'select', category: 'opportunity', dynamicOptionsSource: 'lost_reasons' },

  { key: 'appointment.id', label: 'Appointment ID', type: 'text', category: 'appointment' },
  { key: 'appointment.title', label: 'Title', type: 'text', category: 'appointment' },
  { key: 'appointment.status', label: 'Status', type: 'select', category: 'appointment', options: [
    { value: 'scheduled', label: 'Scheduled' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'completed', label: 'Completed' },
    { value: 'canceled', label: 'Canceled' }, { value: 'no_show', label: 'No Show' }, { value: 'rescheduled', label: 'Rescheduled' }
  ]},
  { key: 'appointment.type_id', label: 'Appointment Type', type: 'select', category: 'appointment', dynamicOptionsSource: 'appointment_types' },
  { key: 'appointment.start_at_utc', label: 'Start Time', type: 'datetime', category: 'appointment' },
  { key: 'appointment.end_at_utc', label: 'End Time', type: 'datetime', category: 'appointment' },
  { key: 'appointment.duration_minutes', label: 'Duration (minutes)', type: 'number', category: 'appointment' },
  { key: 'appointment.calendar_id', label: 'Calendar', type: 'select', category: 'appointment', dynamicOptionsSource: 'calendars' },
  { key: 'appointment.contact_id', label: 'Contact', type: 'contact_reference', category: 'appointment' },
  { key: 'appointment.assigned_user_id', label: 'Assigned User', type: 'user_reference', category: 'appointment' },

  { key: 'invoice.id', label: 'Invoice ID', type: 'text', category: 'invoice' },
  { key: 'invoice.invoice_number', label: 'Invoice Number', type: 'text', category: 'invoice' },
  { key: 'invoice.status', label: 'Status', type: 'select', category: 'invoice', options: [
    { value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }, { value: 'viewed', label: 'Viewed' },
    { value: 'paid', label: 'Paid' }, { value: 'partially_paid', label: 'Partially Paid' },
    { value: 'overdue', label: 'Overdue' }, { value: 'void', label: 'Void' }, { value: 'refunded', label: 'Refunded' }
  ]},
  { key: 'invoice.subtotal', label: 'Subtotal', type: 'currency', category: 'invoice' },
  { key: 'invoice.tax_amount', label: 'Tax Amount', type: 'currency', category: 'invoice' },
  { key: 'invoice.total', label: 'Total', type: 'currency', category: 'invoice' },
  { key: 'invoice.amount_paid', label: 'Amount Paid', type: 'currency', category: 'invoice' },
  { key: 'invoice.balance_due', label: 'Balance Due', type: 'currency', category: 'invoice' },
  { key: 'invoice.due_date', label: 'Due Date', type: 'date', category: 'invoice' },
  { key: 'invoice.contact_id', label: 'Contact', type: 'contact_reference', category: 'invoice' },

  { key: 'conversation.id', label: 'Conversation ID', type: 'text', category: 'conversation' },
  { key: 'conversation.channel', label: 'Channel', type: 'select', category: 'conversation', options: [
    { value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }, { value: 'webchat', label: 'Web Chat' },
    { value: 'facebook', label: 'Facebook' }, { value: 'instagram', label: 'Instagram' },
    { value: 'whatsapp', label: 'WhatsApp' }, { value: 'google_chat', label: 'Google Chat' }
  ]},
  { key: 'conversation.status', label: 'Status', type: 'select', category: 'conversation', options: [
    { value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }, { value: 'pending', label: 'Pending' }, { value: 'snoozed', label: 'Snoozed' }
  ]},
  { key: 'conversation.assigned_user_id', label: 'Assigned To', type: 'user_reference', category: 'conversation' },
  { key: 'conversation.contact_id', label: 'Contact', type: 'contact_reference', category: 'conversation' },
  { key: 'conversation.message_count', label: 'Message Count', type: 'number', category: 'conversation' },
  { key: 'conversation.last_message_at', label: 'Last Message', type: 'datetime', category: 'conversation' },
  { key: 'conversation.created_at', label: 'Started', type: 'datetime', category: 'conversation' },

  { key: 'form_submission.id', label: 'Submission ID', type: 'text', category: 'form_submission' },
  { key: 'form_submission.form_id', label: 'Form', type: 'select', category: 'form_submission', dynamicOptionsSource: 'forms' },
  { key: 'form_submission.contact_id', label: 'Contact', type: 'contact_reference', category: 'form_submission' },
  { key: 'form_submission.submitted_at', label: 'Submitted At', type: 'datetime', category: 'form_submission' },
  { key: 'form_submission.source_url', label: 'Source URL', type: 'url', category: 'form_submission' },

  { key: 'workflow.id', label: 'Workflow ID', type: 'text', category: 'workflow' },
  { key: 'workflow.name', label: 'Workflow Name', type: 'text', category: 'workflow' },
  { key: 'workflow.trigger_type', label: 'Trigger Type', type: 'select', category: 'workflow', options: [
    { value: 'manual', label: 'Manual' }, { value: 'event', label: 'Event' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'webhook', label: 'Webhook' }
  ]},
  { key: 'workflow.enrollment_count', label: 'Enrollment Count', type: 'number', category: 'workflow' },
  { key: 'workflow.is_active', label: 'Is Active', type: 'boolean', category: 'workflow' },

  { key: 'task.id', label: 'Task ID', type: 'text', category: 'task' },
  { key: 'task.title', label: 'Title', type: 'text', category: 'task' },
  { key: 'task.status', label: 'Status', type: 'select', category: 'task', options: [
    { value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }, { value: 'canceled', label: 'Canceled' }
  ]},
  { key: 'task.priority', label: 'Priority', type: 'select', category: 'task', options: [
    { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }
  ]},
  { key: 'task.due_date', label: 'Due Date', type: 'date', category: 'task' },
  { key: 'task.assigned_to', label: 'Assigned To', type: 'user_reference', category: 'task' },
];

export function getFieldsByCategory(category: EntityType): FieldDefinition[] {
  return FIELD_REGISTRY.filter(f => f.category === category && !f.deprecated);
}

export function getFieldByKey(key: string): FieldDefinition | undefined {
  return FIELD_REGISTRY.find(f => f.key === key);
}

export function getFieldCategories(): Array<{ key: EntityType; label: string }> {
  return [
    { key: 'contact', label: 'Contact' },
    { key: 'opportunity', label: 'Opportunity' },
    { key: 'appointment', label: 'Appointment' },
    { key: 'invoice', label: 'Invoice' },
    { key: 'conversation', label: 'Conversation' },
    { key: 'form_submission', label: 'Form Submission' },
    { key: 'workflow', label: 'Workflow' },
    { key: 'task', label: 'Task' },
    { key: 'custom_field', label: 'Custom Fields' },
  ];
}

export function searchFields(query: string, categories?: EntityType[]): FieldDefinition[] {
  const lowerQuery = query.toLowerCase();
  return FIELD_REGISTRY.filter(f => {
    if (f.deprecated) return false;
    if (categories && categories.length > 0 && !categories.includes(f.category)) return false;
    return f.key.toLowerCase().includes(lowerQuery) || f.label.toLowerCase().includes(lowerQuery) || f.description?.toLowerCase().includes(lowerQuery);
  });
}
