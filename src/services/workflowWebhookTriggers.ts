import { supabase } from '../lib/supabase';
import type { ReEnrollmentPolicy } from './workflowScheduledTriggers';

export type WebhookContactIdentifier = 'email' | 'phone' | 'external_id' | 'custom';

export interface PayloadMapping {
  sourceField: string;
  targetField: string;
}

export interface WorkflowWebhookTrigger {
  id: string;
  org_id: string;
  workflow_id: string;
  name: string;
  token: string;
  secret_hash: string | null;
  contact_identifier_field: WebhookContactIdentifier;
  contact_identifier_path: string;
  payload_mapping: PayloadMapping[];
  create_contact_if_missing: boolean;
  update_existing_contact: boolean;
  re_enrollment_policy: ReEnrollmentPolicy;
  is_active: boolean;
  request_count: number;
  last_request_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookRequest {
  id: string;
  org_id: string;
  trigger_id: string;
  request_payload: Record<string, unknown>;
  items_received: number;
  contacts_created: number;
  contacts_updated: number;
  enrollments_created: number;
  status: string;
  error_details: { errors?: Array<{ index: number; error: string }> } | null;
  ip_address: string | null;
  user_agent: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface CreateWebhookTriggerInput {
  workflow_id: string;
  name: string;
  contact_identifier_field?: WebhookContactIdentifier;
  contact_identifier_path?: string;
  payload_mapping?: PayloadMapping[];
  create_contact_if_missing?: boolean;
  update_existing_contact?: boolean;
  re_enrollment_policy?: ReEnrollmentPolicy;
  enable_signature_validation?: boolean;
}

export interface UpdateWebhookTriggerInput {
  name?: string;
  contact_identifier_field?: WebhookContactIdentifier;
  contact_identifier_path?: string;
  payload_mapping?: PayloadMapping[];
  create_contact_if_missing?: boolean;
  update_existing_contact?: boolean;
  re_enrollment_policy?: ReEnrollmentPolicy;
  is_active?: boolean;
}

function generateSecureToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createWebhookTrigger(
  orgId: string,
  input: CreateWebhookTriggerInput
): Promise<WorkflowWebhookTrigger & { secret?: string }> {
  const token = generateSecureToken(32);
  let secretHash: string | null = null;
  let secret: string | undefined;

  if (input.enable_signature_validation) {
    secret = generateSecureToken(32);
    secretHash = secret;
  }

  const { data, error } = await supabase
    .from('workflow_webhook_triggers')
    .insert({
      org_id: orgId,
      workflow_id: input.workflow_id,
      name: input.name,
      token,
      secret_hash: secretHash,
      contact_identifier_field: input.contact_identifier_field || 'email',
      contact_identifier_path: input.contact_identifier_path || 'email',
      payload_mapping: input.payload_mapping || [],
      create_contact_if_missing: input.create_contact_if_missing ?? true,
      update_existing_contact: input.update_existing_contact ?? true,
      re_enrollment_policy: input.re_enrollment_policy || 'never',
      is_active: false,
    })
    .select()
    .single();

  if (error) throw error;

  return secret ? { ...data, secret } : data;
}

export async function updateWebhookTrigger(
  triggerId: string,
  input: UpdateWebhookTriggerInput
): Promise<WorkflowWebhookTrigger> {
  const { data, error } = await supabase
    .from('workflow_webhook_triggers')
    .update(input)
    .eq('id', triggerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWebhookTrigger(triggerId: string): Promise<void> {
  const { error } = await supabase
    .from('workflow_webhook_triggers')
    .delete()
    .eq('id', triggerId);

  if (error) throw error;
}

export async function getWebhookTrigger(triggerId: string): Promise<WorkflowWebhookTrigger | null> {
  const { data, error } = await supabase
    .from('workflow_webhook_triggers')
    .select('*')
    .eq('id', triggerId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getWebhookTriggersForWorkflow(
  workflowId: string
): Promise<WorkflowWebhookTrigger[]> {
  const { data, error } = await supabase
    .from('workflow_webhook_triggers')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function regenerateWebhookToken(
  triggerId: string
): Promise<{ token: string }> {
  const newToken = generateSecureToken(32);

  const { error } = await supabase
    .from('workflow_webhook_triggers')
    .update({ token: newToken })
    .eq('id', triggerId);

  if (error) throw error;
  return { token: newToken };
}

export async function regenerateWebhookSecret(
  triggerId: string
): Promise<{ secret: string }> {
  const newSecret = generateSecureToken(32);

  const { error } = await supabase
    .from('workflow_webhook_triggers')
    .update({ secret_hash: newSecret })
    .eq('id', triggerId);

  if (error) throw error;
  return { secret: newSecret };
}

export async function enableSignatureValidation(
  triggerId: string
): Promise<{ secret: string }> {
  const secret = generateSecureToken(32);

  const { error } = await supabase
    .from('workflow_webhook_triggers')
    .update({ secret_hash: secret })
    .eq('id', triggerId);

  if (error) throw error;
  return { secret };
}

export async function disableSignatureValidation(triggerId: string): Promise<void> {
  const { error } = await supabase
    .from('workflow_webhook_triggers')
    .update({ secret_hash: null })
    .eq('id', triggerId);

  if (error) throw error;
}

export function getWebhookUrl(trigger: WorkflowWebhookTrigger): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/workflow-webhook-receiver/${trigger.token}`;
}

export async function getWebhookRequestHistory(
  triggerId: string,
  limit = 20,
  offset = 0
): Promise<WebhookRequest[]> {
  const { data, error } = await supabase
    .from('workflow_webhook_requests')
    .select('*')
    .eq('trigger_id', triggerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export async function getWebhookStats(triggerId: string): Promise<{
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_contacts_created: number;
  total_contacts_updated: number;
  total_enrollments: number;
  last_request_at: string | null;
}> {
  const { data: trigger } = await supabase
    .from('workflow_webhook_triggers')
    .select('request_count, last_request_at')
    .eq('id', triggerId)
    .single();

  const { data: requests } = await supabase
    .from('workflow_webhook_requests')
    .select('status, contacts_created, contacts_updated, enrollments_created')
    .eq('trigger_id', triggerId);

  const stats = {
    total_requests: trigger?.request_count || 0,
    successful_requests: 0,
    failed_requests: 0,
    total_contacts_created: 0,
    total_contacts_updated: 0,
    total_enrollments: 0,
    last_request_at: trigger?.last_request_at || null,
  };

  for (const req of requests || []) {
    if (req.status === 'success') stats.successful_requests++;
    if (req.status === 'failed') stats.failed_requests++;
    stats.total_contacts_created += req.contacts_created || 0;
    stats.total_contacts_updated += req.contacts_updated || 0;
    stats.total_enrollments += req.enrollments_created || 0;
  }

  return stats;
}

export async function testWebhookTrigger(
  triggerId: string,
  samplePayload: Record<string, unknown>
): Promise<{
  success: boolean;
  contact_identifier_found: boolean;
  identifier_value: unknown;
  mapped_fields: Record<string, unknown>;
  validation_errors: string[];
}> {
  const { data: trigger } = await supabase
    .from('workflow_webhook_triggers')
    .select('*')
    .eq('id', triggerId)
    .single();

  if (!trigger) {
    return {
      success: false,
      contact_identifier_found: false,
      identifier_value: null,
      mapped_fields: {},
      validation_errors: ['Trigger not found'],
    };
  }

  const errors: string[] = [];
  const identifierValue = getNestedValue(samplePayload, trigger.contact_identifier_path);

  if (!identifierValue) {
    errors.push(`Contact identifier not found at path: ${trigger.contact_identifier_path}`);
  }

  const mappedFields: Record<string, unknown> = {};
  for (const mapping of trigger.payload_mapping || []) {
    const value = getNestedValue(samplePayload, mapping.sourceField);
    if (value !== undefined) {
      mappedFields[mapping.targetField] = value;
    } else {
      errors.push(`Field not found at path: ${mapping.sourceField}`);
    }
  }

  return {
    success: errors.length === 0,
    contact_identifier_found: !!identifierValue,
    identifier_value: identifierValue,
    mapped_fields: mappedFields,
    validation_errors: errors,
  };
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

export const CONTACT_IDENTIFIER_OPTIONS = [
  { value: 'email', label: 'Email Address', description: 'Match contacts by email' },
  { value: 'phone', label: 'Phone Number', description: 'Match contacts by phone' },
  { value: 'external_id', label: 'External ID', description: 'Match contacts by external system ID' },
  { value: 'custom', label: 'Custom Field', description: 'Match contacts by a custom field' },
];

export const CONTACT_FIELD_OPTIONS = [
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'job_title', label: 'Job Title' },
  { value: 'address_line1', label: 'Address Line 1' },
  { value: 'address_line2', label: 'Address Line 2' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'postal_code', label: 'Postal Code' },
  { value: 'country', label: 'Country' },
  { value: 'source', label: 'Source' },
  { value: 'external_id', label: 'External ID' },
  { value: 'notes', label: 'Notes' },
];
