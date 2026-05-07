import { supabase } from '../lib/supabase';
import type { FeatureFlag } from '../types';

/**
 * Fetches all feature flags visible to the current user. Returns a list
 * containing both global rows (organization_id IS NULL) and per-org
 * overrides for the user's current org. Per-org rows override globals.
 *
 * The returned list is already collapsed: there is at most ONE row per
 * `key` — the per-org one if it exists, otherwise the global default.
 */
export async function getFeatureFlags(orgId?: string | null): Promise<FeatureFlag[]> {
  const filter = orgId
    ? `organization_id.eq.${orgId},organization_id.is.null`
    : 'organization_id.is.null';

  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .or(filter)
    .order('key');

  if (error) throw error;

  // Collapse: per-org row beats global for the same key.
  const map = new Map<string, FeatureFlag>();
  for (const row of (data ?? []) as FeatureFlag[]) {
    const existing = map.get(row.key);
    if (!existing) {
      map.set(row.key, row);
    } else if (row.organization_id && !existing.organization_id) {
      map.set(row.key, row);
    }
  }
  return Array.from(map.values());
}

export async function isFeatureEnabled(key: string, orgId?: string | null): Promise<boolean> {
  const flags = await getFeatureFlags(orgId);
  const flag = flags.find((f) => f.key === key);
  return flag?.enabled ?? false;
}

export async function getEnabledFeatures(orgId?: string | null): Promise<string[]> {
  const flags = await getFeatureFlags(orgId);
  return flags.filter((f) => f.enabled).map((f) => f.key);
}

export async function updateFeatureFlag(
  id: string,
  enabled: boolean
): Promise<FeatureFlag> {
  const { data, error } = await supabase
    .from('feature_flags')
    .update({ enabled })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as FeatureFlag;
}
