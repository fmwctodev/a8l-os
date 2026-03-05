import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type { ReviewProviderConfig, ReviewProvider, ReviewProviderStatus } from '../types';

export async function getProviders(orgId: string): Promise<ReviewProviderConfig[]> {
  const { data, error } = await supabase
    .from('review_providers')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as ReviewProviderConfig[];
}

export async function getProviderByType(
  orgId: string,
  provider: ReviewProvider
): Promise<ReviewProviderConfig | null> {
  const { data, error } = await supabase
    .from('review_providers')
    .select('*')
    .eq('organization_id', orgId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) throw error;
  return data as ReviewProviderConfig | null;
}

export async function connectProvider(
  orgId: string,
  provider: ReviewProvider,
  config: {
    display_name: string;
    external_location_id?: string;
    api_credentials?: Record<string, unknown>;
    redirect_threshold?: number;
  }
): Promise<ReviewProviderConfig> {
  const { data, error } = await supabase
    .from('review_providers')
    .upsert(
      {
        organization_id: orgId,
        provider,
        display_name: config.display_name,
        external_location_id: config.external_location_id || null,
        api_credentials: config.api_credentials || {},
        status: 'connected',
        redirect_threshold: config.redirect_threshold || 4,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'organization_id,provider',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data as ReviewProviderConfig;
}

export async function connectProviderWithOAuth(
  orgId: string,
  provider: ReviewProvider,
  config: {
    display_name: string;
    external_location_id?: string;
    oauth_access_token: string;
    oauth_refresh_token?: string;
    oauth_token_expires_at?: string;
    oauth_scopes?: string[];
    api_credentials?: Record<string, unknown>;
    redirect_threshold?: number;
  }
): Promise<ReviewProviderConfig> {
  const { data, error } = await supabase
    .from('review_providers')
    .upsert(
      {
        organization_id: orgId,
        provider,
        display_name: config.display_name,
        external_location_id: config.external_location_id || null,
        oauth_access_token: config.oauth_access_token,
        oauth_refresh_token: config.oauth_refresh_token || null,
        oauth_token_expires_at: config.oauth_token_expires_at || null,
        oauth_scopes: config.oauth_scopes || null,
        api_credentials: config.api_credentials || {},
        status: 'connected',
        redirect_threshold: config.redirect_threshold || 4,
        sync_enabled: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'organization_id,provider',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data as ReviewProviderConfig;
}

export async function disconnectProvider(id: string): Promise<void> {
  const { error } = await supabase
    .from('review_providers')
    .update({
      status: 'disconnected' as ReviewProviderStatus,
      oauth_access_token: null,
      oauth_refresh_token: null,
      oauth_token_expires_at: null,
      sync_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function updateProviderConfig(
  id: string,
  updates: {
    display_name?: string;
    external_location_id?: string;
    api_credentials?: Record<string, unknown>;
    redirect_threshold?: number;
  }
): Promise<void> {
  const { error } = await supabase
    .from('review_providers')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function updateProvider(
  id: string,
  updates: Partial<ReviewProviderConfig>
): Promise<ReviewProviderConfig> {
  const { data, error } = await supabase
    .from('review_providers')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ReviewProviderConfig;
}

export async function toggleSync(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('review_providers')
    .update({
      sync_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function updateSyncInterval(id: string, hours: number): Promise<void> {
  const { error } = await supabase
    .from('review_providers')
    .update({
      sync_interval_hours: hours,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function syncProviderNow(
  providerId: string
): Promise<{ synced: number; errors: string[] }> {
  const response = await fetchEdge('review-sync-worker', {
    method: 'GET',
    params: { provider_id: providerId },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to sync provider');
  }

  const data = await response.json();
  const result = data.results?.[0] || { synced: 0, errors: [] };
  return { synced: result.synced, errors: result.errors };
}

export async function getSyncHistory(
  providerId: string,
  limit = 10
): Promise<Array<{
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  reviews_synced: number;
  error_message: string | null;
  created_at: string;
}>> {
  const { data, error } = await supabase
    .from('review_sync_queue')
    .select('*')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function initiateOAuthFlow(
  provider: ReviewProvider,
  orgId: string,
  redirectUri: string
): Promise<string> {
  const state = btoa(JSON.stringify({ provider, orgId, timestamp: Date.now() }));

  switch (provider) {
    case 'google': {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) throw new Error('Google OAuth not configured');

      const scopes = [
        'https://www.googleapis.com/auth/business.manage',
      ].join(' ');

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes,
        state,
        access_type: 'offline',
        prompt: 'consent',
      });

      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
