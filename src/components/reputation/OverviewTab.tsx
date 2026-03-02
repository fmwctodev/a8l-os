import { useState, useEffect } from 'react';
import {
  Star,
  TrendingUp,
  TrendingDown,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ChevronDown,
  Mail,
  Phone,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { Review, ReviewRequest, ReputationSettings } from '../../types';
import { getDashboardStats } from '../../services/reputationStats';
import { getReviewRequests } from '../../services/reviewRequests';
import { getReviews, getSentimentStats } from '../../services/reviews';
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
  const [stats, setStats] = useState({
    avgRating: 0,
    totalReviews: 0,
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
    reviewsByProvider: { google: 0, facebook: 0, internal: 0 } as Record<string, number>,
    invitesSent: 0,
    reviewsReceived: 0,
    previousReviewsReceived: 0,
    positive: 0,
    negative: 0,
  });
  const [recentRequests, setRecentRequests] = useState<ReviewRequest[]>([]);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [settings, setSettings] = useState<ReputationSettings | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.organization_id, timePeriod]);

  async function loadData() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const periodMap: Record<TimePeriod, 'last_30_days' | 'last_90_days' | 'all_time'> = {
        'last_30_days': 'last_30_days',
        'last_3_months': 'last_90_days',
        'last_6_months': 'last_90_days',
        'last_year': 'all_time',
        'all_time': 'all_time',
      };

      const [dashboardStats, requestsData, reviewsData, sentimentData, settingsData] = await Promise.all([
        getDashboardStats(user.organization_id, periodMap[timePeriod]),
        getReviewRequests(user.organization_id, {}, 1, 5),
        getReviews(user.organization_id, {}, 1, 5),
        getSentimentStats(user.organization_id),
        getSettings(user.organization_id),
      ]);

      setStats({
        avgRating: dashboardStats.avgRating,
        totalReviews: dashboardStats.totalReviews,
        ratingBreakdown: dashboardStats.ratingBreakdown,
        reviewsByProvider: dashboardStats.reviewsByProvider,
        invitesSent: dashboardStats.totalRequests,
        reviewsReceived: dashboardStats.totalReviews,
        previousReviewsReceived: 0,
        positive: sentimentData.positive,
        negative: sentimentData.negative,
      });
      setRecentRequests(requestsData.data);
      setRecentReviews(reviewsData.data);
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to load overview data:', error);
      setStats({
        avgRating: 0,
        totalReviews: 0,
        ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        reviewsByProvider: { google: 0, facebook: 0, internal: 0 },
        invitesSent: 0,
        reviewsReceived: 0,
        previousReviewsReceived: 0,
        positive: 0,
        negative: 0,
      });
    } finally {
      setLoading(false);
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
    const received = stats?.reviewsReceived || 0;
    return Math.min((received / goal) * 100, 100);
  }

  function formatPercentageChange(current: number, previous: number): string {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? '+' : ''}${Math.round(change)}%`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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

      {settings?.google_review_url && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">i</span>
            Your review link is set to Google Business Profile. You can view or change it anytime in Settings
          </div>
          <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
            Review Links <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {subTab === 'my_stats' && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex gap-8">
              <div className="flex-1">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">AI Recap</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Get AI summaries of customer reviews from your chosen Review Pages and time frames!
                    </p>
                    <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-2 inline-flex items-center gap-1">
                      Check out Reviews AI <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="flex-1 border-l border-gray-200 pl-8">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium">AI Summary</span>
                </div>
                <p className="text-sm text-gray-600">
                  {stats.totalReviews > 0
                    ? `Based on ${stats.totalReviews} reviews, customers praise your service quality and responsiveness.`
                    : 'No reviews yet to analyze. Send review requests to start collecting feedback.'}
                </p>
                {stats.totalReviews > 0 && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                    <div className="flex -space-x-1">
                      <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">G</div>
                      <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">f</div>
                    </div>
                    From {stats.totalReviews} Reviews
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-600 mb-4">Invites Goal</h4>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="#E5E7EB"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="#3B82F6"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${getReviewGoalProgress() * 2.26} 226`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-gray-900">{stats.invitesSent}</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">out of {settings?.review_goal || 20}</div>
                  <div className="text-sm font-medium text-green-600 mt-1">
                    +{Math.round(getReviewGoalProgress())}%
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-600 mb-4">Reviews Received</h4>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-gray-900">{stats.reviewsReceived}</div>
                <div className="flex-1">
                  <div className="h-12 flex items-end gap-0.5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="flex-1 bg-blue-100 rounded-t"
                        style={{ height: `${Math.random() * 100}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-sm text-red-500 mt-2 flex items-center gap-1">
                <TrendingDown className="w-4 h-4" />
                {formatPercentageChange(stats.reviewsReceived, stats.previousReviewsReceived)} vs Previous Period
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-600 mb-4">Sentiment</h4>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <ThumbsUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.positive}</div>
                    <div className="text-xs text-gray-500">+0%</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <ThumbsDown className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.negative}</div>
                    <div className="text-xs text-gray-500">+0%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-600 mb-4">Average Rating</h4>
              <div className="flex items-start gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Star className="w-8 h-8 fill-amber-400 text-amber-400" />
                    <span className="text-4xl font-bold text-gray-900">{stats.avgRating}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">+{stats.avgRating}</div>
                </div>
                <div className="flex-1 space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = stats.ratingBreakdown[rating] || 0;
                    const percentage = stats.totalReviews > 0
                      ? Math.round((count / stats.totalReviews) * 100)
                      : 0;
                    return (
                      <div key={rating} className="flex items-center gap-2">
                        <div className="flex items-center gap-1 w-12 text-sm text-gray-600">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {rating}
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-500 w-12 text-right">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-600 mb-4">Listings</h4>
              <div className="flex items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg className="w-40 h-40" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="60" stroke="#E5E7EB" strokeWidth="20" fill="none" />
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      stroke="#22C55E"
                      strokeWidth="20"
                      fill="none"
                      strokeDasharray="188 377"
                      strokeLinecap="round"
                      transform="rotate(-90 80 80)"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      stroke="#FCD34D"
                      strokeWidth="20"
                      fill="none"
                      strokeDasharray="94 377"
                      strokeDashoffset="-188"
                      strokeLinecap="round"
                      transform="rotate(-90 80 80)"
                    />
                  </svg>
                </div>
                <div className="ml-6 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-gray-600">Live</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <span className="text-gray-600">Processing</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-gray-300" />
                    <span className="text-gray-600">Opted Out</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-gray-200" />
                    <span className="text-gray-600">Unavailable</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-600 mb-4">Latest Review Requests</h4>
              {recentRequests.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No review requests yet</p>
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
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{request.contact?.email || request.contact?.phone}</span>
                        <span className="text-blue-600 font-medium capitalize">{request.sent_by_source || 'Manual'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-600 mb-4">Latest Reviews</h4>
              {recentReviews.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No reviews yet</p>
              ) : (
                <div className="space-y-4">
                  {recentReviews.slice(0, 3).map((review) => (
                    <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                            {review.reviewer_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{review.reviewer_name}</div>
                            <div className="text-xs text-gray-500 capitalize">{review.provider}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-gray-600 line-clamp-2">{review.comment}</p>
                      )}
                      <div className="text-xs text-gray-400 mt-2">
                        {new Date(review.received_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
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
              <button className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
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
                <div className="font-medium text-gray-900">0%</div>
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

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Competitive Landscape Grid</h4>
            <p className="text-sm text-gray-500 mb-6">Discover what keywords reveal about you and your competitors.</p>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                  4L
                </div>
                <span className="text-sm font-medium text-gray-900">Your Business</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Your Business</span>
              </div>
              <div className="text-sm text-amber-600">
                Reviews not retrieved. The system will try again in next sync.
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Compare with a Competitor</p>
                <p className="text-xs text-gray-400 mb-4">You can compare up to 3 competitors.</p>
                <button className="inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Competitor
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Sentiment HeatMap</h4>
              <p className="text-sm text-gray-500 mb-6">Visualize the emotional landscape with our sentiment heatmap.</p>

              <div className="grid grid-cols-4 gap-4">
                <div className="text-sm font-medium text-blue-600">Your Business</div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-2">Positive Reviews</div>
                  <div className="h-16 bg-green-50 rounded flex items-center justify-center text-gray-400">--</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-2">Neutral Reviews</div>
                  <div className="h-16 bg-gray-50 rounded flex items-center justify-center text-gray-400">--</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-2">Negative Reviews</div>
                  <div className="h-16 bg-red-50 rounded flex items-center justify-center text-gray-400">--</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Rating by Source</h4>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-sm font-medium text-gray-500 pb-3">Source</th>
                    <th className="text-left text-sm font-medium text-gray-500 pb-3">
                      <span className="text-blue-600">Your Business</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-red-500 flex items-center justify-center text-white text-xs">G</div>
                        <span className="text-sm text-gray-700">Google</span>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-gray-500">--</td>
                  </tr>
                  <tr>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-xs">f</div>
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
