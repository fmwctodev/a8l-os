import { supabase } from '../lib/supabase';

export interface ClientPortal {
  id: string;
  org_id: string;
  project_id: string;
  contact_id: string | null;
  portal_token_hash: string;
  portal_token: string | null;
  status: 'active' | 'revoked' | 'expired';
  expires_at: string | null;
  last_accessed_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientPortalWithProject extends ClientPortal {
  project?: {
    id: string;
    name: string;
    status: string;
    description: string | null;
    start_date: string | null;
    target_end_date: string | null;
    updated_at: string;
    org_id: string;
    contact_id: string | null;
  } | null;
  contact?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  organization?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    website: string | null;
  } | null;
  created_by_user?: { id: string; name: string; email: string } | null;
}

export interface PortalEvent {
  id: string;
  portal_id: string;
  project_id: string;
  contact_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

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

export function buildPortalUrl(rawToken: string): string {
  return `${window.location.origin}/portal/project/${rawToken}`;
}

export async function createPortal(params: {
  projectId: string;
  orgId: string;
  contactId?: string;
  createdByUserId: string;
  expiresAt?: string;
}): Promise<{ portal: ClientPortal; rawToken: string; portalUrl: string }> {
  const token = generateSecureToken();
  const tokenHash = await token.hashPromise;

  const { data, error } = await supabase
    .from('project_client_portals')
    .insert({
      org_id: params.orgId,
      project_id: params.projectId,
      contact_id: params.contactId ?? null,
      portal_token_hash: tokenHash,
      portal_token: token.raw,
      status: 'active',
      expires_at: params.expiresAt ?? null,
      created_by_user_id: params.createdByUserId,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    portal: data as ClientPortal,
    rawToken: token.raw,
    portalUrl: buildPortalUrl(token.raw),
  };
}

export async function verifyPortalToken(rawToken: string): Promise<ClientPortalWithProject | null> {
  const tokenHash = await computeHash(rawToken);

  const { data, error } = await supabase
    .from('project_client_portals')
    .select(`
      *,
      project:projects(id, name, status, description, start_date, target_end_date, updated_at, org_id, contact_id),
      contact:contacts(id, first_name, last_name, email, phone),
      organization:organizations(id, name, email, phone, website),
      created_by_user:users!project_client_portals_created_by_user_id_fkey(id, name, email)
    `)
    .eq('portal_token_hash', tokenHash)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) return null;

  const portal = data as ClientPortalWithProject;

  if (portal.expires_at && new Date(portal.expires_at) < new Date()) {
    await supabase
      .from('project_client_portals')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', portal.id);
    return null;
  }

  await supabase
    .from('project_client_portals')
    .update({ last_accessed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', portal.id);

  return portal;
}

export async function getPortalsByProject(projectId: string): Promise<ClientPortalWithProject[]> {
  const { data, error } = await supabase
    .from('project_client_portals')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone),
      created_by_user:users!project_client_portals_created_by_user_id_fkey(id, name, email)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ClientPortalWithProject[];
}

export async function revokePortal(portalId: string): Promise<void> {
  const { error } = await supabase
    .from('project_client_portals')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', portalId);

  if (error) throw error;
}

export async function extendPortalExpiration(portalId: string, expiresAt: string): Promise<void> {
  const { error } = await supabase
    .from('project_client_portals')
    .update({ expires_at: expiresAt, status: 'active', updated_at: new Date().toISOString() })
    .eq('id', portalId);

  if (error) throw error;
}

export async function regeneratePortalToken(portalId: string): Promise<{ rawToken: string; portalUrl: string }> {
  const token = generateSecureToken();
  const tokenHash = await token.hashPromise;

  const { error } = await supabase
    .from('project_client_portals')
    .update({ portal_token_hash: tokenHash, portal_token: token.raw, status: 'active', updated_at: new Date().toISOString() })
    .eq('id', portalId);

  if (error) throw error;

  return { rawToken: token.raw, portalUrl: buildPortalUrl(token.raw) };
}

export async function logPortalEvent(params: {
  portalId: string;
  projectId: string;
  contactId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await supabase.from('project_client_portal_events').insert({
    portal_id: params.portalId,
    project_id: params.projectId,
    contact_id: params.contactId ?? null,
    event_type: params.eventType,
    metadata: params.metadata ?? {},
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });
}

export async function getPortalEvents(portalId: string): Promise<PortalEvent[]> {
  const { data, error } = await supabase
    .from('project_client_portal_events')
    .select('*')
    .eq('portal_id', portalId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PortalEvent[];
}

export async function clientApproveChangeRequest(params: {
  requestId: string;
  portalId: string;
  projectId: string;
  contactId?: string | null;
  userAgent?: string;
}): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('project_change_requests')
    .update({
      client_decision: 'approved',
      status: 'approved',
      approved_at: now,
      updated_at: now,
    })
    .eq('id', params.requestId);

  if (error) throw error;

  await logPortalEvent({
    portalId: params.portalId,
    projectId: params.projectId,
    contactId: params.contactId,
    eventType: 'project_change_request.client_approved',
    metadata: { change_request_id: params.requestId },
    userAgent: params.userAgent ?? navigator.userAgent,
  });
}

export async function clientRejectChangeRequest(params: {
  requestId: string;
  portalId: string;
  projectId: string;
  contactId?: string | null;
  reason?: string;
  userAgent?: string;
}): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('project_change_requests')
    .update({
      client_decision: 'declined',
      status: 'rejected',
      rejected_at: now,
      updated_at: now,
    })
    .eq('id', params.requestId);

  if (error) throw error;

  await logPortalEvent({
    portalId: params.portalId,
    projectId: params.projectId,
    contactId: params.contactId,
    eventType: 'project_change_request.client_rejected',
    metadata: { change_request_id: params.requestId, reason: params.reason },
    userAgent: params.userAgent ?? navigator.userAgent,
  });
}

export async function clientAddComment(params: {
  changeRequestId: string;
  orgId: string;
  body: string;
  authorName: string;
  portalId: string;
  projectId: string;
  contactId?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('project_change_request_comments')
    .insert({
      change_request_id: params.changeRequestId,
      org_id: params.orgId,
      body: params.body,
      is_internal: false,
      client_visible: true,
      portal_reply: true,
      author_type: 'client',
      author_name: params.authorName,
    });

  if (error) throw error;

  await logPortalEvent({
    portalId: params.portalId,
    projectId: params.projectId,
    contactId: params.contactId,
    eventType: 'project_change_request.client_replied',
    metadata: { change_request_id: params.changeRequestId },
    userAgent: navigator.userAgent,
  });
}

export async function getPortalChangeRequests(projectId: string, statusFilter?: string[]): Promise<import('../types').ProjectChangeRequest[]> {
  let query = supabase
    .from('project_change_requests')
    .select(`
      *,
      change_orders:project_change_orders(*)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (statusFilter?.length) {
    query = query.in('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as import('../types').ProjectChangeRequest[];
}

export async function getPortalChangeRequestById(requestId: string): Promise<import('../types').ProjectChangeRequest | null> {
  const { data, error } = await supabase
    .from('project_change_requests')
    .select(`
      *,
      change_orders:project_change_orders(*)
    `)
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw error;
  return data as import('../types').ProjectChangeRequest | null;
}

export async function getPortalComments(changeRequestId: string): Promise<import('../types').ProjectChangeRequestComment[]> {
  const { data, error } = await supabase
    .from('project_change_request_comments')
    .select('*')
    .eq('change_request_id', changeRequestId)
    .eq('client_visible', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as import('../types').ProjectChangeRequestComment[];
}

export async function getPortalSupportTickets(projectId: string): Promise<import('../types').ProjectSupportTicket[]> {
  const { data, error } = await supabase
    .from('project_support_tickets')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as import('../types').ProjectSupportTicket[];
}

export async function getPortalSupportTicketById(ticketId: string): Promise<import('../types').ProjectSupportTicket | null> {
  const { data, error } = await supabase
    .from('project_support_tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle();

  if (error) throw error;
  return data as import('../types').ProjectSupportTicket | null;
}

export async function getPortalTicketComments(ticketId: string): Promise<import('../types').ProjectSupportTicketComment[]> {
  const { data, error } = await supabase
    .from('project_support_ticket_comments')
    .select('*')
    .eq('support_ticket_id', ticketId)
    .eq('is_internal', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as import('../types').ProjectSupportTicketComment[];
}

export async function clientAddTicketComment(params: {
  supportTicketId: string;
  orgId: string;
  body: string;
  authorName: string;
  portalId: string;
  projectId: string;
  contactId?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('project_support_ticket_comments')
    .insert({
      support_ticket_id: params.supportTicketId,
      org_id: params.orgId,
      body: params.body,
      is_internal: false,
      author_type: 'client',
      author_name: params.authorName,
    });

  if (error) throw error;

  await logPortalEvent({
    portalId: params.portalId,
    projectId: params.projectId,
    contactId: params.contactId,
    eventType: 'project_support_ticket.client_replied',
    metadata: { support_ticket_id: params.supportTicketId },
    userAgent: navigator.userAgent,
  });
}

export function getPortalTicketStats(tickets: import('../types').ProjectSupportTicket[]) {
  return {
    open: tickets.filter((t) => ['new', 'in_review', 'in_progress'].includes(t.status)).length,
    waitingOnClient: tickets.filter((t) => t.status === 'waiting_on_client').length,
    resolved: tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length,
  };
}

export function getPortalStats(requests: import('../types').ProjectChangeRequest[]) {
  const openStatuses = ['submitted', 'under_review', 'needs_more_info', 'scheduled', 'in_progress'];
  return {
    open: requests.filter((r) => openStatuses.includes(r.status)).length,
    awaitingApproval: requests.filter((r) => r.status === 'quoted_awaiting_approval').length,
    completed: requests.filter((r) => r.status === 'completed').length,
    totalApprovedValue: requests
      .filter((r) => ['approved', 'completed'].includes(r.status))
      .reduce((sum, r) => sum + (Number(r.cost_impact) || 0), 0),
  };
}
