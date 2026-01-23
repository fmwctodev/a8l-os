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

export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  beforeState,
  afterState,
  ipAddress,
}: LogAuditParams) {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
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

export async function getAuditLogs(options?: {
  limit?: number;
  offset?: number;
  entityType?: string;
  action?: string;
  userId?: string;
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
