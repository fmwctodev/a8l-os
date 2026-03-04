import { useState, useEffect, useCallback } from 'react';
import { Inbox, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ReputationReview } from '../../services/reputationReviews';
import { getReviews, syncReviews } from '../../services/reputationReviews';
import { ReviewInboxFilters, type InboxFilterState } from './ReviewInboxFilters';
import { ReviewListItem } from './ReviewListItem';
import { ReviewDetailPanel } from './ReviewDetailPanel';

const DEFAULT_FILTERS: InboxFilterState = {
  platform: '',
  hasReply: '',
  minRating: 1,
  maxRating: 5,
  sortBy: 'date',
  sortOrder: 'desc',
  search: '',
  slaBreached: '',
  escalated: '',
  priority: '',
};

export function ReviewsInbox() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReputationReview[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState<InboxFilterState>(DEFAULT_FILTERS);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const selectedReview = reviews.find(r => r.id === selectedReviewId) || null;

  const loadReviews = useCallback(async () => {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const filterParams: Record<string, unknown> = {};
      if (filters.platform) filterParams.platform = filters.platform;
      if (filters.hasReply === 'true') filterParams.hasReply = true;
      if (filters.hasReply === 'false') filterParams.hasReply = false;
      if (filters.minRating > 1) filterParams.minRating = filters.minRating;
      if (filters.maxRating < 5) filterParams.maxRating = filters.maxRating;
      if (filters.search) filterParams.search = filters.search;

      const { data, count } = await getReviews(
        user.organization_id,
        {
          platform: filters.platform as 'facebook' | 'googlebusiness' | undefined || undefined,
          hasReply: filters.hasReply === '' ? undefined : filters.hasReply === 'true',
          minRating: filters.minRating > 1 ? filters.minRating : undefined,
          maxRating: filters.maxRating < 5 ? filters.maxRating : undefined,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          search: filters.search || undefined,
        },
        pageSize,
        page * pageSize
      );

      let filtered = data;
      if (filters.slaBreached === 'true') {
        filtered = filtered.filter(r => r.sla_breached);
      }
      if (filters.escalated === 'true') {
        filtered = filtered.filter(r => r.escalated);
      }
      if (filters.priority) {
        filtered = filtered.filter(r => r.priority === filters.priority);
      }

      setReviews(filtered);
      setTotalCount(count);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, filters, page]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    setPage(0);
  }, [filters]);

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
      await loadReviews();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  function handleReviewUpdate() {
    loadReviews();
  }

  return (
    <div className="space-y-3">
      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">Sync failed</p>
            <p className="text-xs text-red-600 mt-0.5">{syncError}</p>
          </div>
        </div>
      )}
    <div className="flex h-[calc(100vh-220px)] bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`flex flex-col border-r border-gray-200 ${selectedReview ? 'w-[380px] hidden lg:flex' : 'flex-1'}`}>
        <div className="px-4 pt-4 pb-2">
          <ReviewInboxFilters
            filters={filters}
            onChange={setFilters}
            onSync={handleSync}
            syncing={syncing}
            totalCount={totalCount}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <Inbox className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">No reviews found</p>
              <p className="text-xs text-gray-500 mb-4">
                Sync your connected accounts to pull in reviews, or adjust your filters.
              </p>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          ) : (
            <div>
              {reviews.map((review) => (
                <ReviewListItem
                  key={review.id}
                  review={review}
                  selected={selectedReviewId === review.id}
                  onClick={() => setSelectedReviewId(review.id)}
                />
              ))}
              {totalCount > pageSize && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-gray-500">
                    Page {page + 1} of {Math.ceil(totalCount / pageSize)}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * pageSize >= totalCount}
                    className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedReview ? (
        <div className="flex-1 min-w-0">
          <ReviewDetailPanel
            key={selectedReview.id}
            review={selectedReview}
            onUpdate={handleReviewUpdate}
            onClose={() => setSelectedReviewId(null)}
          />
        </div>
      ) : (
        <div className="flex-1 hidden lg:flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Select a review to view details</p>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
