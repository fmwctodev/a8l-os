import { supabase } from '../lib/supabase';
import type { FeatureFlag } from '../types';

export async function getFeatureFlags() {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('key');

  if (error) throw error;
  return data as FeatureFlag[];
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('key', key)
    .maybeSingle();

  if (error || !data) return false;
  return data.enabled;
}

export async function getEnabledFeatures(): Promise<string[]> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('key')
    .eq('enabled', true);

  if (error) return [];
  return data?.map((f: { key: string }) => f.key) || [];
}
