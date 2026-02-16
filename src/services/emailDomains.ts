import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type { EmailDomain } from '../types';

const SLUG = 'email-sendgrid-domains';

export async function getDomains(orgId: string): Promise<EmailDomain[]> {
  const { data, error } = await supabase
    .from('email_domains')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addDomain(
  domain: string
): Promise<{ success: boolean; domain?: EmailDomain; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'create', domain } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true, domain: result.domain };
}

export async function verifyDomain(
  domainId: string
): Promise<{ success: boolean; valid?: boolean; dns_records?: EmailDomain['dns_records']; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'verify', domainId } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true, valid: result.valid, dns_records: result.dns_records };
}

export async function deleteDomain(
  domainId: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'delete', domainId } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function syncDomains(): Promise<{ success: boolean; synced?: number; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'sync' } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true, synced: result.synced };
}
