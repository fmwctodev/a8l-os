import { supabase } from '../lib/supabase';
import type { EmailDomain } from '../types';

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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-domains`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'create', domain }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true, domain: result.domain };
}

export async function verifyDomain(
  domainId: string
): Promise<{ success: boolean; valid?: boolean; dns_records?: EmailDomain['dns_records']; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-domains`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'verify', domainId }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true, valid: result.valid, dns_records: result.dns_records };
}

export async function deleteDomain(
  domainId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-domains`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'delete', domainId }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function syncDomains(): Promise<{ success: boolean; synced?: number; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-domains`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'sync' }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true, synced: result.synced };
}
