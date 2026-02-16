import { fetchEdge } from '../lib/edgeFunction';

export interface DncNumber {
  id: string;
  phoneNumber: string;
  reason?: string;
  source: 'manual' | 'contact';
  addedBy?: string;
  contactName?: string;
  createdAt?: string;
}

export interface DncListResponse {
  numbers: DncNumber[];
  total: number;
  page: number;
  limit: number;
}

const SLUG = 'phone-dnc';

async function callEdgeFn(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetchEdge(SLUG, { body: { action, ...payload } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function getDncNumbers(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<DncListResponse> {
  return callEdgeFn('list', params || {});
}

export async function addDncNumber(phoneNumber: string, reason?: string): Promise<void> {
  await callEdgeFn('add', { phoneNumber, reason });
}

export async function removeDncNumber(id: string, source: 'manual' | 'contact'): Promise<void> {
  await callEdgeFn('remove', { id, source });
}

export async function importDncNumbers(numbers: Array<string | { phoneNumber: string; reason?: string }>): Promise<{ imported: number }> {
  return callEdgeFn('import', { numbers });
}

export async function checkDncStatus(phoneNumber: string): Promise<{ isBlocked: boolean; source: 'manual' | 'contact' | null }> {
  return callEdgeFn('check', { phoneNumber });
}

export async function exportDncList(): Promise<string> {
  const response = await fetchEdge(SLUG, { body: { action: 'export' } });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error);
  }
  return response.text();
}
