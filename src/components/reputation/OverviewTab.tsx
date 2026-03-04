import { useState, useEffect } from 'react';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Loader2,
  Plug,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ReviewRequest, ReputationSettings } from '../../types';
import { getReviewStats, getReviews, syncReviews, type ReputationReview } from '../../services/reputationReviews';
import { getIntegrationStatus, type IntegrationStatus } from '../../services/reputationIntegration';
import { getReviewRequests } from '../../services/reviewRequests';
import { getSettings } from '../../services/reputationSettings';

type SubTab = 'my_stats' | 'competitor_analysis';
type TimePeriod = 'last_30_days' | 'last_3_months' | 'last_6_months' | 'last_year' | 'all_time';

interface OverviewTabProps {
  onRequestReview: () => void;
}

export function OverviewTab({ onRequestReview }: OverviewTabProps) {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('my_stats');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('last_6_months');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({
    avgRating: 0,
    totalReviews: 0,
    unrepliedCount: 0,
    responseRate: 0,
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
    invitesSent: 0,
    positive: 0,
    negative: 0,
    neutral: 0,
  });
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
  const [recentRequests, setRecentRequests] = useState<ReviewRequest[]>([]);
  const [recentReviews, setRecentReviews] = useState<ReputationReview[]>([]);
  const [settings, setSettings] = useState<ReputationSettings | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.organization_id, timePeriod]);

  async function loadData() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const [reviewStats, requestsData, reviewsData, settingsData, integrationData] = await Promise.all([
        getReviewStats(user.organization_id),
        getReviewRequests(user.organization_id, {}, 1, 5),
        getReviews(user.organization_id, { sortBy: 'date', sortOrder: 'desc' }, 5, 0),
        getSettings(user.organization_id),
        getIntegrationStatus(user.organization_id),
      ]);

      const positive = Object.entries(reviewStats.ratingBreakdown)
        .filter(([k]) => Number(k) >= 4)
        .reduce((sum, [, v]) => sum + v, 0);
      const negative = Object.entries(reviewStats.ratingBreakdown)
        .filter(([k]) => Number(k) <= 2)
        .reduce((sum, [, v]) => sum + v, 0);
      const neutral = reviewStats.ratingBreakdown[3] || 0;

      setStats({
        avgRating: reviewStats.averageRating,
        totalReviews: reviewStats.totalReviews,
        unrepliedCount: reviewStats.unrepliedCount,
        responseRate: reviewStats.responseRate,
        ratingBreakdown: reviewStats.ratingBreakdown,
        invitesSent: requestsData.count,
        positive,
        negative,
        neutral,
      });
      setRecentRequests(requestsData.data);
      setRecentReviews(reviewsData.data);
      setSettings(settingsData);
      setIntegration(integrationData);
    } catch (error) {
      console.error('Failed to load overview data:', error);
    } finally {
      setLoading(false);
    }
  }

  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await syncReviews();
      if (!result.success && result.error) {
        setSyncError(result.error);
      } else if (result.errors && result.errors.length > 0) {
        setSyncError(result.errors.join('; '));
      }
      await loadData();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const timePeriodLabels: Record<TimePeriod, string> = {
    'last_30_days': 'Last 30 Days',
    'last_3_months': 'Last 3 Months',
    'last_6_months': 'Last 6 Months',
    'last_year': 'Last Year',
    'all_time': 'All Time',
  };

  function getReviewGoalProgress() {
    const goal = settings?.review_goal || 20;
    const received = stats?.totalReviews || 0;
    return Math.min((received / goal) * 100, 100);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('my_stats')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              subTab === 'my_stats'
                ? 'bg-slate-800 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            My Stats
          </button>
          <button
            onClick={() => setSubTab('competitor_analysis')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              subTab === 'competitor_analysis'
                ? 'bg-slate-800 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Competitor Analysis
          </button>
        </div>
        <div className="flex items-center gap-3">
          {integration?.connected && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Reviews'}
            </button>
          )}
          <div className="relative">
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(timePeriodLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {!integration?.connected && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-amber-700">
            <Plug className="w-5 h-5" />
            Connect your review platforms in Settings to start syncing Google and Facebook reviews.
          </div>
        </div>
      )}

      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">Sync failed</p>
            <p className="text-xs text-red-600 mt-0.5">{syncError}</p>
          </div>
        </div>
      )}

      {!syncError && integration?.last_error && stats.totalReviews === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700">Last sync had an error</p>
            <p className="text-xs text-amber-600 mt-0.5">{integration.last_error}</p>
          </div>
        </div>
      )}

      {subTab === 'my_stats' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-medium text-gray-600">Average Rating</h4>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{stats.avgRating || '--'}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(stats.avgRating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Total Reviews</h4>
              <span className="text-3xl font-bold text-gray-900">{stats.totalReviews}</span>
              <p className="text-xs text-gray-500 mt-1">{stats.unrepliedCount} unreplied</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Response Rate</h4>
              <span className="text-3xl font-bold text-gray-900">{stats.responseRate}%</span>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${stats.responseRate}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Review Goal</h4>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{stats.invitesSent}</span>
                <span className="text-sm text-gray-500">/ {settings?.review_goal || 20}</span>
              </div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${getReviewGoalProgress()}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-600 mb-4">Rating Distribution</h4>
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = stats.ratingBreakdown[rating] || 0;
                  const percentage = stats.totalReviews > 0
                    ? Math.round((count / stats.totalReviews) * 100)
                    : 0;
                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-16 text-sm text-gray-600">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        {rating}
                      </div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            rating >= 4 ? 'bg-green-500' : rating === 3 ? 'bg-amber-400' : 'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 w-16 text-right">{count} ({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-600 mb-4">Sentiment</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <ThumbsUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-700">{stats.positive}</div>
                  <p className="text-xs text-green-600 mt-1">Positive</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="w-6 h-6 mx-auto mb-2 flex items-center justify-center">
                    <span className="text-gray-400 text-lg">~</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-700">{stats.neutral}</div>
                  <p className="text-xs text-gray-500 mt-1">Neutral</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-xl">
                  <ThumbsDown className="w-6 h-6 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-700">{stats.negative}</div>
                  <p className="text-xs text-red-600 mt-1">Negative</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-600 mb-4">Latest Review Requests</h4>
              {recentRequests.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 mb-3">No review requests yet</p>
                  <button
                    onClick={onRequestReview}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Send Your First Request
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentRequests.slice(0, 4).map((request) => (
                    <div key={request.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-medium">
                          {request.contact?.first_name?.[0]}{request.contact?.last_name?.[0]}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {request.contact?.first_name} {request.contact?.last_name}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {request.sent_at
                          ? new Date(request.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-600 mb-4">Latest Reviews</h4>
              {recentReviews.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">No reviews synced yet</p>
                  {integration?.connected && (
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      Sync Now
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {recentReviews.slice(0, 3).map((review) => (
                    <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                            {(review.reviewer_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{review.reviewer_name || 'Anonymous'}</div>
                            <div className="text-xs text-gray-500 capitalize">
                              {review.platform === 'googlebusiness' ? 'Google' : 'Facebook'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.review_text && (
                        <p className="text-sm text-gray-600 line-clamp-2">{review.review_text}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400">
                          {new Date(review.review_created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </span>
                        {review.has_reply && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Replied</span>
                        )}
                        {review.sla_breached && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">SLA</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {subTab === 'competitor_analysis' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-1">Your Business</h4>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Your Business</span>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-gray-500 mb-1">Reputation Score</div>
                <div className="font-medium text-gray-900">--</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Average Rating</div>
                <div className="font-medium text-gray-900">{stats?.avgRating || '--'}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Reviews</div>
                <div className="font-medium text-gray-900">{stats?.totalReviews || 0}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Avg Response Time</div>
                <div className="font-medium text-gray-900">--</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Response Rate</div>
                <div className="font-medium text-gray-900">{stats.responseRate}%</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-4">You Can Add Up to 3 Competitors</p>
              <button className="inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Competitor
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Sentiment HeatMap</h4>
              <p className="text-sm text-gray-500 mb-6">Visualize the emotional landscape with our sentiment heatmap.</p>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-sm font-medium text-blue-600">Your Business</div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-2">Positive</div>
                  <div className="h-16 bg-green-50 rounded flex items-center justify-center font-semibold text-green-700">
                    {stats.positive || '--'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-2">Neutral</div>
                  <div className="h-16 bg-gray-50 rounded flex items-center justify-center font-semibold text-gray-600">
                    {stats.neutral || '--'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-2">Negative</div>
                  <div className="h-16 bg-red-50 rounded flex items-center justify-center font-semibold text-red-700">
                    {stats.negative || '--'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Rating by Source</h4>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-sm font-medium text-gray-500 pb-3">Source</th>
                    <th className="text-left text-sm font-medium text-gray-500 pb-3">Reviews</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-red-500 flex items-center justify-center text-white text-xs font-bold">G</div>
                        <span className="text-sm text-gray-700">Google Business</span>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-gray-500">{stats.totalReviews > 0 ? stats.totalReviews : '--'}</td>
                  </tr>
                  <tr>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">f</div>
                        <span className="text-sm text-gray-700">Facebook</span>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-gray-500">--</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
