import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';
import type { Review, ReviewFilters, CreateManualReviewInput, ReviewAIAnalysis } from '../types';

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
      review_request:review_requests(id, public_slug, channel),
      ai_analysis:review_ai_analysis(*)
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
      review_request:review_requests(id, public_slug, channel),
      ai_analysis:review_ai_analysis(*)
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

export async function markReviewAsSpam(
  reviewId: string,
  isSpam: boolean,
  userId: string,
  reason?: string
): Promise<void> {
  const { data: review } = await supabase
    .from('reviews')
    .select('organization_id, is_spam')
    .eq('id', reviewId)
    .single();

  if (!review) throw new Error('Review not found');

  const { error } = await supabase
    .from('reviews')
    .update({
      is_spam: isSpam,
      spam_reason: isSpam ? reason : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (error) throw error;

  await supabase.from('review_moderation_log').insert({
    organization_id: review.organization_id,
    review_id: reviewId,
    action: isSpam ? 'spam_flagged' : 'spam_unflagged',
    performed_by: userId,
    previous_value: { is_spam: review.is_spam },
    new_value: { is_spam: isSpam },
    reason,
  });
}

export async function hideReview(
  reviewId: string,
  hidden: boolean,
  userId: string,
  reason?: string
): Promise<void> {
  const { data: review } = await supabase
    .from('reviews')
    .select('organization_id, hidden')
    .eq('id', reviewId)
    .single();

  if (!review) throw new Error('Review not found');

  const { error } = await supabase
    .from('reviews')
    .update({
      hidden,
      hidden_at: hidden ? new Date().toISOString() : null,
      hidden_by: hidden ? userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (error) throw error;

  await supabase.from('review_moderation_log').insert({
    organization_id: review.organization_id,
    review_id: reviewId,
    action: hidden ? 'hidden' : 'unhidden',
    performed_by: userId,
    previous_value: { hidden: review.hidden },
    new_value: { hidden },
    reason,
  });
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
    .eq('is_spam', false)
    .eq('hidden', false);

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

export async function getAIAnalysis(reviewId: string): Promise<ReviewAIAnalysis | null> {
  const { data, error } = await supabase
    .from('review_ai_analysis')
    .select('*')
    .eq('review_id', reviewId)
    .maybeSingle();

  if (error) throw error;
  return data as ReviewAIAnalysis | null;
}

export async function analyzeReview(reviewId: string): Promise<ReviewAIAnalysis> {
  const response = await callEdgeFunction('review-ai-analyze', {
    review_id: reviewId,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to analyze review');
  }

  const data = await response.json();
  return data.analysis as ReviewAIAnalysis;
}

export async function generateAIReply(
  reviewId: string,
  tone?: string
): Promise<{ reply: string; provider: string }> {
  const response = await callEdgeFunction('review-ai-reply', {
    review_id: reviewId,
    tone,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate reply');
  }

  const data = await response.json();
  return { reply: data.reply, provider: data.provider };
}

export async function postReplyToProvider(
  reviewId: string,
  replyText: string,
  orgId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: review } = await supabase
    .from('reviews')
    .select('provider')
    .eq('id', reviewId)
    .single();

  if (!review) {
    return { success: false, error: 'Review not found' };
  }

  if (review.provider === 'internal') {
    await respondToReview(reviewId, replyText, userId, 'manual');
    return { success: true };
  }

  const response = await callEdgeFunction('review-reply-post', {
    review_id: reviewId,
    reply_text: replyText,
    organization_id: orgId,
    provider: review.provider,
    user_id: userId,
  });

  const data = await response.json();
  return { success: data.success, error: data.error };
}

export async function getModerationLog(
  reviewId: string
): Promise<Array<{
  id: string;
  action: string;
  performed_by: string;
  reason: string | null;
  created_at: string;
  user?: { name: string; email: string };
}>> {
  const { data, error } = await supabase
    .from('review_moderation_log')
    .select(`
      *,
      user:users!performed_by(name, email)
    `)
    .eq('review_id', reviewId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getReviewAnalytics(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<{
  avgRating: number;
  totalReviews: number;
  responseRate: number;
  avgResponseTime: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  providerBreakdown: Record<string, number>;
  ratingTrend: Array<{ date: string; avgRating: number; count: number }>;
}> {
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_spam', false)
    .eq('hidden', false)
    .gte('received_at', startDate)
    .lte('received_at', endDate)
    .order('received_at', { ascending: true });

  if (error) throw error;

  const reviewsData = reviews || [];
  const totalReviews = reviewsData.length;

  const avgRating = totalReviews > 0
    ? reviewsData.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;

  const respondedReviews = reviewsData.filter(r => r.responded_at);
  const responseRate = totalReviews > 0
    ? (respondedReviews.length / totalReviews) * 100
    : 0;

  const responseTimes = respondedReviews
    .filter(r => r.responded_at && r.received_at)
    .map(r => {
      const received = new Date(r.received_at).getTime();
      const responded = new Date(r.responded_at!).getTime();
      return (responded - received) / (1000 * 60 * 60);
    });

  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
    : 0;

  const sentimentBreakdown = {
    positive: reviewsData.filter(r => r.rating >= 4).length,
    neutral: reviewsData.filter(r => r.rating === 3).length,
    negative: reviewsData.filter(r => r.rating <= 2).length,
  };

  const providerBreakdown: Record<string, number> = {};
  for (const r of reviewsData) {
    providerBreakdown[r.provider] = (providerBreakdown[r.provider] || 0) + 1;
  }

  const ratingsByDate: Record<string, { total: number; count: number }> = {};
  for (const r of reviewsData) {
    const date = r.received_at.split('T')[0];
    if (!ratingsByDate[date]) {
      ratingsByDate[date] = { total: 0, count: 0 };
    }
    ratingsByDate[date].total += r.rating;
    ratingsByDate[date].count += 1;
  }

  const ratingTrend = Object.entries(ratingsByDate).map(([date, data]) => ({
    date,
    avgRating: data.total / data.count,
    count: data.count,
  }));

  return {
    avgRating: Math.round(avgRating * 10) / 10,
    totalReviews,
    responseRate: Math.round(responseRate * 10) / 10,
    avgResponseTime: Math.round(avgResponseTime * 10) / 10,
    sentimentBreakdown,
    providerBreakdown,
    ratingTrend,
  };
}
