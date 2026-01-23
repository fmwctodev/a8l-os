import { supabase } from '../lib/supabase';
import type { EmailDefaults, EmailFromAddress, EmailUnsubscribeGroup } from '../types';

export interface EmailDefaultsWithRelations extends EmailDefaults {
  default_from_address?: EmailFromAddress | null;
  default_unsubscribe_group?: EmailUnsubscribeGroup | null;
}

export async function getEmailDefaults(orgId: string): Promise<EmailDefaultsWithRelations | null> {
  const { data, error } = await supabase
    .from('email_defaults')
    .select(`
      *,
      default_from_address:email_from_addresses(id, email, display_name),
      default_unsubscribe_group:email_unsubscribe_groups(id, name)
    `)
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateEmailDefaults(
  orgId: string,
  updates: {
    default_from_address_id?: string | null;
    default_reply_to?: string | null;
    default_unsubscribe_group_id?: string | null;
    track_opens?: boolean;
    track_clicks?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('email_defaults')
    .update(updates)
    .eq('org_id', orgId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
