import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type {
  Integration,
  IntegrationConnection,
  IntegrationLog,
  ModuleIntegrationRequirement,
  IntegrationFilters,
  IntegrationLogFilters,
  IntegrationStats,
  InitiateOAuthResponse,
  ConnectApiKeyInput,
} from '../types';

const SLUG = 'integrations-connect';

export async function getIntegrations(filters?: IntegrationFilters): Promise<Integration[]> {
  let query = supabase
    .from('integrations')
    .select(`
      *,
      integration_connections!integration_connections_integration_id_fkey (
        id,
        status,
        account_info,
        error_message,
        connected_at,
        connected_by,
        user_id
      )
    `)
    .order('category')
    .order('name');

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.scope) {
    query = query.eq('scope', filters.scope);
  }
  if (filters?.connectionType) {
    query = query.eq('connection_type', filters.connectionType);
  }
  if (filters?.enabled !== undefined) {
    query = query.eq('enabled', filters.enabled);
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  let integrations = data.map((int) => ({
    ...int,
    connection: int.integration_connections?.[0] || null,
  })) as Integration[];

  if (filters?.connected !== undefined) {
    integrations = integrations.filter((int) => {
      const isConnected = int.connection?.status === 'connected';
      return filters.connected ? isConnected : !isConnected;
    });
  }

  return integrations;
}

export interface GoogleConnectionStatuses {
  google_workspace: { connected: boolean; email?: string };
  gmail: { connected: boolean; email?: string };
  google_calendar: { connected: boolean; email?: string };
}

export async function getGoogleConnectionStatuses(): Promise<GoogleConnectionStatuses> {
  const result: GoogleConnectionStatuses = {
    google_workspace: { connected: false },
    gmail: { connected: false },
    google_calendar: { connected: false },
  };

  const [driveRes, gmailRes, calendarRes] = await Promise.all([
    supabase
      .from('drive_connections')
      .select('email, is_active')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('gmail_oauth_tokens')
      .select('email')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('google_calendar_connections')
      .select('email')
      .limit(1)
      .maybeSingle(),
  ]);

  if (driveRes.data?.is_active) {
    result.google_workspace = { connected: true, email: driveRes.data.email || undefined };
  }
  if (gmailRes.data) {
    result.gmail = { connected: true, email: gmailRes.data.email || undefined };
  }
  if (calendarRes.data) {
    result.google_calendar = { connected: true, email: calendarRes.data.email || undefined };
  }

  return result;
}

export async function getIntegrationByKey(key: string): Promise<Integration | null> {
  const { data, error } = await supabase
    .from('integrations')
    .select(`
      *,
      integration_connections!integration_connections_integration_id_fkey (
        id,
        status,
        account_info,
        error_message,
        connected_at,
        connected_by,
        user_id
      )
    `)
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    connection: data.integration_connections?.[0] || null,
  } as Integration;
}

export async function getIntegrationUsage(integrationKey: string): Promise<ModuleIntegrationRequirement[]> {
  const { data, error } = await supabase
    .from('module_integration_requirements')
    .select('*')
    .eq('integration_key', integrationKey);

  if (error) throw error;
  return data || [];
}

export async function getConnectedIntegrations(): Promise<Integration[]> {
  return getIntegrations({ connected: true });
}

export async function getUserIntegrations(userId?: string): Promise<IntegrationConnection[]> {
  let query = supabase
    .from('integration_connections')
    .select(`
      *,
      integrations (
        id,
        key,
        name,
        category,
        scope,
        icon_url
      )
    `)
    .not('user_id', 'is', null);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function initiateOAuthConnection(integrationKey: string): Promise<InitiateOAuthResponse> {
  const response = await fetchEdge(SLUG, {
    body: { action: 'initiate_oauth', integration_key: integrationKey },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Failed to initiate OAuth');
  }
  return response.json();
}

export async function connectWithApiKey(input: ConnectApiKeyInput): Promise<IntegrationConnection> {
  const response = await fetchEdge(SLUG, {
    body: { action: 'connect_api_key', integration_key: input.integration_key, credentials: input.credentials },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Failed to connect');
  }
  return response.json();
}

export async function disconnectIntegration(
  integrationKey: string,
  force?: boolean
): Promise<{ success: boolean; affected_modules?: string[] }> {
  const response = await fetchEdge(SLUG, {
    body: { action: 'disconnect', integration_key: integrationKey, force },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Failed to disconnect');
  }
  return response.json();
}

export async function toggleIntegration(integrationKey: string, enabled: boolean): Promise<Integration> {
  const { data: integration, error: fetchError } = await supabase
    .from('integrations')
    .select('id')
    .eq('key', integrationKey)
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabase
    .from('integrations')
    .update({ enabled })
    .eq('id', integration.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function testIntegrationConnection(integrationKey: string): Promise<{ success: boolean; message: string }> {
  const response = await fetchEdge(SLUG, {
    body: { action: 'test', integration_key: integrationKey },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Connection test failed');
  }
  return response.json();
}

export async function getIntegrationLogs(filters?: IntegrationLogFilters): Promise<IntegrationLog[]> {
  let query = supabase
    .from('integration_logs')
    .select(`
      *,
      integrations (
        id,
        key,
        name,
        icon_url
      ),
      users (
        id,
        name,
        email
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters?.integrationId) {
    query = query.eq('integration_id', filters.integrationId);
  }
  if (filters?.action?.length) {
    query = query.in('action', filters.action);
  }
  if (filters?.status?.length) {
    query = query.in('status', filters.status);
  }
  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((log) => ({
    ...log,
    integration: log.integrations,
    user: log.users,
  })) as IntegrationLog[];
}

export async function getIntegrationStats(): Promise<IntegrationStats> {
  const [integrations, connections] = await Promise.all([
    supabase.from('integrations').select('id, scope', { count: 'exact' }),
    supabase.from('integration_connections').select('id, status, user_id', { count: 'exact' }),
  ]);

  const connectedCount = connections.data?.filter((c) => c.status === 'connected').length || 0;
  const userConnections = connections.data?.filter((c) => c.user_id && c.status === 'connected').length || 0;

  return {
    totalIntegrations: integrations.count || 0,
    connectedIntegrations: connectedCount,
    userIntegrations: userConnections,
    healthyIntegrations: connectedCount,
    degradedIntegrations: 0,
  };
}

export async function logIntegrationAction(
  integrationId: string | null,
  action: IntegrationLog['action'],
  status: 'success' | 'failure',
  errorMessage?: string,
  requestMeta?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('integration_logs').insert({
    integration_id: integrationId,
    action,
    status,
    error_message: errorMessage || null,
    request_meta: requestMeta || null,
  });

  if (error) {
    console.error('Failed to log integration action:', error);
  }
}
