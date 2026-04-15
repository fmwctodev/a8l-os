import { supabase } from '../lib/supabase';

export type WorkspaceProvider = 'google' | 'microsoft' | null;

let cachedProvider: WorkspaceProvider = null;
let cachedUserId: string | null = null;

export async function getWorkspaceProvider(userId: string): Promise<WorkspaceProvider> {
  if (cachedProvider && cachedUserId === userId) return cachedProvider;

  // Check Microsoft first
  const { data: msToken } = await supabase
    .from('microsoft_oauth_master')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (msToken) {
    cachedProvider = 'microsoft';
    cachedUserId = userId;
    return 'microsoft';
  }

  // Check Google
  const { data: googleToken } = await supabase
    .from('google_oauth_master')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (googleToken) {
    cachedProvider = 'google';
    cachedUserId = userId;
    return 'google';
  }

  cachedProvider = null;
  cachedUserId = userId;
  return null;
}

export function clearProviderCache(): void {
  cachedProvider = null;
  cachedUserId = null;
}
