import { Star, X } from 'lucide-react';
import type { ReviewFilters } from '../../types';

interface ReviewsFiltersProps {
  filters: ReviewFilters;
  onChange: (filters: ReviewFilters) => void;
}

export function ReviewsFilters({ filters, onChange }: ReviewsFiltersProps) {
  const providers = [
    { value: 'google', label: 'Google', color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 'facebook', label: 'Facebook', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { value: 'internal', label: 'Internal', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  ];

  const ratings = [5, 4, 3, 2, 1];

  const hasActiveFilters =
    (filters.provider && filters.provider.length > 0) ||
    (filters.rating && filters.rating.length > 0) ||
    filters.linked !== undefined ||
    filters.startDate ||
    filters.endDate;

  function clearFilters() {
    onChange({});
  }

  function toggleProvider(value: 'google' | 'facebook' | 'internal') {
    const current = filters.provider || [];
    const newProviders = current.includes(value)
      ? current.filter((p) => p !== value)
      : [...current, value];
    onChange({ ...filters, provider: newProviders.length > 0 ? newProviders : undefined });
  }

  function toggleRating(value: number) {
    const current = filters.rating || [];
    const newRatings = current.includes(value)
      ? current.filter((r) => r !== value)
      : [...current, value];
    onChange({ ...filters, rating: newRatings.length > 0 ? newRatings : undefined });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear all
          </button>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Provider
        </label>
        <div className="flex flex-wrap gap-2">
          {providers.map((provider) => (
            <button
              key={provider.value}
              onClick={() => toggleProvider(provider.value as 'google' | 'facebook' | 'internal')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filters.provider?.includes(provider.value as 'google' | 'facebook' | 'internal')
                  ? provider.color
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {provider.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Rating
        </label>
        <div className="flex gap-2">
          {ratings.map((rating) => (
            <button
              key={rating}
              onClick={() => toggleRating(rating)}
              className={`px-3 py-2 rounded-lg border transition-colors ${
                filters.rating?.includes(rating)
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-1">
                <Star
                  className="w-4 h-4"
                  fill={filters.rating?.includes(rating) ? '#FFA500' : 'none'}
                  stroke={filters.rating?.includes(rating) ? '#FFA500' : '#9CA3AF'}
                  strokeWidth={2}
                />
                <span className="text-sm font-medium text-gray-900">{rating}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Contact Status
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ ...filters, linked: true })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filters.linked === true
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Linked
          </button>
          <button
            onClick={() => onChange({ ...filters, linked: false })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filters.linked === false
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Unlinked
          </button>
          <button
            onClick={() => onChange({ ...filters, linked: undefined })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filters.linked === undefined
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Date Range
        </label>
        <div className="space-y-2">
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) =>
              onChange({ ...filters, startDate: e.target.value || undefined })
            }
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Start date"
          />
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) =>
              onChange({ ...filters, endDate: e.target.value || undefined })
            }
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="End date"
          />
        </div>
      </div>
    </div>
  );
}
