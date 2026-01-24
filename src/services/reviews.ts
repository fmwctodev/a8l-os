import { supabase } from '../lib/supabase';
import type { Review, ReviewFilters, CreateManualReviewInput } from '../types';

export async function getReviews(
  orgId: string,
  filters: ReviewFilters = {},
  page = 1,
  pageSize = 50
): Promise<{ data: Review[]; count: number }> {
  let query = supabase
    .from('reviews')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone),
      review_request:review_requests(id, public_slug, channel)
    `, { count: 'exact' })
    .eq('organization_id', orgId)
    .order('received_at', { ascending: false });

  if (filters.provider && filters.provider.length > 0) {
    query = query.in('provider', filters.provider);
  }

  if (filters.rating && filters.rating.length > 0) {
    query = query.in('rating', filters.rating);
  }

  if (filters.linked !== undefined) {
    if (filters.linked) {
      query = query.not('contact_id', 'is', null);
    } else {
      query = query.is('contact_id', null);
    }
  }

  if (filters.startDate) {
    query = query.gte('received_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('received_at', filters.endDate);
  }

  const offset = (page - 1) * pageSize;
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  let reviews = data as Review[];

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    reviews = reviews.filter((review) => {
      return (
        review.reviewer_name.toLowerCase().includes(searchLower) ||
        review.reviewer_email?.toLowerCase().includes(searchLower) ||
        review.comment?.toLowerCase().includes(searchLower)
      );
    });
  }

  return { data: reviews, count: count || 0 };
}

export async function getReviewById(id: string): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone),
      review_request:review_requests(id, public_slug, channel)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Review | null;
}

export async function getReviewsByContact(contactId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('contact_id', contactId)
    .order('received_at', { ascending: false });

  if (error) throw error;
  return data as Review[];
}

export async function createManualReview(
  orgId: string,
  input: CreateManualReviewInput,
  userId: string
): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      organization_id: orgId,
      provider: input.provider,
      contact_id: input.contact_id || null,
      rating: input.rating,
      comment: input.comment || null,
      reviewer_name: input.reviewer_name,
      reviewer_email: input.reviewer_email || null,
      published: input.provider !== 'internal',
      received_at: input.received_at || new Date().toISOString(),
    })
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone)
    `)
    .single();

  if (error) throw error;

  if (input.contact_id) {
    await supabase.from('contact_timeline').insert({
      contact_id: input.contact_id,
      event_type: input.rating >= 4 ? 'review_submitted' : 'negative_feedback_received',
      event_data: {
        review_id: data.id,
        rating: input.rating,
        provider: input.provider,
      },
    });
  }

  await supabase.from('event_outbox').insert({
    org_id: orgId,
    event_type: 'review.submitted',
    contact_id: input.contact_id || null,
    entity_type: 'review',
    entity_id: data.id,
    payload: {
      review_id: data.id,
      rating: input.rating,
      provider: input.provider,
      contact_id: input.contact_id || null,
    },
  });

  return data as Review;
}

export async function linkReviewToContact(
  reviewId: string,
  contactId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .update({
      contact_id: contactId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (error) throw error;

  const { data: review } = await supabase
    .from('reviews')
    .select('rating, provider')
    .eq('id', reviewId)
    .single();

  if (review) {
    await supabase.from('contact_timeline').insert({
      contact_id: contactId,
      event_type: 'review_submitted',
      event_data: {
        review_id: reviewId,
        rating: review.rating,
        provider: review.provider,
      },
    });
  }
}

export async function unlinkReview(reviewId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .update({
      contact_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (error) throw error;
}

export async function respondToReview(
  reviewId: string,
  response: string,
  userId: string,
  source: 'manual' | 'ai' = 'manual'
): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .update({
      response,
      responded_at: new Date().toISOString(),
      responded_by: userId,
      response_source: source,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone),
      review_request:review_requests(id, public_slug, channel),
      responded_by_user:users!responded_by(id, name, email)
    `)
    .single();

  if (error) throw error;
  return data as Review;
}

export async function markReviewAsSpam(reviewId: string, isSpam: boolean): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .update({
      is_spam: isSpam,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (error) throw error;
}

export async function getSentimentStats(
  orgId: string,
  startDate?: string,
  endDate?: string
): Promise<{ positive: number; neutral: number; negative: number }> {
  let query = supabase
    .from('reviews')
    .select('rating')
    .eq('organization_id', orgId)
    .eq('is_spam', false);

  if (startDate) query = query.gte('received_at', startDate);
  if (endDate) query = query.lte('received_at', endDate);

  const { data, error } = await query;
  if (error) throw error;

  const reviews = data || [];
  return {
    positive: reviews.filter(r => r.rating >= 4).length,
    neutral: reviews.filter(r => r.rating === 3).length,
    negative: reviews.filter(r => r.rating <= 2).length,
  };
}
