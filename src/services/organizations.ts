import { supabase } from '../lib/supabase';
import type { Organization, User } from '../types';
import { logAudit } from './audit';

export async function getOrganization(id: string) {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateOrganization(
  id: string,
  updates: Partial<Organization>,
  currentUser: User
) {
  const { data: before } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;

  await logAudit({
    userId: currentUser.id,
    action: 'update',
    entityType: 'organization',
    entityId: id,
    beforeState: before,
    afterState: data,
  });

  return data;
}
