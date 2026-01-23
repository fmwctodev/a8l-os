import { supabase } from '../lib/supabase';
import type { ReviewRequest, CreateReviewRequestInput, ReviewRequestFilters, MessageChannel } from '../types';
import { findOrCreateConversation } from './conversations';
import { createMessage } from './messages';

function generatePublicSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 12; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

export async function createReviewRequest(
  orgId: string,
  input: CreateReviewRequestInput,
  userId: string
): Promise<ReviewRequest> {
  const publicSlug = generatePublicSlug();
  const reviewLinkUrl = `${window.location.origin}/r/${publicSlug}`;

  const { data, error } = await supabase
    .from('review_requests')
    .insert({
      organization_id: orgId,
      contact_id: input.contact_id,
      public_slug: publicSlug,
      provider_preference: input.provider_preference || 'smart',
      channel: input.channel,
      message_template: input.message_template,
      review_link_url: reviewLinkUrl,
      created_by: userId,
    })
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone),
      created_by_user:users!created_by(id, name, email)
    `)
    .single();

  if (error) throw error;
  return data as ReviewRequest;
}

export async function sendReviewRequest(
  requestId: string,
  userId: string
): Promise<void> {
  const { data: request, error: fetchError } = await supabase
    .from('review_requests')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone)
    `)
    .eq('id', requestId)
    .single();

  if (fetchError) throw fetchError;
  if (!request) throw new Error('Review request not found');
  if (request.sent_at) throw new Error('Review request already sent');

  const conversation = await findOrCreateConversation(
    request.organization_id,
    request.contact_id
  );

  await createMessage(
    request.organization_id,
    conversation.id,
    request.contact_id,
    request.channel as MessageChannel,
    'outbound',
    request.message_template,
    {},
    request.channel === 'email' ? 'We would love your feedback' : undefined
  );

  const { error: updateError } = await supabase
    .from('review_requests')
    .update({
      sent_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) throw updateError;

  await supabase.from('contact_timeline').insert({
    contact_id: request.contact_id,
    event_type: 'review_request_sent',
    event_data: {
      request_id: requestId,
      channel: request.channel,
    },
  });

  await supabase.from('event_outbox').insert({
    org_id: request.organization_id,
    event_type: 'review.requested',
    contact_id: request.contact_id,
    entity_type: 'review_request',
    entity_id: requestId,
    payload: {
      contact_id: request.contact_id,
      request_id: requestId,
      channel: request.channel,
    },
  });
}

export async function getReviewRequests(
  orgId: string,
  filters: ReviewRequestFilters = {},
  page = 1,
  pageSize = 50
): Promise<{ data: ReviewRequest[]; count: number }> {
  let query = supabase
    .from('review_requests')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone),
      created_by_user:users!created_by(id, name, email)
    `, { count: 'exact' })
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (filters.channel && filters.channel.length > 0) {
    query = query.in('channel', filters.channel);
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const offset = (page - 1) * pageSize;
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  let requests = data as ReviewRequest[];

  if (filters.status && filters.status.length > 0) {
    requests = requests.filter((req) => {
      const status = req.completed_at
        ? 'completed'
        : req.clicked_at
        ? 'clicked'
        : req.sent_at
        ? 'sent'
        : 'pending';
      return filters.status!.includes(status);
    });
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    requests = requests.filter((req) => {
      const contact = req.contact;
      if (!contact) return false;
      const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
      return (
        fullName.includes(searchLower) ||
        contact.email?.toLowerCase().includes(searchLower) ||
        contact.phone?.includes(searchLower)
      );
    });
  }

  return { data: requests, count: count || 0 };
}

export async function getReviewRequestBySlug(slug: string): Promise<ReviewRequest | null> {
  const { data, error } = await supabase
    .from('review_requests')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone)
    `)
    .eq('public_slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data as ReviewRequest | null;
}

export async function trackClick(slug: string): Promise<void> {
  const { data: request } = await supabase
    .from('review_requests')
    .select('id, organization_id, contact_id, clicked_at')
    .eq('public_slug', slug)
    .single();

  if (!request || request.clicked_at) return;

  const { error } = await supabase
    .from('review_requests')
    .update({
      clicked_at: new Date().toISOString(),
    })
    .eq('public_slug', slug);

  if (error) throw error;

  await supabase.from('contact_timeline').insert({
    contact_id: request.contact_id,
    event_type: 'review_link_clicked',
    event_data: {
      request_id: request.id,
    },
  });

  await supabase.from('event_outbox').insert({
    org_id: request.organization_id,
    event_type: 'review.clicked',
    contact_id: request.contact_id,
    entity_type: 'review_request',
    entity_id: request.id,
    payload: {
      contact_id: request.contact_id,
      request_id: request.id,
    },
  });
}

export async function completeRequest(slug: string, rating: number): Promise<void> {
  const { error } = await supabase
    .from('review_requests')
    .update({
      completed_at: new Date().toISOString(),
    })
    .eq('public_slug', slug);

  if (error) throw error;
}

export async function resendRequest(requestId: string, userId: string): Promise<void> {
  const { data: oldRequest, error: fetchError } = await supabase
    .from('review_requests')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone)
    `)
    .eq('id', requestId)
    .single();

  if (fetchError) throw fetchError;
  if (!oldRequest) throw new Error('Review request not found');

  const newRequest = await createReviewRequest(
    oldRequest.organization_id,
    {
      contact_id: oldRequest.contact_id,
      channel: oldRequest.channel as 'sms' | 'email',
      message_template: oldRequest.message_template,
      provider_preference: oldRequest.provider_preference as 'smart' | 'google' | 'facebook' | 'internal',
    },
    userId
  );

  await sendReviewRequest(newRequest.id, userId);
}
