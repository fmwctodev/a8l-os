import { supabase } from '../lib/supabase';
import type { EmailFromAddress } from '../types';

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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-senders`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        displayName,
        email,
        domainId,
        replyTo,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-senders`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update',
        addressId,
        ...updates,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function setDefaultFromAddress(
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-senders`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'set-default',
        addressId,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function deleteFromAddress(
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-senders`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
        addressId,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true };
}
