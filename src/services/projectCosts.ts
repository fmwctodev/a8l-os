import { supabase } from '../lib/supabase';
import type { ProjectCost } from '../types';
import { logProjectActivity } from './projectActivityLog';

export async function getProjectCosts(projectId: string): Promise<ProjectCost[]> {
  const { data, error } = await supabase
    .from('project_costs')
    .select('*, created_by_user:users!project_costs_created_by_fkey(id, name, avatar_url)')
    .eq('project_id', projectId)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectCost[];
}

export interface CreateCostInput {
  org_id: string;
  project_id: string;
  description: string;
  amount: number;
  currency?: string;
  category?: string | null;
  date: string;
  created_by: string;
}

export async function createProjectCost(
  input: CreateCostInput,
  actorUserId: string
): Promise<ProjectCost> {
  const { data, error } = await supabase
    .from('project_costs')
    .insert({
      org_id: input.org_id,
      project_id: input.project_id,
      description: input.description,
      amount: input.amount,
      currency: input.currency ?? 'USD',
      category: input.category ?? null,
      date: input.date,
      created_by: input.created_by,
    })
    .select('*, created_by_user:users!project_costs_created_by_fkey(id, name, avatar_url)')
    .single();

  if (error) throw error;

  await logProjectActivity({
    org_id: input.org_id,
    project_id: input.project_id,
    event_type: 'cost_added',
    summary: `Cost "${input.description}" ($${input.amount}) added`,
    payload: { cost_id: data.id, amount: input.amount, category: input.category },
    actor_user_id: actorUserId,
  });

  await recalculateActualCost(input.project_id);

  return data as ProjectCost;
}

export async function updateProjectCost(
  id: string,
  updates: Partial<Pick<ProjectCost, 'description' | 'amount' | 'category' | 'date' | 'currency'>>
): Promise<ProjectCost> {
  const { data, error } = await supabase
    .from('project_costs')
    .update(updates)
    .eq('id', id)
    .select('*, created_by_user:users!project_costs_created_by_fkey(id, name, avatar_url)')
    .single();

  if (error) throw error;
  await recalculateActualCost(data.project_id);
  return data as ProjectCost;
}

export async function deleteProjectCost(id: string, actorUserId: string): Promise<void> {
  const { data: cost } = await supabase
    .from('project_costs')
    .select('project_id, org_id, description, amount')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('project_costs').delete().eq('id', id);
  if (error) throw error;

  if (cost) {
    await logProjectActivity({
      org_id: cost.org_id,
      project_id: cost.project_id,
      event_type: 'financial_updated',
      summary: `Cost "${cost.description}" ($${cost.amount}) removed`,
      payload: { cost_id: id },
      actor_user_id: actorUserId,
    });
    await recalculateActualCost(cost.project_id);
  }
}

async function recalculateActualCost(projectId: string): Promise<void> {
  const { data: costs, error } = await supabase
    .from('project_costs')
    .select('amount')
    .eq('project_id', projectId);

  if (error) return;

  const total = (costs ?? []).reduce((sum, c) => sum + Number(c.amount || 0), 0);

  await supabase
    .from('projects')
    .update({ actual_cost: total, updated_at: new Date().toISOString() })
    .eq('id', projectId);
}
