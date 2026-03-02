import { supabase } from '../lib/supabase';
import { callEdgeFunction, parseEdgeFunctionError } from '../lib/edgeFunction';

export interface ReputationReview {
  id: string;
  org_id: string;
  late_review_id: string;
  platform: 'facebook' | 'googlebusiness';
  account_id: string;
  account_username: string | null;
  reviewer_name: string | null;
  reviewer_profile_image: string | null;
  rating: number;
  review_text: string | null;
  review_created_at: string;
  has_reply: boolean;
  reply_id: string | null;
  reply_text: string | null;
  reply_created_at: string | null;
  review_url: string | null;
  assigned_to_user_id: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requires_approval: boolean;
  sla_breached: boolean;
  escalated: boolean;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface ReputationAIDraft {
  id: string;
  tone_preset: string;
  tone_label: string;
  draft_text: string;
  tokens: number;
}

export interface ReviewFilters {
  platform?: 'facebook' | 'googlebusiness';
  minRating?: number;
  maxRating?: number;
  hasReply?: boolean;
  accountId?: string;
  sortBy?: 'date' | 'rating';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export async function getReviews(
  orgId: string,
  filters: ReviewFilters = {},
  limit = 50,
  offset = 0
): Promise<{ data: ReputationReview[]; count: number }> {
  let query = supabase
    .from('reputation_reviews')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId);

  if (filters.platform) {
    query = query.eq('platform', filters.platform);
  }
  if (filters.minRating) {
    query = query.gte('rating', filters.minRating);
  }
  if (filters.maxRating) {
    query = query.lte('rating', filters.maxRating);
  }
  if (filters.hasReply !== undefined) {
    query = query.eq('has_reply', filters.hasReply);
  }
  if (filters.accountId) {
    query = query.eq('account_id', filters.accountId);
  }
  if (filters.search) {
    query = query.or(
      `reviewer_name.ilike.%${filters.search}%,review_text.ilike.%${filters.search}%`
    );
  }

  const sortCol = filters.sortBy === 'rating' ? 'rating' : 'review_created_at';
  const ascending = filters.sortOrder === 'asc';
  query = query.order(sortCol, { ascending }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data || []) as ReputationReview[], count: count || 0 };
}

export async function getReviewById(
  reviewId: string
): Promise<ReputationReview | null> {
  const { data, error } = await supabase
    .from('reputation_reviews')
    .select('*')
    .eq('id', reviewId)
    .maybeSingle();
  if (error) throw error;
  return data as ReputationReview | null;
}

export async function syncReviews(
  platform?: string
): Promise<{ reviews_fetched: number; reviews_upserted: number; errors: string[] }> {
  const params: Record<string, unknown> = {};
  if (platform) params.platform = platform;

  const response = await callEdgeFunction('reputation-review-sync', params);
  const json = await response.json();
  if (!response.ok) {
    throw new Error(parseEdgeFunctionError(json, 'Sync failed'));
  }
  return json;
}

export async function replyToReview(
  reviewId: string,
  message: string
): Promise<{ success: boolean; reply: { text: string } }> {
  const response = await callEdgeFunction('reputation-review-reply', {
    review_id: reviewId,
    message,
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(parseEdgeFunctionError(json, 'Failed to post reply'));
  }
  return json;
}

export async function deleteReply(
  reviewId: string
): Promise<{ success: boolean }> {
  const response = await callEdgeFunction('reputation-delete-reply', {
    review_id: reviewId,
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(parseEdgeFunctionError(json, 'Failed to delete reply'));
  }
  return json;
}

export async function generateAIDrafts(
  reviewId: string,
  instructions?: string
): Promise<{ drafts: ReputationAIDraft[]; total_tokens: number }> {
  const body: Record<string, unknown> = { review_id: reviewId };
  if (instructions) body.instructions = instructions;

  const response = await callEdgeFunction('reputation-ai-generate', body);
  const json = await response.json();
  if (!response.ok) {
    throw new Error(parseEdgeFunctionError(json, 'Failed to generate AI drafts'));
  }
  return json;
}

export async function applyDraft(draftId: string): Promise<void> {
  const { error } = await supabase
    .from('reputation_ai_drafts')
    .update({ applied: true, applied_at: new Date().toISOString() })
    .eq('id', draftId);
  if (error) throw error;
}

export async function getDraftsForReview(
  reviewId: string
): Promise<Array<{ id: string; draft_text: string; tone_preset: string; applied: boolean; created_at: string }>> {
  const { data, error } = await supabase
    .from('reputation_ai_drafts')
    .select('id, draft_text, tone_preset, applied, created_at')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getReviewStats(orgId: string): Promise<{
  totalReviews: number;
  averageRating: number;
  unrepliedCount: number;
  responseRate: number;
  ratingBreakdown: Record<number, number>;
}> {
  const { data: reviews, error } = await supabase
    .from('reputation_reviews')
    .select('rating, has_reply')
    .eq('org_id', orgId);

  if (error) throw error;
  const all = reviews || [];
  const total = all.length;
  const replied = all.filter((r) => r.has_reply).length;
  const avg = total > 0 ? all.reduce((s, r) => s + r.rating, 0) / total : 0;

  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of all) {
    breakdown[r.rating] = (breakdown[r.rating] || 0) + 1;
  }

  return {
    totalReviews: total,
    averageRating: Math.round(avg * 10) / 10,
    unrepliedCount: total - replied,
    responseRate: total > 0 ? Math.round((replied / total) * 100) : 0,
    ratingBreakdown: breakdown,
  };
}
