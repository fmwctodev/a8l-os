import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type { EmailFromAddress } from '../types';

const SLUG = 'email-sendgrid-senders';

export async function getFromAddresses(orgId: string): Promise<EmailFromAddress[]> {
  const { data, error } = await supabase
    .from('email_from_addresses')
    .select(`
      *,
      domain:email_domains(id, domain, status)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createFromAddress(
  displayName: string,
  email: string,
  domainId: string,
  replyTo?: string
): Promise<{ success: boolean; address?: EmailFromAddress; error?: string }> {
  const response = await fetchEdge(SLUG, {
    body: { action: 'create', displayName, email, domainId, replyTo },
  });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true, address: result.address };
}

export async function updateFromAddress(
  addressId: string,
  updates: {
    displayName?: string;
    replyTo?: string;
    active?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, {
    body: { action: 'update', addressId, ...updates },
  });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function setDefaultFromAddress(
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, {
    body: { action: 'set-default', addressId },
  });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function deleteFromAddress(
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, {
    body: { action: 'delete', addressId },
  });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function syncFromAddresses(): Promise<{ success: boolean; synced?: number; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'sync' } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true, synced: result.synced };
}
