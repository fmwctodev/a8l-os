import { supabase } from '../lib/supabase';
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

export async function disconnectProvider(id: string): Promise<void> {
  const { error } = await supabase
    .from('review_providers')
    .update({
      status: 'disconnected' as ReviewProviderStatus,
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
