import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';

export interface PostMetrics {
  id: string;
  post_id: string;
  organization_id: string;
  platform: string;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  video_views: number | null;
  engagement_score: number | null;
  fetched_at: string;
}

export interface PostWithMetrics {
  id: string;
  body: string;
  status: string;
  late_status: string | null;
  posted_at: string | null;
  published_at: string | null;
  metrics: PostMetrics[];
}

export async function getMetricsForOrg(organizationId: string): Promise<PostWithMetrics[]> {
  const { data: posts, error: postsError } = await supabase
    .from('social_posts')
    .select('id, body, status, late_status, posted_at, published_at')
    .eq('organization_id', organizationId)
    .eq('status', 'posted')
    .not('late_post_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(50);

  if (postsError) throw postsError;
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);
  const { data: metricsData, error: metricsError } = await supabase
    .from('social_post_metrics')
    .select('*')
    .in('post_id', postIds)
    .order('fetched_at', { ascending: false });

  if (metricsError) throw metricsError;

  return posts.map((post) => ({
    ...post,
    metrics: (metricsData || []).filter((m) => m.post_id === post.id),
  }));
}

export async function getMetricsForPost(postId: string): Promise<PostMetrics[]> {
  const { data, error } = await supabase
    .from('social_post_metrics')
    .select('*')
    .eq('post_id', postId)
    .order('fetched_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function refreshPostMetrics(postId: string): Promise<PostMetrics | null> {
  const response = await callEdgeFunction('late-metrics', { post_id: postId });
  const json = await response.json();
  if (!response.ok || !json.success) return null;
  return json.metrics || null;
}

export async function refreshAllMetrics(): Promise<{ synced: number }> {
  const response = await callEdgeFunction('late-metrics', { bulk: true });
  const json = await response.json();
  return { synced: json.synced || 0 };
}

export function aggregateMetrics(metrics: PostMetrics[]): {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  engagementRate: number;
} {
  const totals = metrics.reduce(
    (acc, m) => ({
      impressions: acc.impressions + (m.impressions ?? 0),
      reach: acc.reach + (m.reach ?? 0),
      likes: acc.likes + (m.likes ?? 0),
      comments: acc.comments + (m.comments ?? 0),
      shares: acc.shares + (m.shares ?? 0),
      saves: acc.saves + (m.saves ?? 0),
      clicks: acc.clicks + (m.clicks ?? 0),
    }),
    { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 }
  );

  const engagements = totals.likes + totals.comments + totals.shares + totals.saves + totals.clicks;
  const engagementRate = totals.impressions > 0 ? (engagements / totals.impressions) * 100 : 0;

  return { ...totals, engagementRate };
}
