import { supabase } from '../lib/supabase';
import type { QBOConnection } from '../types';

const QBO_AUTH_ENDPOINT = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN_ENDPOINT = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_REVOKE_ENDPOINT = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

export async function getQBOConnection(): Promise<QBOConnection | null> {
  const { data, error } = await supabase
    .from('qbo_connections')
    .select('*, connected_by_user:users!qbo_connections_connected_by_fkey(id, name, email)')
    .maybeSingle();

  if (error) {
    console.error('Error fetching QBO connection:', error);
    throw error;
  }

  return data;
}

export async function isQBOConnected(): Promise<boolean> {
  const connection = await getQBOConnection();
  return connection !== null;
}

export function generateQBOAuthUrl(orgId: string, redirectUri: string): string {
  const clientId = import.meta.env.VITE_QBO_CLIENT_ID;
  if (!clientId) {
    throw new Error('QBO_CLIENT_ID is not configured');
  }

  const state = btoa(JSON.stringify({ orgId, timestamp: Date.now() }));
  const scope = 'com.intuit.quickbooks.accounting';

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope,
    redirect_uri: redirectUri,
    state,
  });

  return `${QBO_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeQBOCode(
  code: string,
  realmId: string,
  redirectUri: string
): Promise<QBOConnection> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/qbo-oauth-callback`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, realmId, redirectUri }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to exchange QBO authorization code');
  }

  const data = await response.json();
  return data.connection;
}

export async function refreshQBOToken(): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/qbo-oauth-callback`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'refresh' }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to refresh QBO token');
  }
}

export async function disconnectQBO(): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/qbo-oauth-callback`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'disconnect' }),
  });

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