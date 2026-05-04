import { supabase } from '../lib/supabase';

export interface TrackedLink {
  id: string;
  org_id: string;
  slug: string;
  destination_url: string;
  name: string | null;
  contact_id: string | null;
  workflow_id: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  expires_at: string | null;
  click_count: number;
  last_clicked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackedLinkClick {
  id: string;
  org_id: string;
  tracked_link_id: string;
  contact_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  query_params: Record<string, string> | null;
  clicked_at: string;
}

export interface CreateTrackedLinkInput {
  destinationUrl: string;
  name?: string;
  contactId?: string;
  workflowId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  customSlug?: string;
}

function randomSlug(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function buildTrackedLinkUrl(slug: string, contactId?: string): string {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
  const base = `${supabaseUrl}/functions/v1/link-redirect/${slug}`;
  return contactId ? `${base}?c=${contactId}` : base;
}

export async function createTrackedLink(
  orgId: string,
  input: CreateTrackedLinkInput
): Promise<TrackedLink> {
  const slug = input.customSlug?.trim() || randomSlug();

  const { data, error } = await supabase
    .from('tracked_links')
    .insert({
      org_id: orgId,
      slug,
      destination_url: input.destinationUrl,
      name: input.name || null,
      contact_id: input.contactId || null,
      workflow_id: input.workflowId || null,
      metadata: input.metadata || {},
      expires_at: input.expiresAt || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as TrackedLink;
}

export async function getTrackedLinks(orgId: string): Promise<TrackedLink[]> {
  const { data, error } = await supabase
    .from('tracked_links')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as TrackedLink[];
}

export async function getTrackedLink(id: string): Promise<TrackedLink | null> {
  const { data, error } = await supabase
    .from('tracked_links')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as TrackedLink | null;
}

export async function updateTrackedLink(
  id: string,
  patch: Partial<Pick<TrackedLink, 'name' | 'destination_url' | 'is_active' | 'expires_at' | 'metadata'>>
): Promise<TrackedLink> {
  const { data, error } = await supabase
    .from('tracked_links')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as TrackedLink;
}

export async function deleteTrackedLink(id: string): Promise<void> {
  const { error } = await supabase.from('tracked_links').delete().eq('id', id);
  if (error) throw error;
}

export async function getTrackedLinkClicks(
  trackedLinkId: string,
  limit = 100
): Promise<TrackedLinkClick[]> {
  const { data, error } = await supabase
    .from('tracked_link_clicks')
    .select('*')
    .eq('tracked_link_id', trackedLinkId)
    .order('clicked_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as TrackedLinkClick[];
}
