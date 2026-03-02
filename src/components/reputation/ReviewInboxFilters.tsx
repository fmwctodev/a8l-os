import { useState } from 'react';
import { Search, X, ChevronDown, Filter } from 'lucide-react';

export interface InboxFilterState {
  platform: '' | 'googlebusiness' | 'facebook';
  hasReply: '' | 'true' | 'false';
  minRating: number;
  maxRating: number;
  sortBy: 'date' | 'rating';
  sortOrder: 'desc' | 'asc';
  search: string;
  slaBreached: '' | 'true';
  escalated: '' | 'true';
  priority: '' | 'low' | 'normal' | 'high' | 'urgent';
}

interface Props {
  filters: InboxFilterState;
  onChange: (filters: InboxFilterState) => void;
  onSync: () => void;
  syncing: boolean;
  totalCount: number;
}

export function ReviewInboxFilters({ filters, onChange, onSync, syncing, totalCount }: Props) {
  const [expanded, setExpanded] = useState(false);

  function update(partial: Partial<InboxFilterState>) {
    onChange({ ...filters, ...partial });
  }

  function clearAll() {
    onChange({
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
    });
  }

  const hasActiveFilters =
    filters.platform !== '' ||
    filters.hasReply !== '' ||
    filters.minRating > 1 ||
    filters.maxRating < 5 ||
    filters.slaBreached !== '' ||
    filters.escalated !== '' ||
    filters.priority !== '' ||
    filters.search !== '';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Search reviews..."
            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {filters.search && (
            <button
              onClick={() => update({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
            hasActiveFilters
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <select
            value={filters.platform}
            onChange={(e) => update({ platform: e.target.value as InboxFilterState['platform'] })}
            className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Platforms</option>
            <option value="googlebusiness">Google Business</option>
            <option value="facebook">Facebook</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filters.hasReply}
            onChange={(e) => update({ hasReply: e.target.value as InboxFilterState['hasReply'] })}
            className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Replies</option>
            <option value="false">Unreplied</option>
            <option value="true">Replied</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filters.sortBy}
            onChange={(e) => update({ sortBy: e.target.value as 'date' | 'rating' })}
            className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Sort by Date</option>
            <option value="rating">Sort by Rating</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={() => update({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc' })}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {filters.sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
        </button>

        <button
          onClick={onSync}
          disabled={syncing}
          className="ml-auto px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {syncing ? 'Syncing...' : 'Sync Reviews'}
        </button>
      </div>

      {expanded && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => update({ minRating: r })}
                    className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                      filters.minRating === r
                        ? 'bg-amber-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => update({ maxRating: r })}
                    className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                      filters.maxRating === r
                        ? 'bg-amber-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => update({ priority: e.target.value as InboxFilterState['priority'] })}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SLA Status</label>
              <select
                value={filters.slaBreached}
                onChange={(e) => update({ slaBreached: e.target.value as InboxFilterState['slaBreached'] })}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any</option>
                <option value="true">SLA Breached</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Escalated</label>
              <select
                value={filters.escalated}
                onChange={(e) => update({ escalated: e.target.value as InboxFilterState['escalated'] })}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any</option>
                <option value="true">Escalated Only</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end">
              <button
                onClick={clearAll}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-gray-500">
        {totalCount} review{totalCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
