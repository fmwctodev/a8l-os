import { supabase } from '../lib/supabase';
import { callEdgeFunction, parseEdgeFunctionError } from '../lib/edgeFunction';
import type {
  SocialAccount,
  SocialOAuthState,
  SocialProvider,
  SocialStats,
} from '../types';

export async function getSocialAccounts(
  organizationId: string
): Promise<SocialAccount[]> {
  const { data, error } = await supabase
    .from('social_accounts')
    .select(`
      *,
      connected_by_user:users!social_accounts_connected_by_fkey(id, name, email, avatar_url)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getSocialAccountById(id: string): Promise<SocialAccount | null> {
  const { data, error } = await supabase
    .from('social_accounts')
    .select(`
      *,
      connected_by_user:users!social_accounts_connected_by_fkey(id, name, email, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getSocialAccountsByProvider(
  organizationId: string,
  provider: SocialProvider
): Promise<SocialAccount[]> {
  const { data, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('provider', provider)
    .eq('status', 'connected');

  if (error) throw error;
  return data || [];
}

export async function disconnectSocialAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_accounts')
    .update({
      status: 'disconnected',
      access_token_encrypted: null,
      refresh_token_encrypted: null,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteSocialAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_accounts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function createOAuthState(
  organizationId: string,
  userId: string,
  provider: SocialProvider,
  redirectUri: string,
  meta?: Record<string, unknown>
): Promise<SocialOAuthState> {
  const stateToken = crypto.randomUUID() + '-' + Date.now().toString(36);

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  const { data, error } = await supabase
    .from('social_oauth_states')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      provider,
      state_token: stateToken,
      redirect_uri: redirectUri,
      meta: meta || {},
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOAuthStateByToken(token: string): Promise<SocialOAuthState | null> {
  const { data, error } = await supabase
    .from('social_oauth_states')
    .select('*')
    .eq('state_token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteOAuthState(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_oauth_states')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function cleanupExpiredOAuthStates(): Promise<void> {
  const { error } = await supabase
    .from('social_oauth_states')
    .delete()
    .lt('expires_at', new Date().toISOString());

  if (error) throw error;
}

export async function getSocialStats(organizationId: string): Promise<SocialStats> {
  const { data: accounts, error: accountsError } = await supabase
    .from('social_accounts')
    .select('id, status')
    .eq('organization_id', organizationId);

  if (accountsError) throw accountsError;

  const connectedAccounts = accounts?.filter((a) => a.status === 'connected').length || 0;

  const { count: scheduledPosts, error: scheduledError } = await supabase
    .from('social_posts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'scheduled');

  if (scheduledError) throw scheduledError;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { count: postedThisWeek, error: postedError } = await supabase
    .from('social_posts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'posted')
    .gte('posted_at', weekAgo.toISOString());

  if (postedError) throw postedError;

  const { count: failedPosts, error: failedError } = await supabase
    .from('social_posts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'failed');

  if (failedError) throw failedError;

  return {
    connectedAccounts,
    scheduledPosts: scheduledPosts || 0,
    postedThisWeek: postedThisWeek || 0,
    failedPosts: failedPosts || 0,
  };
}

export function getProviderDisplayName(provider: SocialProvider): string {
  const names: Record<SocialProvider, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    google_business: 'Google Business Profile',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    reddit: 'Reddit',
  };
  return names[provider];
}

export function getProviderColor(provider: SocialProvider): string {
  const colors: Record<SocialProvider, string> = {
    facebook: '#1877F2',
    instagram: '#E4405F',
    linkedin: '#0A66C2',
    google_business: '#4285F4',
    tiktok: '#000000',
    youtube: '#FF0000',
    reddit: '#FF4500',
  };
  return colors[provider];
}

export async function connectViaLate(
  provider: SocialProvider,
  successRedirectUrl?: string,
  failureRedirectUrl?: string
): Promise<{ url: string }> {
  const response = await callEdgeFunction('late-connect', {
    provider,
    success_redirect_url: successRedirectUrl || window.location.href,
    failure_redirect_url: failureRedirectUrl || window.location.href,
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(parseEdgeFunctionError(json, 'Failed to generate connection URL'));
  }
  return json.data;
}

export async function reconnectViaLate(
  accountId: string,
  provider: SocialProvider
): Promise<{ url: string }> {
  const response = await callEdgeFunction('late-connect', {
    provider,
    reconnect_account_id: accountId,
    success_redirect_url: window.location.href,
    failure_redirect_url: window.location.href,
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(parseEdgeFunctionError(json, 'Failed to generate reconnection URL'));
  }
  return json.data;
}
