import { supabase } from '../lib/supabase';
import type { LostReason } from '../types';

export async function getLostReasons(onlyActive = true): Promise<LostReason[]> {
  let query = supabase
    .from('lost_reasons')
    .select('*')
    .order('sort_order', { ascending: true });

  if (onlyActive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getLostReasonById(id: string): Promise<LostReason | null> {
  const { data, error } = await supabase
    .from('lost_reasons')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createLostReason(reason: {
  org_id: string;
  name: string;
}): Promise<LostReason> {
  const { data: maxSort } = await supabase
    .from('lost_reasons')
    .select('sort_order')
    .eq('org_id', reason.org_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('lost_reasons')
    .insert({
      org_id: reason.org_id,
      name: reason.name,
      sort_order: (maxSort?.sort_order ?? -1) + 1,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLostReason(
  id: string,
  updates: {
    name?: string;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<LostReason> {
  const { data, error } = await supabase
    .from('lost_reasons')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLostReason(id: string): Promise<void> {
  const { error } = await supabase
    .from('lost_reasons')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function reorderLostReasons(orgId: string, reasonIds: string[]): Promise<void> {
  const updates = reasonIds.map((id, index) => ({
    id,
    sort_order: index
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('lost_reasons')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id)
      .eq('org_id', orgId);
    if (error) throw error;
  }
}
