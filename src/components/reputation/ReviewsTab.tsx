import { useState, useEffect } from 'react';
import {
  Star,
  Sparkles,
  Search,
  ChevronDown,
  Send,
  Wand2,
  MoreVertical,
  Plus,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { Review, ReviewFilters, ReviewProvider } from '../../types';
import { getReviews, respondToReview, getSentimentStats, generateAIReply } from '../../services/reviews';

interface ReviewsTabProps {
  onRequestReview: () => void;
  onAddReview: () => void;
}

type RatingRange = 'all' | '4-5' | '3-4' | '2-3' | '1-2';

export function ReviewsTab({ onRequestReview, onAddReview }: ReviewsTabProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(true);
  const [filters, setFilters] = useState<ReviewFilters>({});
  const [ratingRange, setRatingRange] = useState<RatingRange>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [spamFilter, setSpamFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [stats, setStats] = useState({ positive: 0, neutral: 0, negative: 0, avgRating: 0, totalReviews: 0, ratingBreakdown: {} as Record<number, number> });

  useEffect(() => {
    loadReviews();
    loadStats();
  }, [user?.organization_id, filters]);

  async function loadReviews() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const { data, count } = await getReviews(user.organization_id, filters, 1, 50);
      setReviews(data);
      setTotalCount(count);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    if (!user?.organization_id) return;
    try {
      const [sentimentData, reviewsData] = await Promise.all([
        getSentimentStats(user.organization_id),
        getReviews(user.organization_id, {}, 1, 1000),
      ]);

      const allReviews = reviewsData.data;
      const avgRating = allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;

      const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      allReviews.forEach(r => {
        ratingBreakdown[r.rating] = (ratingBreakdown[r.rating] || 0) + 1;
      });

      setStats({
        ...sentimentData,
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: allReviews.length,
        ratingBreakdown,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  function applyFilters() {
    const newFilters: ReviewFilters = { ...filters };

    if (ratingRange !== 'all') {
      const ranges: Record<RatingRange, number[]> = {
        'all': [1, 2, 3, 4, 5],
        '4-5': [4, 5],
        '3-4': [3, 4],
        '2-3': [2, 3],
        '1-2': [1, 2],
      };
      newFilters.rating = ranges[ratingRange];
    } else {
      delete newFilters.rating;
    }

    if (sourceFilter !== 'all') {
      newFilters.provider = [sourceFilter as ReviewProvider];
    } else {
      delete newFilters.provider;
    }

    if (searchQuery) {
      newFilters.search = searchQuery;
    } else {
      delete newFilters.search;
    }

    setFilters(newFilters);
  }

  useEffect(() => {
    const timer = setTimeout(() => applyFilters(), 300);
    return () => clearTimeout(timer);
  }, [ratingRange, sourceFilter, searchQuery]);

  async function handleReply(reviewId: string, isAi: boolean = false) {
    if (!user?.id || !replyText.trim()) return;
    try {
      setSubmittingReply(true);
      await respondToReview(reviewId, replyText, user.id, isAi ? 'ai' : 'manual');
      setReplyingTo(null);
      setReplyText('');
      loadReviews();
    } catch (error) {
      console.error('Failed to submit reply:', error);
    } finally {
      setSubmittingReply(false);
    }
  }

  async function generateAiReply(review: Review) {
    setReplyingTo(review.id);
    setReplyText('Generating AI reply...');
    try {
      const { reply } = await generateAIReply(review.id);
      setReplyText(reply);
    } catch (err) {
      console.error('AI reply generation failed:', err);
      setReplyText('');
      setReplyingTo(null);
    }
  }

  function getProviderIcon(provider: ReviewProvider) {
    switch (provider) {
      case 'google':
        return (
          <div className="w-5 h-5 rounded bg-white border border-gray-200 flex items-center justify-center">
            <span className="text-xs font-bold text-red-500">G</span>
          </div>
        );
      case 'facebook':
        return (
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-xs font-bold text-white">f</span>
          </div>
        );
      default:
        return (
          <div className="w-5 h-5 rounded bg-gray-500 flex items-center justify-center">
            <span className="text-xs font-bold text-white">I</span>
          </div>
        );
    }
  }

  function getAvatarColor(name: string): string {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-amber-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-cyan-500',
      'bg-emerald-500',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  }

  const aiKeywords = ['service quality', 'responsiveness', 'professional', 'helpful', 'expertise'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Reviews</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">AI Summary</span>
            <button
              onClick={() => setAiSummaryEnabled(!aiSummaryEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                aiSummaryEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  aiSummaryEnabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </label>
          <button
            onClick={onAddReview}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Reviews
          </button>
          <button
            onClick={onRequestReview}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Send Review Request
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <select
            value={ratingRange}
            onChange={(e) => setRatingRange(e.target.value as RatingRange)}
            className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Ratings</option>
            <option value="4-5">Between 4 and 5</option>
            <option value="3-4">Between 3 and 4</option>
            <option value="2-3">Between 2 and 3</option>
            <option value="1-2">Between 1 and 2</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Sources</option>
            <option value="google">All Google pages</option>
            <option value="facebook">All Facebook pages</option>
            <option value="internal">All manual pages</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        <input
          type="date"
          value={filters.startDate || ''}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
          className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Start Date"
        />

        <input
          type="date"
          value={filters.endDate || ''}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
          className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="End Date"
        />

        <div className="relative">
          <select
            value={spamFilter}
            onChange={(e) => setSpamFilter(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Spam</option>
            <option value="not_spam">Not Spam</option>
            <option value="spam">Spam Only</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {aiSummaryEnabled && (
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-3">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">AI Summary</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {stats.totalReviews > 0
                  ? `Customers consistently praise your service for strong expertise, responsiveness, and hands-on execution that drives measurable results.`
                  : 'No reviews to analyze yet.'}
              </p>
              {stats.totalReviews > 0 && (
                <a href="#" className="text-sm text-blue-600 hover:text-blue-700">See More</a>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {aiKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                >
                  {keyword}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="flex -space-x-1">
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">G</div>
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">f</div>
              </div>
              From {stats.totalReviews} Reviews
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Average Reviews</h4>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900">{stats.avgRating}/5</span>
              </div>
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${star <= Math.round(stats.avgRating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                  />
                ))}
                <span className="text-sm text-gray-500 ml-2">({stats.totalReviews} Reviews)</span>
              </div>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = stats.ratingBreakdown[rating] || 0;
                  const percentage = stats.totalReviews > 0 ? Math.round((count / stats.totalReviews) * 100) : 0;
                  return (
                    <div key={rating} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-3">{rating}</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className={aiSummaryEnabled ? 'lg:col-span-3' : 'lg:col-span-4'}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500 mb-4">No reviews found</p>
              <button
                onClick={onRequestReview}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Request Your First Review
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full ${getAvatarColor(review.reviewer_name)} flex items-center justify-center text-white font-medium`}>
                        {review.reviewer_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{review.reviewer_name}</span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-500">{review.rating}</span>
                          {review.rating >= 4 && (
                            <span className="text-lg">😊</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {getProviderIcon(review.provider)}
                          <span className="capitalize">{review.provider}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {new Date(review.received_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {review.comment && (
                    <p className="text-gray-700 mb-4">{review.comment}</p>
                  )}

                  {!review.response && replyingTo !== review.id && (
                    <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => generateAiReply(review)}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <Wand2 className="w-4 h-4" />
                        AI Reply
                      </button>
                      <button
                        onClick={() => setReplyingTo(review.id)}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700"
                      >
                        <Send className="w-4 h-4" />
                        Reply
                      </button>
                    </div>
                  )}

                  {replyingTo === review.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your reply..."
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                      <div className="flex items-center justify-end gap-2 mt-3">
                        <button
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleReply(review.id, replyText.includes('Thank you for your fantastic'))}
                          disabled={!replyText.trim() || submittingReply}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingReply ? 'Posting...' : 'Post Reply'}
                        </button>
                      </div>
                    </div>
                  )}

                  {review.response && (
                    <div className="mt-4 ml-12 bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center">
                          <span className="text-xs text-white font-bold">A</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">Your Business</span>
                        <span className="text-sm text-gray-500">
                          {review.responded_at && new Date(review.responded_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{review.response}</p>
                      {review.response_source === 'ai' && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Wand2 className="w-3 h-3" />
                          Replied By Reviews AI
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
