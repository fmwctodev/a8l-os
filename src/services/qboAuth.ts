import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';
import type { QBOConnection } from '../types';

export async function getQBOConnection(): Promise<QBOConnection | null> {
  const { data, error } = await supabase
    .from('qbo_connections')
    .select('*, connected_by_user:users!qbo_connections_connected_by_fkey(id, name, email)')
    .maybeSingle();

  if (error) {
    console.error('Error fetching QBO connection:', error);
  }

  if (data) return data;

  const { data: intConn } = await supabase
    .from('integration_connections')
    .select('id, org_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, account_info, connected_by, connected_at')
    .eq('status', 'connected')
    .maybeSingle();

  if (!intConn || !intConn.account_info?.realm_id) return null;

  return {
    id: intConn.id,
    org_id: intConn.org_id,
    realm_id: intConn.account_info.realm_id,
    company_name: intConn.account_info.company_name || 'QuickBooks Company',
    access_token_encrypted: intConn.access_token_encrypted,
    refresh_token_encrypted: intConn.refresh_token_encrypted,
    token_expiry: intConn.token_expires_at,
    last_sync_at: null,
    connected_by: intConn.connected_by,
    created_at: intConn.connected_at,
    updated_at: intConn.connected_at,
  } as QBOConnection;
}

export async function isQBOConnected(): Promise<boolean> {
  const connection = await getQBOConnection();
  return connection !== null;
}

export async function generateQBOAuthUrl(orgId: string, redirectUri: string): Promise<string> {
  const response = await callEdgeFunction('qbo-oauth-start', { orgId, redirectUri });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate QBO auth URL');
  }

  const data = await response.json();
  return data.authUrl;
}

export async function exchangeQBOCode(
  code: string,
  realmId: string,
  redirectUri: string
): Promise<QBOConnection> {
  const response = await callEdgeFunction('qbo-oauth-callback', { code, realmId, redirectUri });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to exchange QBO authorization code');
  }

  const data = await response.json();
  return data.connection;
}

export async function refreshQBOToken(): Promise<void> {
  const response = await callEdgeFunction('qbo-oauth-callback', { action: 'refresh' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to refresh QBO token');
  }
}

export async function disconnectQBO(): Promise<void> {
  const response = await callEdgeFunction('qbo-oauth-callback', { action: 'disconnect' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to disconnect QBO');
  }
}

export async function getQBOConnectionStatus(): Promise<{
  connected: boolean;
  companyName?: string;
  realmId?: string;
  lastSyncAt?: string;
  tokenExpiring?: boolean;
}> {
  const connection = await getQBOConnection();

  if (!connection) {
    return { connected: false };
  }

  const tokenExpiry = new Date(connection.token_expiry);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  const tokenExpiring = tokenExpiry <= fiveMinutesFromNow;

  return {
    connected: true,
    companyName: connection.company_name,
    realmId: connection.realm_id,
    lastSyncAt: connection.last_sync_at || undefined,
    tokenExpiring,
  };
}