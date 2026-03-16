import { supabase } from '../lib/supabase';
import type {
  ProjectChangeRequest,
  ProjectChangeRequestStats,
  CreateChangeRequestInput,
  UpdateChangeRequestInput,
  ProjectChangeRequestAuditEvent,
} from '../types';
import { logProjectActivity } from './projectActivityLog';

async function computeHash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSecureToken(): { raw: string; hashPromise: Promise<string> } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashPromise: computeHash(raw) };
}

const CHANGE_REQUEST_SELECT = `
  *,
  reviewer:users!project_change_requests_reviewer_user_id_fkey(id, name, avatar_url, email),
  approver:users!project_change_requests_approver_user_id_fkey(id, name, avatar_url, email),
  created_by_user:users!project_change_requests_created_by_user_id_fkey(id, name, avatar_url),
  change_orders:project_change_orders(*)
`;

export async function getChangeRequests(
  projectId: string,
  filters: {
    status?: string[];
    type?: string[];
    priority?: string[];
    search?: string;
  } = {}
): Promise<ProjectChangeRequest[]> {
  let query = supabase
    .from('project_change_requests')
    .select(CHANGE_REQUEST_SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filters.status?.length) query = query.in('status', filters.status);
  if (filters.type?.length) query = query.in('request_type', filters.type);
  if (filters.priority?.length) query = query.in('priority', filters.priority);
  if (filters.search) query = query.ilike('title', `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProjectChangeRequest[];
}

export async function getChangeRequestById(id: string): Promise<ProjectChangeRequest | null> {
  const { data, error } = await supabase
    .from('project_change_requests')
    .select(CHANGE_REQUEST_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectChangeRequest | null;
}

export async function createChangeRequest(
  input: CreateChangeRequestInput,
  actorUserId?: string
): Promise<{ request: ProjectChangeRequest; rawToken: string; clientPortalUrl: string }> {
  const token = generateSecureToken();
  const tokenHash = await token.hashPromise;

  const { data, error } = await supabase
    .from('project_change_requests')
    .insert({
      org_id: input.org_id,
      project_id: input.project_id,
      client_name: input.client_name,
      client_email: input.client_email ?? null,
      client_phone: input.client_phone ?? null,
      title: input.title,
      request_type: input.request_type,
      priority: input.priority,
      description: input.description,
      requested_due_date: input.requested_due_date ?? null,
      attachments: input.attachments ?? [],
      source: input.source ?? 'internal',
      status: 'submitted',
      access_token_hash: tokenHash,
      created_by_user_id: actorUserId ?? null,
    })
    .select(CHANGE_REQUEST_SELECT)
    .single();

  if (error) throw error;

  await createAuditEvent({
    changeRequestId: data.id,
    orgId: input.org_id,
    eventType: 'submitted',
    actorType: actorUserId ? 'user' : 'client',
    actorId: actorUserId,
    actorName: input.client_name,
    metadata: { source: input.source ?? 'internal', title: input.title },
  });

  await logProjectActivity({
    org_id: input.org_id,
    project_id: input.project_id,
    event_type: 'change_request_submitted',
    summary: `Change request submitted: "${input.title}"`,
    payload: { change_request_id: data.id, client_name: input.client_name },
    actor_user_id: actorUserId ?? null,
  });

  const clientPortalUrl = `${window.location.origin}/project-change/status/${data.id}?token=${token.raw}`;

  return { request: data as ProjectChangeRequest, rawToken: token.raw, clientPortalUrl };
}

export async function updateChangeRequest(
  id: string,
  updates: UpdateChangeRequestInput,
  actorUserId: string,
  actorName?: string
): Promise<ProjectChangeRequest> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { ...updates, updated_at: now };

  if (updates.status === 'approved') patch.approved_at = now;
  if (updates.status === 'rejected') patch.rejected_at = now;
  if (updates.status === 'completed') patch.completed_at = now;
  if (updates.status === 'under_review') patch.reviewed_at = now;

  const { data, error } = await supabase
    .from('project_change_requests')
    .update(patch)
    .eq('id', id)
    .select(CHANGE_REQUEST_SELECT)
    .single();

  if (error) throw error;

  if (updates.status) {
    await createAuditEvent({
      changeRequestId: id,
      orgId: data.org_id,
      eventType: `status_changed_to_${updates.status}`,
      actorType: 'user',
      actorId: actorUserId,
      actorName,
      metadata: { new_status: updates.status },
    });

    const activityMap: Record<string, 'change_request_reviewed' | 'change_request_approved' | 'change_request_rejected' | 'change_request_completed'> = {
      under_review: 'change_request_reviewed',
      approved: 'change_request_approved',
      rejected: 'change_request_rejected',
      completed: 'change_request_completed',
    };

    if (activityMap[updates.status]) {
      await logProjectActivity({
        org_id: data.org_id,
        project_id: data.project_id,
        event_type: activityMap[updates.status],
        summary: `Change request "${data.title}" moved to ${updates.status.replace(/_/g, ' ')}`,
        payload: { change_request_id: id },
        actor_user_id: actorUserId,
      });
    }
  }

  return data as ProjectChangeRequest;
}

export async function assignReviewer(
  id: string,
  reviewerUserId: string,
  actorUserId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('project_change_requests')
    .update({ reviewer_user_id: reviewerUserId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('org_id, title')
    .single();

  if (error) throw error;

  await createAuditEvent({
    changeRequestId: id,
    orgId: data.org_id,
    eventType: 'reviewer_assigned',
    actorType: 'user',
    actorId: actorUserId,
    metadata: { reviewer_user_id: reviewerUserId },
  });
}

export async function getChangeRequestStats(projectId: string): Promise<ProjectChangeRequestStats> {
  const { data, error } = await supabase
    .from('project_change_requests')
    .select('status, cost_impact, timeline_impact_days')
    .eq('project_id', projectId);

  if (error) throw error;

  const rows = data ?? [];
  const openStatuses = ['submitted', 'under_review', 'needs_more_info', 'quoted_awaiting_approval', 'scheduled', 'in_progress'];

  const stats: ProjectChangeRequestStats = {
    total: rows.length,
    open: rows.filter((r) => openStatuses.includes(r.status)).length,
    approved: rows.filter((r) => r.status === 'approved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    total_approved_value: rows
      .filter((r) => ['approved', 'completed'].includes(r.status))
      .reduce((sum, r) => sum + (Number(r.cost_impact) || 0), 0),
    total_timeline_extension_days: rows
      .filter((r) => ['approved', 'completed'].includes(r.status))
      .reduce((sum, r) => sum + (Number(r.timeline_impact_days) || 0), 0),
  };

  return stats;
}

export async function generateClientPortalToken(
  changeRequestId: string
): Promise<{ rawToken: string; clientPortalUrl: string }> {
  const token = generateSecureToken();
  const tokenHash = await token.hashPromise;

  const { error } = await supabase
    .from('project_change_requests')
    .update({ access_token_hash: tokenHash, updated_at: new Date().toISOString() })
    .eq('id', changeRequestId);

  if (error) throw error;

  const clientPortalUrl = `${window.location.origin}/project-change/status/${changeRequestId}?token=${token.raw}`;
  return { rawToken: token.raw, clientPortalUrl };
}

export async function generateProjectClientLink(
  projectId: string,
  orgId: string
): Promise<string> {
  const token = generateSecureToken();
  const tokenHash = await token.hashPromise;

  const url = `${window.location.origin}/project-change/submit?projectId=${projectId}&org=${orgId}&token=${token.raw}&h=${tokenHash}`;
  return url;
}

export async function verifyClientPortalToken(
  changeRequestId: string,
  rawToken: string
): Promise<ProjectChangeRequest | null> {
  const tokenHash = await computeHash(rawToken);

  const { data, error } = await supabase
    .from('project_change_requests')
    .select(CHANGE_REQUEST_SELECT)
    .eq('id', changeRequestId)
    .eq('access_token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProjectChangeRequest;
}

export async function createAuditEvent(params: {
  changeRequestId: string;
  orgId: string;
  eventType: string;
  actorType: 'user' | 'client' | 'system';
  actorId?: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
}): Promise<ProjectChangeRequestAuditEvent> {
  const { data, error } = await supabase
    .from('project_change_request_audit')
    .insert({
      org_id: params.orgId,
      change_request_id: params.changeRequestId,
      event_type: params.eventType,
      actor_type: params.actorType,
      actor_user_id: params.actorId ?? null,
      actor_name: params.actorName ?? null,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProjectChangeRequestAuditEvent;
}

export async function getAuditEvents(changeRequestId: string): Promise<ProjectChangeRequestAuditEvent[]> {
  const { data, error } = await supabase
    .from('project_change_request_audit')
    .select('*')
    .eq('change_request_id', changeRequestId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProjectChangeRequestAuditEvent[];
}
