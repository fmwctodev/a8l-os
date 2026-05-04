import { fetchEdge } from '../lib/edgeFunction';

export interface PhoneNumberCapabilities {
  sms: boolean;
  mms: boolean;
  voice: boolean;
}

export type PlivoSmsRoute = 'clara' | 'user';

export interface PlivoNumber {
  id: string;
  org_id: string;
  phone_number: string;
  plivo_number_uuid: string;
  friendly_name: string | null;
  capabilities: PhoneNumberCapabilities;
  country_code: string | null;
  status: 'active' | 'disabled';

  sms_route: PlivoSmsRoute;
  assigned_user_id: string | null;
  is_default_sms: boolean;

  vapi_assistant_id: string | null;
  is_default_voice: boolean;

  department_id: string | null;
  webhook_configured: boolean;
  created_at: string;
  updated_at: string;

  // Joined relations
  assigned_user?: { id: string; name: string; email: string } | null;
  vapi_assistant?: { id: string; name: string; slug: string } | null;
}

const SLUG = 'plivo-numbers';

async function callEdge(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetchEdge(SLUG, { body: { action, ...payload } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function getNumbers(): Promise<PlivoNumber[]> {
  const result = await callEdge('list');
  return result.numbers || [];
}

export interface SyncResult {
  success: boolean;
  added: number;
  synced: number;
  total: number;
  webhooks_configured: number;
  webhooks_failed: number;
  app_id?: string | null;
  errors?: string[];
}

export async function syncNumbers(): Promise<SyncResult> {
  return callEdge('sync');
}

export interface UpdateAssignmentParams {
  numberId: string;
  smsRoute?: PlivoSmsRoute;
  assignedUserId?: string | null;
  vapiAssistantId?: string | null;
}

export async function updateAssignment(params: UpdateAssignmentParams): Promise<PlivoNumber> {
  const result = await callEdge('update_assignment', params);
  return result.number;
}

export async function deleteNumber(numberId: string): Promise<void> {
  await callEdge('delete', { numberId });
}

/**
 * Force-PATCH this number's Plivo Application assignment so its inbound
 * SMS / voice webhooks point at our edge functions. Use this when the
 * number's `webhook_configured` is false (sync-time failure or someone
 * changed the Application in the Plivo console).
 */
export async function configureWebhooksForNumber(numberId: string): Promise<void> {
  await callEdge('configure_webhooks_for_number', { numberId });
}
