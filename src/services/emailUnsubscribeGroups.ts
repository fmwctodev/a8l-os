import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type { EmailUnsubscribeGroup } from '../types';

const SLUG = 'email-sendgrid-unsubscribe';

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
  const response = await fetchEdge(SLUG, { body: { action: 'create', name, description } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true, group: result.group };
}

export async function updateUnsubscribeGroup(
  groupId: string,
  updates: {
    name?: string;
    description?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'update', groupId, ...updates } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function setDefaultUnsubscribeGroup(
  groupId: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'set-default', groupId } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function deleteUnsubscribeGroup(
  groupId: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'delete', groupId } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true };
}

export async function syncUnsubscribeGroups(): Promise<{ success: boolean; synced?: number; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'sync' } });
  const result = await response.json();
  if (!response.ok) return { success: false, error: result.error };
  return { success: true, synced: result.synced };
}
