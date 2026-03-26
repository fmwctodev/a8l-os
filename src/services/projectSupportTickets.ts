import { supabase } from '../lib/supabase';
import type {
  ProjectSupportTicket,
  ProjectSupportTicketStats,
  ProjectSupportTicketComment,
  ProjectSupportTicketAuditEvent,
  CreateSupportTicketInput,
  UpdateSupportTicketInput,
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

function computeSeverityScore(priority: string, businessImpact: string): number {
  const priorityScores: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const impactScores: Record<string, number> = {
    minimal: 1, internal_only: 2, team_productivity: 3,
    client_facing: 4, operations_blocked: 5, revenue_affecting: 5,
  };
  const p = priorityScores[priority] ?? 2;
  const i = impactScores[businessImpact] ?? 2;
  return Math.min(Math.round((p + i) / 2 * 2.5), 10);
}

const TICKET_SELECT = `
  *,
  assigned_user:users!project_support_tickets_assigned_user_id_fkey(id, name, avatar_url, email),
  created_by_user:users!project_support_tickets_created_by_user_id_fkey(id, name, avatar_url)
`;

export async function getSupportTickets(
  projectId: string,
  filters: {
    status?: string[];
    category?: string[];
    priority?: string[];
    search?: string;
  } = {}
): Promise<ProjectSupportTicket[]> {
  let query = supabase
    .from('project_support_tickets')
    .select(TICKET_SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filters.status?.length) query = query.in('status', filters.status);
  if (filters.category?.length) query = query.in('service_category', filters.category);
  if (filters.priority?.length) query = query.in('priority', filters.priority);
  if (filters.search) query = query.ilike('title', `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProjectSupportTicket[];
}

export async function getSupportTicketById(id: string): Promise<ProjectSupportTicket | null> {
  const { data, error } = await supabase
    .from('project_support_tickets')
    .select(TICKET_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectSupportTicket | null;
}

export async function createSupportTicket(
  input: CreateSupportTicketInput,
  actorUserId?: string
): Promise<{ ticket: ProjectSupportTicket; rawToken: string }> {
  const token = generateSecureToken();
  const tokenHash = await token.hashPromise;
  const severity = computeSeverityScore(input.priority, input.business_impact ?? 'minimal');

  const { data, error } = await supabase
    .from('project_support_tickets')
    .insert({
      org_id: input.org_id,
      project_id: input.project_id,
      client_name: input.client_name,
      client_email: input.client_email ?? null,
      client_phone: input.client_phone ?? null,
      client_company: input.client_company ?? null,
      title: input.title,
      service_category: input.service_category,
      request_type: input.request_type,
      priority: input.priority,
      description: input.description,
      steps_to_reproduce: input.steps_to_reproduce ?? null,
      expected_behavior: input.expected_behavior ?? null,
      actual_behavior: input.actual_behavior ?? null,
      affected_area: input.affected_area ?? null,
      affected_feature: input.affected_feature ?? null,
      affected_workflow_id: input.affected_workflow_id ?? null,
      affected_integration: input.affected_integration ?? null,
      environment: input.environment ?? 'production',
      browser_info: input.browser_info ?? navigator.userAgent,
      error_messages: input.error_messages ?? null,
      attachments: input.attachments ?? [],
      business_impact: input.business_impact ?? 'minimal',
      impact_description: input.impact_description ?? null,
      users_affected_count: input.users_affected_count ?? 1,
      workaround_available: input.workaround_available ?? false,
      preferred_contact_method: input.preferred_contact_method ?? 'email',
      availability_window: input.availability_window ?? null,
      expected_resolution_date: input.expected_resolution_date ?? null,
      status: 'new',
      severity_score: severity,
      source: input.source ?? 'portal',
      access_token_hash: tokenHash,
      created_by_user_id: actorUserId ?? null,
    })
    .select(TICKET_SELECT)
    .single();

  if (error) throw error;

  await createAuditEvent({
    supportTicketId: data.id,
    orgId: input.org_id,
    eventType: 'submitted',
    actorType: actorUserId ? 'user' : 'client',
    actorId: actorUserId,
    actorName: input.client_name,
    metadata: { source: input.source ?? 'portal', title: input.title, severity_score: severity },
  });

  await logProjectActivity({
    org_id: input.org_id,
    project_id: input.project_id,
    event_type: 'support_ticket_submitted',
    summary: `Support ticket submitted: "${input.title}"`,
    payload: { support_ticket_id: data.id, client_name: input.client_name, severity_score: severity },
    actor_user_id: actorUserId ?? null,
  });

  return { ticket: data as ProjectSupportTicket, rawToken: token.raw };
}

export async function updateSupportTicket(
  id: string,
  updates: UpdateSupportTicketInput,
  actorUserId: string,
  actorName?: string
): Promise<ProjectSupportTicket> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { ...updates, updated_at: now };

  if (updates.status === 'resolved') patch.resolved_at = now;
  if (updates.status === 'closed') patch.closed_at = now;
  if (updates.status === 'in_review' || updates.status === 'in_progress') {
    const existing = await getSupportTicketById(id);
    if (existing && !existing.first_response_at) {
      patch.first_response_at = now;
    }
  }

  const { data, error } = await supabase
    .from('project_support_tickets')
    .update(patch)
    .eq('id', id)
    .select(TICKET_SELECT)
    .single();

  if (error) throw error;

  if (updates.status) {
    await createAuditEvent({
      supportTicketId: id,
      orgId: data.org_id,
      eventType: `status_changed_to_${updates.status}`,
      actorType: 'user',
      actorId: actorUserId,
      actorName,
      metadata: { new_status: updates.status },
    });

    await logProjectActivity({
      org_id: data.org_id,
      project_id: data.project_id,
      event_type: 'support_ticket_status_changed',
      summary: `Support ticket "${data.title}" moved to ${updates.status.replace(/_/g, ' ')}`,
      payload: { support_ticket_id: id, new_status: updates.status },
      actor_user_id: actorUserId,
    });
  }

  if (updates.assigned_user_id !== undefined) {
    await createAuditEvent({
      supportTicketId: id,
      orgId: data.org_id,
      eventType: 'assigned',
      actorType: 'user',
      actorId: actorUserId,
      actorName,
      metadata: { assigned_user_id: updates.assigned_user_id },
    });
  }

  return data as ProjectSupportTicket;
}

export async function getSupportTicketStats(projectId: string): Promise<ProjectSupportTicketStats> {
  const { data, error } = await supabase
    .from('project_support_tickets')
    .select('status')
    .eq('project_id', projectId);

  if (error) throw error;

  const rows = data ?? [];
  return {
    total: rows.length,
    open: rows.filter((r) => ['new', 'in_review'].includes(r.status)).length,
    in_progress: rows.filter((r) => r.status === 'in_progress').length,
    waiting_on_client: rows.filter((r) => r.status === 'waiting_on_client').length,
    resolved: rows.filter((r) => r.status === 'resolved').length,
    closed: rows.filter((r) => r.status === 'closed').length,
  };
}

export async function getTicketComments(ticketId: string, includeInternal = true): Promise<ProjectSupportTicketComment[]> {
  let query = supabase
    .from('project_support_ticket_comments')
    .select(`
      *,
      author_user:users!project_support_ticket_comments_author_user_id_fkey(id, name, avatar_url, email)
    `)
    .eq('support_ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (!includeInternal) {
    query = query.eq('is_internal', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProjectSupportTicketComment[];
}

export async function addTicketComment(params: {
  supportTicketId: string;
  orgId: string;
  body: string;
  isInternal: boolean;
  authorType: 'user' | 'client' | 'system';
  authorUserId?: string;
  authorName?: string;
  attachments?: { name: string; url: string; size: number; type: string }[];
}): Promise<ProjectSupportTicketComment> {
  const { data, error } = await supabase
    .from('project_support_ticket_comments')
    .insert({
      org_id: params.orgId,
      support_ticket_id: params.supportTicketId,
      body: params.body,
      is_internal: params.isInternal,
      author_type: params.authorType,
      author_user_id: params.authorUserId ?? null,
      author_name: params.authorName ?? null,
      attachments: params.attachments ?? [],
    })
    .select(`
      *,
      author_user:users!project_support_ticket_comments_author_user_id_fkey(id, name, avatar_url, email)
    `)
    .single();

  if (error) throw error;
  return data as ProjectSupportTicketComment;
}

export async function createAuditEvent(params: {
  supportTicketId: string;
  orgId: string;
  eventType: string;
  actorType: 'user' | 'client' | 'system';
  actorId?: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
}): Promise<ProjectSupportTicketAuditEvent> {
  const { data, error } = await supabase
    .from('project_support_ticket_audit')
    .insert({
      org_id: params.orgId,
      support_ticket_id: params.supportTicketId,
      event_type: params.eventType,
      actor_type: params.actorType,
      actor_user_id: params.actorId ?? null,
      actor_name: params.actorName ?? null,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProjectSupportTicketAuditEvent;
}

export async function getAuditEvents(ticketId: string): Promise<ProjectSupportTicketAuditEvent[]> {
  const { data, error } = await supabase
    .from('project_support_ticket_audit')
    .select('*')
    .eq('support_ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProjectSupportTicketAuditEvent[];
}

export async function uploadTicketAttachment(
  orgId: string,
  ticketId: string,
  file: File
): Promise<{ name: string; url: string; size: number; type: string }> {
  const ext = file.name.split('.').pop() || 'bin';
  const filePath = `${orgId}/${ticketId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('support-ticket-attachments')
    .upload(filePath, file, { upsert: false });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('support-ticket-attachments')
    .getPublicUrl(filePath);

  return {
    name: file.name,
    url: urlData.publicUrl,
    size: file.size,
    type: file.type,
  };
}
