import { supabase } from '../lib/supabase';
import type { EmailUnsubscribeGroup } from '../types';

export async function getUnsubscribeGroups(orgId: string): Promise<EmailUnsubscribeGroup[]> {
  const { data, error } = await supabase
    .from('email_unsubscribe_groups')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createUnsubscribeGroup(
  name: string,
  description?: string
): Promise<{ success: boolean; group?: EmailUnsubscribeGroup; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-unsubscribe`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        name,
        description,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true, group: result.group };
}

export async function updateUnsubscribeGroup(
  groupId: string,
  updates: {
    name?: string;
    description?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-unsubscribe`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update',
        groupId,
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

export async function setDefaultUnsubscribeGroup(
  groupId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-unsubscribe`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'set-default',
        groupId,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function deleteUnsubscribeGroup(
  groupId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-unsubscribe`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
        groupId,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function syncUnsubscribeGroups(): Promise<{ success: boolean; synced?: number; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sendgrid-unsubscribe`,
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
