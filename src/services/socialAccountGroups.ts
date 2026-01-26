import { supabase } from '../lib/supabase';
import type { SocialAccountGroup } from '../types';

export async function getAccountGroups(organizationId: string): Promise<SocialAccountGroup[]> {
  const { data, error } = await supabase
    .from('social_account_groups')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAccountGroupById(id: string): Promise<SocialAccountGroup | null> {
  const { data, error } = await supabase
    .from('social_account_groups')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createAccountGroup(
  organizationId: string,
  name: string,
  accountIds: string[],
  createdBy: string,
  description?: string
): Promise<SocialAccountGroup> {
  const { data, error } = await supabase
    .from('social_account_groups')
    .insert({
      organization_id: organizationId,
      name,
      description: description || null,
      account_ids: accountIds,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAccountGroup(
  id: string,
  updates: {
    name?: string;
    description?: string;
    accountIds?: string[];
  }
): Promise<SocialAccountGroup> {
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.accountIds !== undefined) updateData.account_ids = updates.accountIds;

  const { data, error } = await supabase
    .from('social_account_groups')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAccountGroup(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_account_groups')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
