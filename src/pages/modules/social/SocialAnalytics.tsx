import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Eye,
  MousePointerClick,
  Heart,
  Loader2,
  Calendar,
  RefreshCw,
  Share2,
  MessageCircle,
  Bookmark,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { getPerformanceInsights } from '../../../services/socialContentPatterns';
import {
  getMetricsForOrg,
  refreshAllMetrics,
  aggregateMetrics,
  type PostWithMetrics,
} from '../../../services/socialMetrics';

const TIME_RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SocialAnalytics() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postsWithMetrics, setPostsWithMetrics] = useState<PostWithMetrics[]>([]);
  const [insights, setInsights] = useState<{
    avgEngagement: number;
    topHookTypes: Array<{ hook_type: string; avg_engagement: number; count: number }>;
    bestPostingHours: Array<{ hour: number; avg_engagement: number }>;
    bestPostingDays: Array<{ day: number; avg_engagement: number }>;
    platformBreakdown: Array<{ platform: string; avg_engagement: number; count: number }>;
  } | null>(null);

  useEffect(() => {
    loadAll();
  }, [user?.organization_id, range]);

  async function loadAll() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const [insightsData, metricsData] = await Promise.all([
        getPerformanceInsights(user.organization_id, startDate.toISOString()),
        getMetricsForOrg(user.organization_id),
      ]);
      setInsights(insightsData);
      setPostsWithMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshMetrics() {
    try {
      setRefreshing(true);
      const { synced } = await refreshAllMetrics();
      addToast(`Synced metrics for ${synced} post${synced !== 1 ? 's' : ''}`, 'success');
      await loadAll();
    } catch {
      addToast('Failed to refresh metrics', 'error');
    } finally {
      setRefreshing(false);
    }
  }

  const allMetrics = postsWithMetrics.flatMap((p) => p.metrics);
  const aggregated = aggregateMetrics(allMetrics);
  const hasLateMetrics = allMetrics.length > 0;

  const hasInsightData = insights && (
    insights.topHookTypes.length > 0 ||
    insights.bestPostingHours.length > 0 ||
    insights.platformBreakdown.length > 0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Content Performance</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshMetrics}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Sync Metrics
          </button>
          <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
            {TIME_RANGES.map(t => (
              <button
                key={t.value}
                onClick={() => setRange(t.value)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  range === t.value ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasLateMetrics && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Publishing Metrics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <MetricCard icon={Eye} label="Impressions" value={fmt(aggregated.impressions)} color="text-cyan-400" />
            <MetricCard icon={TrendingUp} label="Reach" value={fmt(aggregated.reach)} color="text-emerald-400" />
            <MetricCard icon={Heart} label="Likes" value={fmt(aggregated.likes)} color="text-rose-400" />
            <MetricCard icon={MessageCircle} label="Comments" value={fmt(aggregated.comments)} color="text-amber-400" />
            <MetricCard icon={Share2} label="Shares" value={fmt(aggregated.shares)} color="text-blue-400" />
            <MetricCard icon={Bookmark} label="Saves" value={fmt(aggregated.saves)} color="text-violet-400" />
            <MetricCard icon={MousePointerClick} label="Clicks" value={fmt(aggregated.clicks)} color="text-orange-400" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="text-sm text-slate-400">Engagement Rate:</div>
            <div className={`text-sm font-semibold ${
              aggregated.engagementRate >= 3 ? 'text-emerald-400' :
              aggregated.engagementRate >= 1 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {aggregated.engagementRate.toFixed(2)}%
            </div>
            <div className="text-xs text-slate-500">across {allMetrics.length} published post{allMetrics.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      )}

      {!hasLateMetrics && !hasInsightData && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No analytics data yet</h3>
          <p className="text-slate-400 max-w-sm mx-auto mb-6">
            Publish posts and click "Sync Metrics" to pull live data from your social platforms.
          </p>
          <button
            onClick={handleRefreshMetrics}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sync Metrics Now
          </button>
        </div>
      )}

      {hasLateMetrics && postsWithMetrics.filter(p => p.metrics.length > 0).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Per-Post Breakdown
          </h3>
          <div className="space-y-3">
            {postsWithMetrics.filter(p => p.metrics.length > 0).slice(0, 10).map((post) => {
              const agg = aggregateMetrics(post.metrics);
              return (
                <div key={post.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <p className="text-sm text-white line-clamp-1 mb-3">{post.body}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                    <span><span className="text-white font-medium">{fmt(agg.impressions)}</span> impressions</span>
                    <span><span className="text-white font-medium">{fmt(agg.likes)}</span> likes</span>
                    <span><span className="text-white font-medium">{fmt(agg.comments)}</span> comments</span>
                    <span><span className="text-white font-medium">{fmt(agg.shares)}</span> shares</span>
                    <span><span className="text-white font-medium">{fmt(agg.clicks)}</span> clicks</span>
                    <span className={`font-medium ${agg.engagementRate >= 3 ? 'text-emerald-400' : agg.engagementRate >= 1 ? 'text-amber-400' : 'text-red-400'}`}>
                      {agg.engagementRate.toFixed(2)}% eng.
                    </span>
                    {post.published_at && (
                      <span className="ml-auto text-slate-500">
                        {new Date(post.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasInsightData && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            AI Content Insights
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard icon={TrendingUp} label="Avg Engagement" value={`${(insights!.avgEngagement * 100).toFixed(1)}%`} color="text-cyan-400" />
            <StatCard icon={Eye} label="Top Platform" value={insights!.platformBreakdown[0]?.platform || 'N/A'} color="text-emerald-400" />
            <StatCard icon={Heart} label="Best Hook" value={insights!.topHookTypes[0]?.hook_type || 'N/A'} color="text-rose-400" />
            <StatCard icon={Calendar} label="Best Day" value={insights!.bestPostingDays[0] ? DAY_LABELS[insights!.bestPostingDays[0].day] : 'N/A'} color="text-amber-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {insights!.topHookTypes.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Hook Performance</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={insights!.topHookTypes.slice(0, 8)} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="hook_type" tick={{ fill: '#94a3b8', fontSize: 12 }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Engagement']} />
                    <Bar dataKey="avg_engagement" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {insights!.platformBreakdown.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Platform Breakdown</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={insights!.platformBreakdown}>
                    <XAxis dataKey="platform" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Engagement']} />
                    <Bar dataKey="avg_engagement" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {insights!.bestPostingHours.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 lg:col-span-2">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Best Posting Hours</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={insights!.bestPostingHours.sort((a, b) => a.hour - b.hour).map(h => ({ ...h, label: `${h.hour}:00` }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Engagement']} />
                    <Line type="monotone" dataKey="avg_engagement" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function MetricCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="text-lg font-bold text-white truncate capitalize">{value}</div>
    </div>
  );
}
