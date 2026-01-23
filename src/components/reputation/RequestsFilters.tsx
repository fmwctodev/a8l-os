import { X, MessageSquare, Mail } from 'lucide-react';
import type { ReviewRequestFilters, ReviewRequestStatus } from '../../types';

interface RequestsFiltersProps {
  filters: ReviewRequestFilters;
  onChange: (filters: ReviewRequestFilters) => void;
}

export function RequestsFilters({ filters, onChange }: RequestsFiltersProps) {
  const statuses: { value: ReviewRequestStatus; label: string; color: string }[] = [
    { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700' },
    { value: 'sent', label: 'Sent', color: 'bg-gray-100 text-gray-700' },
    { value: 'clicked', label: 'Clicked', color: 'bg-blue-100 text-blue-700' },
    { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  ];

  const channels = [
    { value: 'sms', label: 'SMS', icon: MessageSquare },
    { value: 'email', label: 'Email', icon: Mail },
  ];

  const hasActiveFilters =
    (filters.status && filters.status.length > 0) ||
    (filters.channel && filters.channel.length > 0) ||
    filters.startDate ||
    filters.endDate;

  function clearFilters() {
    onChange({});
  }

  function toggleStatus(value: ReviewRequestStatus) {
    const current = filters.status || [];
    const newStatuses = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    onChange({ ...filters, status: newStatuses.length > 0 ? newStatuses : undefined });
  }

  function toggleChannel(value: 'sms' | 'email') {
    const current = filters.channel || [];
    const newChannels = current.includes(value)
      ? current.filter((c) => c !== value)
      : [...current, value];
    onChange({ ...filters, channel: newChannels.length > 0 ? newChannels : undefined });
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
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <button
              key={status.value}
              onClick={() => toggleStatus(status.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filters.status?.includes(status.value)
                  ? `${status.color} border-current`
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Channel
        </label>
        <div className="flex gap-2">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <button
                key={channel.value}
                onClick={() => toggleChannel(channel.value as 'sms' | 'email')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  filters.channel?.includes(channel.value as 'sms' | 'email')
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {channel.label}
              </button>
            );
          })}
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
