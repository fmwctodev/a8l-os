import { supabase } from '../lib/supabase';

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

async function callEdgeFunction(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-dnc`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...payload }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

export async function getDncNumbers(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<DncListResponse> {
  return callEdgeFunction('list', params || {});
}

export async function addDncNumber(phoneNumber: string, reason?: string): Promise<void> {
  await callEdgeFunction('add', { phoneNumber, reason });
}

export async function removeDncNumber(id: string, source: 'manual' | 'contact'): Promise<void> {
  await callEdgeFunction('remove', { id, source });
}

export async function importDncNumbers(numbers: Array<string | { phoneNumber: string; reason?: string }>): Promise<{ imported: number }> {
  return callEdgeFunction('import', { numbers });
}

export async function checkDncStatus(phoneNumber: string): Promise<{ isBlocked: boolean; source: 'manual' | 'contact' | null }> {
  return callEdgeFunction('check', { phoneNumber });
}

export async function exportDncList(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-dnc`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'export' }),
    }
  );

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error);
  }

  return response.text();
}
