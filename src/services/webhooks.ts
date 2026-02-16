import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edgeFunction';
import type {
  OutgoingWebhook,
  WebhookDelivery,
  WebhookHealth,
  WebhookFilters,
  WebhookDeliveryFilters,
  CreateWebhookInput,
  UpdateWebhookInput,
} from '../types';

const SLUG = 'integrations-webhooks';

export async function getWebhooks(filters?: WebhookFilters): Promise<OutgoingWebhook[]> {
  let query = supabase
    .from('outgoing_webhooks')
    .select(`
      *,
      users:created_by (
        id,
        name,
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (filters?.enabled !== undefined) {
    query = query.eq('enabled', filters.enabled);
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,url.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((webhook) => ({
    ...webhook,
    created_by_user: webhook.users,
  })) as OutgoingWebhook[];
}

export async function getWebhook(id: string): Promise<OutgoingWebhook | null> {
  const { data, error } = await supabase
    .from('outgoing_webhooks')
    .select(`
      *,
      users:created_by (
        id,
        name,
        email
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    created_by_user: data.users,
  } as OutgoingWebhook;
}

export async function createWebhook(input: CreateWebhookInput): Promise<OutgoingWebhook> {
  const response = await fetchEdge(SLUG, { body: { action: 'create', ...input } });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Failed to create webhook');
  }
  return response.json();
}

export async function updateWebhook(id: string, input: UpdateWebhookInput): Promise<OutgoingWebhook> {
  const { data, error } = await supabase
    .from('outgoing_webhooks')
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.url !== undefined && { url: input.url }),
      ...(input.events !== undefined && { events: input.events }),
      ...(input.headers !== undefined && { headers: input.headers }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.retry_count !== undefined && { retry_count: input.retry_count }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWebhook(id: string): Promise<void> {
  const { error } = await supabase
    .from('outgoing_webhooks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleWebhook(id: string, enabled: boolean): Promise<OutgoingWebhook> {
  const { data, error } = await supabase
    .from('outgoing_webhooks')
    .update({ enabled })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function testWebhook(id: string): Promise<{ success: boolean; response_code?: number; error?: string }> {
  const response = await fetchEdge(SLUG, { body: { action: 'test', webhook_id: id } });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Test delivery failed');
  }
  return response.json();
}

export async function getWebhookDeliveries(filters?: WebhookDeliveryFilters): Promise<WebhookDelivery[]> {
  let query = supabase
    .from('webhook_deliveries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters?.webhookId) {
    query = query.eq('webhook_id', filters.webhookId);
  }
  if (filters?.status?.length) {
    query = query.in('status', filters.status);
  }
  if (filters?.eventType?.length) {
    query = query.in('event_type', filters.eventType);
  }
  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getWebhookHealth(webhookId: string): Promise<WebhookHealth> {
  const { data, error } = await supabase.rpc('get_webhook_health', { p_webhook_id: webhookId });

  if (error) throw error;

  const result = data?.[0] || {
    total_deliveries: 0,
    successful_deliveries: 0,
    failed_deliveries: 0,
    pending_deliveries: 0,
    success_rate: 0,
    last_success: null,
    last_failure: null,
  };

  return result as WebhookHealth;
}

export async function getWebhookStats(): Promise<{
  totalWebhooks: number;
  activeWebhooks: number;
  deliveriesLast24h: number;
  failuresLast24h: number;
}> {
  const [webhooksResult, deliveriesResult] = await Promise.all([
    supabase.from('outgoing_webhooks').select('id, enabled', { count: 'exact' }),
    supabase
      .from('webhook_deliveries')
      .select('status', { count: 'exact' })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const activeCount = webhooksResult.data?.filter((w) => w.enabled).length || 0;
  const failureCount = deliveriesResult.data?.filter((d) => d.status === 'failed').length || 0;

  return {
    totalWebhooks: webhooksResult.count || 0,
    activeWebhooks: activeCount,
    deliveriesLast24h: deliveriesResult.count || 0,
    failuresLast24h: failureCount,
  };
}

export async function retryWebhookDelivery(deliveryId: string): Promise<void> {
  const { error } = await supabase
    .from('webhook_deliveries')
    .update({
      status: 'pending',
      next_retry_at: new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .eq('status', 'failed');

  if (error) throw error;
}
