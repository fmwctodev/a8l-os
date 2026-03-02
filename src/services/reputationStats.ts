import { supabase } from '../lib/supabase';
import type { ReputationStats, Review, ReviewProvider } from '../types';

export async function getDashboardStats(
  orgId: string,
  period: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'all_time' = 'all_time'
): Promise<ReputationStats> {
  let startDate: string | undefined;
  const now = new Date();

  switch (period) {
    case 'last_7_days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'last_30_days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'last_90_days':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      break;
  }

  let reviewsQuery = supabase
    .from('reviews')
    .select('*')
    .eq('organization_id', orgId);

  if (startDate) {
    reviewsQuery = reviewsQuery.gte('received_at', startDate);
  }

  const { data: reviews, error: reviewsError } = await reviewsQuery;
  if (reviewsError) throw reviewsError;

  const reviewsData = reviews as Review[];
  const totalReviews = reviewsData.length;
  const avgRating = totalReviews > 0
    ? reviewsData.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;

  const reviewsByProvider: Record<ReviewProvider, number> = {
    google: 0,
    facebook: 0,
    internal: 0,
  };

  const ratingBreakdown: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const review of reviewsData) {
    reviewsByProvider[review.provider]++;
    ratingBreakdown[review.rating]++;
  }

  let requestsQuery = supabase
    .from('review_requests')
    .select('*')
    .eq('organization_id', orgId);

  if (startDate) {
    requestsQuery = requestsQuery.gte('created_at', startDate);
  }

  const { data: requests, error: requestsError } = await requestsQuery;
  if (requestsError) throw requestsError;

  const totalRequests = requests?.length || 0;
  const clickedRequests = requests?.filter(r => r.clicked_at).length || 0;
  const completedRequests = requests?.filter(r => r.completed_at).length || 0;
  const conversionRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;

  const { data: recentReviews, error: recentError } = await supabase
    .from('reviews')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone)
    `)
    .eq('organization_id', orgId)
    .order('received_at', { ascending: false })
    .limit(10);

  if (recentError) throw recentError;

  return {
    avgRating: Math.round(avgRating * 10) / 10,
    totalReviews,
    reviewsByProvider,
    ratingBreakdown,
    recentReviews: recentReviews as Review[],
    conversionRate: Math.round(conversionRate * 10) / 10,
    totalRequests,
    clickedRequests,
    completedRequests,
  };
}

export async function getProviderBreakdown(orgId: string): Promise<Record<ReviewProvider, number>> {
  const { data, error } = await supabase
    .from('reviews')
    .select('provider')
    .eq('organization_id', orgId);

  if (error) throw error;

  const breakdown: Record<ReviewProvider, number> = {
    google: 0,
    facebook: 0,
    internal: 0,
  };

  for (const review of data || []) {
    breakdown[review.provider as ReviewProvider]++;
  }

  return breakdown;
}

export async function getRecentReviews(orgId: string, limit = 10): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone)
    `)
    .eq('organization_id', orgId)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Review[];
}
