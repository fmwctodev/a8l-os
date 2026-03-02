import { supabase } from '../lib/supabase';
import { callEdgeFunction, parseEdgeFunctionError } from '../lib/edgeFunction';

export interface IntegrationStatus {
  id: string;
  org_id: string;
  provider: string;
  connected: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  accounts_connected: string | null;
  sync_success_count: number;
  sync_failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface RoutingRule {
  id: string;
  org_id: string;
  platform: string | null;
  min_rating: number | null;
  max_rating: number | null;
  assign_to_user_id: string | null;
  assign_to_role: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requires_manual_approval: boolean;
  created_at: string;
}

export async function getIntegrationStatus(
  orgId: string
): Promise<IntegrationStatus | null> {
  const { data, error } = await supabase
    .from('reputation_integration_status')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'late')
    .maybeSingle();
  if (error) throw error;
  return data as IntegrationStatus | null;
}

export async function disconnectIntegration(orgId: string): Promise<void> {
  const { error } = await supabase
    .from('reputation_integration_status')
    .update({
      connected: false,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .eq('provider', 'late');
  if (error) throw error;
}

export async function connectViaLate(
  provider: 'google_business' | 'facebook'
): Promise<{ url: string }> {
  const response = await callEdgeFunction('late-connect', {
    provider,
    return_path: '/reputation',
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(parseEdgeFunctionError(json, 'Failed to start connection'));
  }
  return json.data;
}

export async function testConnection(orgId: string): Promise<boolean> {
  try {
    const response = await callEdgeFunction('reputation-review-sync', {
      org_id: orgId,
    });
    const json = await response.json();
    return json.success === true;
  } catch {
    return false;
  }
}

export async function getRoutingRules(
  orgId: string
): Promise<RoutingRule[]> {
  const { data, error } = await supabase
    .from('reputation_routing_rules')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as RoutingRule[];
}

export async function createRoutingRule(
  orgId: string,
  rule: Omit<RoutingRule, 'id' | 'org_id' | 'created_at'>
): Promise<RoutingRule> {
  const { data, error } = await supabase
    .from('reputation_routing_rules')
    .insert({ org_id: orgId, ...rule })
    .select()
    .single();
  if (error) throw error;
  return data as RoutingRule;
}

export async function updateRoutingRule(
  ruleId: string,
  updates: Partial<Omit<RoutingRule, 'id' | 'org_id' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('reputation_routing_rules')
    .update(updates)
    .eq('id', ruleId);
  if (error) throw error;
}

export async function deleteRoutingRule(ruleId: string): Promise<void> {
  const { error } = await supabase
    .from('reputation_routing_rules')
    .delete()
    .eq('id', ruleId);
  if (error) throw error;
}
