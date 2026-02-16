import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchEdge } from '../lib/edgeFunction';
import type { TimeRange } from '../components/analytics/TimeRangeSelector';
import { exportContentAIToPDF } from '../services/pdfExport';
import type { ContentAIAnalytics } from '../services/contentAIAnalytics';

interface UseContentAIAnalyticsResult {
  data: ContentAIAnalytics | null;
  loading: boolean;
  error: string | null;
  timeRange: TimeRange;
  platformFilter?: string;
  startDate?: string;
  endDate?: string;
  setTimeRange: (range: TimeRange, start?: string, end?: string) => void;
  setPlatformFilter: (platform?: string) => void;
  refetch: () => Promise<void>;
  exportToPDF: () => Promise<void>;
}

export function useContentAIAnalytics(): UseContentAIAnalyticsResult {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<ContentAIAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timeRange = (searchParams.get('range') || '30d') as TimeRange;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const platformFilter = searchParams.get('platform') || undefined;

  const setTimeRange = useCallback((range: TimeRange, start?: string, end?: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('range', range);

    if (range === 'custom' && start && end) {
      params.set('startDate', start);
      params.set('endDate', end);
    } else {
      params.delete('startDate');
      params.delete('endDate');
    }

    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const setPlatformFilter = useCallback((platform?: string) => {
    const params = new URLSearchParams(searchParams);

    if (platform) {
      params.set('platform', platform);
    } else {
      params.delete('platform');
    }

    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const fetchData = useCallback(async () => {
    if (!user?.organization_id) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        range: timeRange,
      });

      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (platformFilter) params.set('platform', platformFilter);

      const queryParams: Record<string, string> = Object.fromEntries(params);
      const response = await fetchEdge('analytics-content-ai', { method: 'GET', params: queryParams });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Failed to fetch analytics');
      }

      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
      } else {
        throw new Error(result.error?.message || 'Invalid response format');
      }
    } catch (err) {
      console.error('Failed to fetch content AI analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, timeRange, startDate, endDate, platformFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const timeRangeLabel = useMemo(() => {
    if (timeRange === 'custom' && startDate && endDate) {
      const start = new Date(startDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const end = new Date(endDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${start} - ${end}`;
    }

    const labels: Record<TimeRange, string> = {
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
      '90d': 'Last 90 Days',
      custom: 'Custom Range',
    };
    return labels[timeRange];
  }, [timeRange, startDate, endDate]);

  const exportToPDF = useCallback(async () => {
    if (!data) return;

    const orgName = user?.organization?.name || 'Organization';
    await exportContentAIToPDF(data, orgName, timeRangeLabel);
  }, [data, user?.organization?.name, timeRangeLabel]);

  return {
    data,
    loading,
    error,
    timeRange,
    platformFilter,
    startDate,
    endDate,
    setTimeRange,
    setPlatformFilter,
    refetch: fetchData,
    exportToPDF,
  };
}
