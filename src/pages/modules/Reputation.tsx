import { useState, useEffect } from 'react';
import { Star, TrendingUp, Send, MousePointerClick, CheckCircle, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import type { Review, ReviewRequest, ReputationStats, ReviewFilters, ReviewRequestFilters } from '../../types';
import { getDashboardStats } from '../../services/reputationStats';
import { getReviews } from '../../services/reviews';
import { getReviewRequests, resendRequest } from '../../services/reviewRequests';
import { RequestReviewModal } from '../../components/reputation/RequestReviewModal';
import { ReviewDetailModal } from '../../components/reputation/ReviewDetailModal';
import { ReviewsTable } from '../../components/reputation/ReviewsTable';
import { RequestsTable } from '../../components/reputation/RequestsTable';
import { ReviewsFilters } from '../../components/reputation/ReviewsFilters';
import { RequestsFilters } from '../../components/reputation/RequestsFilters';

type TabType = 'dashboard' | 'reviews' | 'requests' | 'settings';

export function Reputation() {
  const { user } = useAuth();
  const canRequest = usePermission('reputation.request');
  const canManage = usePermission('reputation.manage');
  const canManageProviders = usePermission('reputation.providers.manage');

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stats, setStats] = useState<ReputationStats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [requestsCount, setRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [reviewFilters, setReviewFilters] = useState<ReviewFilters>({});
  const [requestFilters, setRequestFilters] = useState<ReviewRequestFilters>({});

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardStats();
    } else if (activeTab === 'reviews') {
      loadReviews();
    } else if (activeTab === 'requests') {
      loadRequests();
    }
  }, [activeTab, reviewFilters, requestFilters]);

  async function loadDashboardStats() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const data = await getDashboardStats(user.organization_id, 'all_time');
      setStats(data);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadReviews() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const { data, count } = await getReviews(user.organization_id, reviewFilters, 1, 50);
      setReviews(data);
      setReviewsCount(count);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadRequests() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const { data, count } = await getReviewRequests(
        user.organization_id,
        requestFilters,
        1,
        50
      );
      setRequests(data);
      setRequestsCount(count);
    } catch (error) {
      console.error('Failed to load review requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendRequest(requestId: string) {
    if (!user?.id) return;
    try {
      await resendRequest(requestId, user.id);
      loadRequests();
      alert('Review request resent successfully');
    } catch (error) {
      console.error('Failed to resend request:', error);
      alert('Failed to resend request. Please try again.');
    }
  }

  function renderDashboard() {
    if (loading || !stats) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Star className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Rating</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgRating}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-amber-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className="w-4 h-4"
                  fill={star <= Math.round(stats.avgRating) ? 'currentColor' : 'none'}
                />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Reviews</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalReviews}</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              All-time reviews
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.conversionRate}%</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {stats.completedRequests} of {stats.totalRequests} requests
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MousePointerClick className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Click Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalRequests > 0
                    ? Math.round((stats.clickedRequests / stats.totalRequests) * 100)
                    : 0}
                  %
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {stats.clickedRequests} of {stats.totalRequests} clicked
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rating Breakdown</h3>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = stats.ratingBreakdown[rating] || 0;
                const percentage = stats.totalReviews > 0
                  ? (count / stats.totalReviews) * 100
                  : 0;

                return (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-16">
                      <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                      <span className="text-sm font-medium text-gray-700">{rating}</span>
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reviews by Provider</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Google</span>
                <span className="text-lg font-bold text-gray-900">
                  {stats.reviewsByProvider.google}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Facebook</span>
                <span className="text-lg font-bold text-gray-900">
                  {stats.reviewsByProvider.facebook}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Internal</span>
                <span className="text-lg font-bold text-gray-900">
                  {stats.reviewsByProvider.internal}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reviews</h3>
          {stats.recentReviews.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No reviews yet</p>
          ) : (
            <div className="space-y-3">
              {stats.recentReviews.map((review) => (
                <div
                  key={review.id}
                  onClick={() => setSelectedReview(review)}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-gray-900">{review.reviewer_name}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(review.received_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className="w-4 h-4"
                          fill={star <= review.rating ? '#FFA500' : 'none'}
                          stroke={star <= review.rating ? '#FFA500' : '#D1D5DB'}
                          strokeWidth={2}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-600 line-clamp-2">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderReviews() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <ReviewsFilters filters={reviewFilters} onChange={setReviewFilters} />
        </div>
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Reviews</h3>
                <p className="text-sm text-gray-500 mt-1">{reviewsCount} total reviews</p>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <ReviewsTable reviews={reviews} onReviewClick={setSelectedReview} />
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderRequests() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <RequestsFilters filters={requestFilters} onChange={setRequestFilters} />
        </div>
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Review Requests</h3>
                <p className="text-sm text-gray-500 mt-1">{requestsCount} total requests</p>
              </div>
              {canRequest && (
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Request Review
                </button>
              )}
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <RequestsTable
                requests={requests}
                onResend={canRequest ? handleResendRequest : undefined}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Settings</h3>
        <p className="text-gray-500">
          Settings configuration coming soon. Configure review providers, smart threshold, and branding options.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reputation Management</h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage online reviews and customer feedback
          </p>
        </div>
        {canRequest && activeTab !== 'requests' && (
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Send className="w-4 h-4" />
            Request Review
          </button>
        )}
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'reviews'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Reviews
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'requests'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Requests
          </button>
          {canManageProviders && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Settings
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'reviews' && renderReviews()}
      {activeTab === 'requests' && renderRequests()}
      {activeTab === 'settings' && renderSettings()}

      {showRequestModal && (
        <RequestReviewModal
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => {
            setShowRequestModal(false);
            if (activeTab === 'requests') {
              loadRequests();
            }
          }}
        />
      )}

      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
        />
      )}
    </div>
  );
}
