import { fetchEdge } from '../lib/edgeFunction';

export interface PhoneNumberCapabilities {
  sms: boolean;
  mms: boolean;
  voice: boolean;
}

export interface TwilioNumber {
  id: string;
  org_id: string;
  phone_number: string;
  phone_sid: string;
  friendly_name?: string;
  capabilities: PhoneNumberCapabilities;
  country_code?: string;
  status: 'active' | 'disabled';
  is_default_sms: boolean;
  is_default_voice: boolean;
  department_id?: string;
  department?: { id: string; name: string };
  webhook_configured: boolean;
  created_at: string;
  updated_at: string;
}

const SLUG = 'phone-twilio-numbers';

async function callEdgeFunction(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetchEdge(SLUG, { body: { action, ...payload } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function getNumbers(): Promise<TwilioNumber[]> {
  const result = await callEdgeFunction('list');
  return result.numbers || [];
}

export async function syncNumbers(): Promise<{ numbers: TwilioNumber[]; count: number }> {
  return callEdgeFunction('sync');
}

export async function enableNumber(numberId: string): Promise<void> {
  await callEdgeFunction('enable', { numberId });
}

export async function disableNumber(numberId: string): Promise<void> {
  await callEdgeFunction('disable', { numberId });
}

export async function setDefaultSms(numberId: string): Promise<void> {
  await callEdgeFunction('set-default-sms', { numberId });
}

export async function setDefaultVoice(numberId: string): Promise<void> {
  await callEdgeFunction('set-default-voice', { numberId });
}

export async function assignDepartment(numberId: string, departmentId: string | null): Promise<void> {
  await callEdgeFunction('assign-department', { numberId, departmentId });
}
