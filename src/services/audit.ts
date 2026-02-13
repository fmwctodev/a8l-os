import { supabase } from '../lib/supabase';

interface LogAuditParams {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string;
}

interface UserContext {
  userId: string;
  userName?: string;
  organizationId: string;
  userAgent?: string;
  ipAddress?: string;
}

interface LogAuditWithContextParams {
  userContext: UserContext;
  action: string;
  entityType: string;
  entityId?: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
}

export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  beforeState,
  afterState,
  ipAddress,
}: LogAuditParams) {
  const { data: user } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (!user?.organization_id) {
    console.error('Failed to log audit: Could not determine user organization');
    return;
  }

  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    organization_id: user.organization_id,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    before_state: beforeState || null,
    after_state: afterState || null,
    ip_address: ipAddress || null,
  });

  if (error) {
    console.error('Failed to log audit:', error);
  }
}

export async function logAuditWithContext({
  userContext,
  action,
  entityType,
  entityId,
  beforeState,
  afterState,
}: LogAuditWithContextParams) {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userContext.userId,
    organization_id: userContext.organizationId,
    actor_user_name: userContext.userName || null,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    before_state: beforeState || null,
    after_state: afterState || null,
    ip_address: userContext.ipAddress || null,
    user_agent: userContext.userAgent || null,
  });

  if (error) {
    console.error('Failed to log audit with context:', error);
  }
}

export function createUserContext(
  userId: string,
  organizationId: string,
  userName?: string
): UserContext {
  return {
    userId,
    organizationId,
    userName,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };
}

export async function getAuditLogs(options?: {
  limit?: number;
  offset?: number;
  entityType?: string;
  action?: string;
  userId?: string;
  organizationId?: string;
  startDate?: string;
  endDate?: string;
}) {
  let query = supabase
    .from('audit_logs')
    .select(`
      *,
      user:users(id, name, email)
    `, { count: 'exact' })
    .order('timestamp', { ascending: false });

  if (options?.organizationId) {
    query = query.eq('organization_id', options.organizationId);
  }

  if (options?.entityType) {
    query = query.eq('entity_type', options.entityType);
  }

  if (options?.action) {
    query = query.eq('action', options.action);
  }

  if (options?.userId) {
    query = query.eq('user_id', options.userId);
  }

  if (options?.startDate) {
    query = query.gte('timestamp', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('timestamp', options.endDate);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return { data, count };
}

export type { UserContext };
