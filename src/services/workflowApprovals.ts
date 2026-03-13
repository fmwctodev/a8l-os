import { supabase } from '../lib/supabase';

export interface ApprovalQueueItem {
  id: string;
  org_id: string;
  enrollment_id: string;
  workflow_id: string;
  node_id: string;
  action_type: string;
  contact_id: string | null;
  draft_content: unknown;
  requested_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  resolution_note: string | null;
  ai_run_id: string | null;
  pending_next_node_id: string | null;
  workflow?: { id: string; name: string };
  contact?: { id: string; first_name: string; last_name: string; email: string };
  resolved_by?: { id: string; name: string } | null;
}

export interface ApprovalFilters {
  status?: string[];
  workflowId?: string;
  search?: string;
}

export async function getApprovalQueue(
  orgId: string,
  filters: ApprovalFilters = {},
  page = 1,
  perPage = 25
): Promise<{ data: ApprovalQueueItem[]; count: number }> {
  let query = supabase
    .from('workflow_approval_queue')
    .select(`
      *,
      workflow:workflows!workflow_id(id, name),
      contact:contacts!contact_id(id, first_name, last_name, email),
      resolved_by:users!resolved_by_user_id(id, name)
    `, { count: 'exact' })
    .eq('org_id', orgId);

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters.workflowId) {
    query = query.eq('workflow_id', filters.workflowId);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await query
    .order('requested_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: (data ?? []) as ApprovalQueueItem[], count: count ?? 0 };
}

export async function getPendingApprovalCount(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('workflow_approval_queue')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'pending');

  if (error) throw error;
  return count ?? 0;
}

export async function approveItem(
  id: string,
  userId: string,
  note?: string
): Promise<void> {
  const { data: item, error: fetchError } = await supabase
    .from('workflow_approval_queue')
    .select('enrollment_id, pending_next_node_id, org_id')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('workflow_approval_queue')
    .update({
      status: 'approved',
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: userId,
      resolution_note: note || null,
    })
    .eq('id', id);

  if (error) throw error;

  await supabase
    .from('workflow_enrollments')
    .update({
      status: 'active',
      context_data: supabase.rpc ? undefined : undefined,
    })
    .eq('id', item.enrollment_id);

  const { data: enrollment } = await supabase
    .from('workflow_enrollments')
    .select('id, context_data')
    .eq('id', item.enrollment_id)
    .single();

  if (enrollment) {
    const ctx = (enrollment.context_data as Record<string, unknown>) || {};
    delete ctx.waiting_for_approval;
    delete ctx.pending_node_id;
    delete ctx.pending_next_node_id;

    await supabase
      .from('workflow_enrollments')
      .update({ status: 'active', context_data: ctx })
      .eq('id', item.enrollment_id);
  }

  if (item.pending_next_node_id) {
    await supabase.from('workflow_jobs').insert({
      org_id: item.org_id,
      enrollment_id: item.enrollment_id,
      node_id: item.pending_next_node_id,
      run_at: new Date().toISOString(),
      status: 'pending',
      execution_key: `${item.enrollment_id}-${item.pending_next_node_id}-${Date.now()}`,
    });
  }
}

export async function rejectItem(
  id: string,
  userId: string,
  note?: string
): Promise<void> {
  const { data: item, error: fetchError } = await supabase
    .from('workflow_approval_queue')
    .select('enrollment_id')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('workflow_approval_queue')
    .update({
      status: 'rejected',
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: userId,
      resolution_note: note || null,
    })
    .eq('id', id);

  if (error) throw error;

  const { data: enrollment } = await supabase
    .from('workflow_enrollments')
    .select('id, context_data')
    .eq('id', item.enrollment_id)
    .single();

  if (enrollment) {
    const ctx = (enrollment.context_data as Record<string, unknown>) || {};
    delete ctx.waiting_for_approval;
    ctx.approval_rejected = true;
    ctx.approval_rejected_by = userId;
    ctx.approval_rejected_at = new Date().toISOString();

    await supabase
      .from('workflow_enrollments')
      .update({ status: 'stopped', stopped_reason: 'Approval rejected', context_data: ctx, completed_at: new Date().toISOString() })
      .eq('id', item.enrollment_id);
  }
}

export async function getEnrollmentAttempts(
  orgId: string,
  workflowId?: string,
  limit = 100
): Promise<unknown[]> {
  let query = supabase
    .from('workflow_enrollment_attempts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (workflowId) {
    query = query.eq('workflow_id', workflowId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
