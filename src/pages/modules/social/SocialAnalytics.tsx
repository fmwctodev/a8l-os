import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Eye,
  MousePointerClick,
  Heart,
  Loader2,
  Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { useAuth } from '../../../contexts/AuthContext';
import { getPerformanceInsights } from '../../../services/socialContentPatterns';

const TIME_RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SocialAnalytics() {
  const { user } = useAuth();
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<{
    avgEngagement: number;
    topHookTypes: Array<{ hook_type: string; avg_engagement: number; count: number }>;
    bestPostingHours: Array<{ hour: number; avg_engagement: number }>;
    bestPostingDays: Array<{ day: number; avg_engagement: number }>;
    platformBreakdown: Array<{ platform: string; avg_engagement: number; count: number }>;
  } | null>(null);

  useEffect(() => {
    loadInsights();
  }, [user?.organization_id, range]);

  async function loadInsights() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const data = await getPerformanceInsights(
        user.organization_id,
        startDate.toISOString()
      );
      setInsights(data);
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const hasData = insights && (
    insights.topHookTypes.length > 0 ||
    insights.bestPostingHours.length > 0 ||
    insights.platformBreakdown.length > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Content Performance</h2>
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

      {!hasData ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No analytics data yet</h3>
          <p className="text-slate-400 max-w-sm mx-auto">
            Analytics will appear here once your posts start getting engagement. Create and publish content to start tracking performance.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={TrendingUp}
              label="Avg Engagement"
              value={`${(insights!.avgEngagement * 100).toFixed(1)}%`}
              color="text-cyan-400"
            />
            <StatCard
              icon={Eye}
              label="Top Platform"
              value={insights!.platformBreakdown[0]?.platform || 'N/A'}
              color="text-emerald-400"
            />
            <StatCard
              icon={Heart}
              label="Best Hook"
              value={insights!.topHookTypes[0]?.hook_type || 'N/A'}
              color="text-rose-400"
            />
            <StatCard
              icon={Calendar}
              label="Best Day"
              value={insights!.bestPostingDays[0] ? DAY_LABELS[insights!.bestPostingDays[0].day] : 'N/A'}
              color="text-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {insights!.topHookTypes.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Hook Performance</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={insights!.topHookTypes.slice(0, 8)} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="hook_type"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      width={100}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }}
                      formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Engagement']}
                    />
                    <Bar dataKey="avg_engagement" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {insights!.platformBreakdown.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Platform Breakdown</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={insights!.platformBreakdown}>
                    <XAxis dataKey="platform" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }}
                      formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Engagement']}
                    />
                    <Bar dataKey="avg_engagement" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {insights!.bestPostingHours.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 lg:col-span-2">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Best Posting Hours</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={insights!.bestPostingHours
                      .sort((a, b) => a.hour - b.hour)
                      .map(h => ({ ...h, label: `${h.hour}:00` }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }}
                      formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Engagement']}
                    />
                    <Line type="monotone" dataKey="avg_engagement" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
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
