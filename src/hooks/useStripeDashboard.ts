import { useCallback, useEffect, useState } from 'react';
import {
  getStripeDashboardSnapshot,
  type DashboardDateRange,
  type StripeDashboardSnapshot,
} from '../services/stripeDashboard';

export type StripeDateRangePreset = '7d' | '30d' | '90d';

function presetToRange(preset: StripeDateRangePreset): DashboardDateRange {
  const end = new Date();
  const start = new Date();
  if (preset === '7d') start.setDate(start.getDate() - 7);
  else if (preset === '30d') start.setDate(start.getDate() - 30);
  else if (preset === '90d') start.setDate(start.getDate() - 90);
  return { start, end };
}

interface UseStripeDashboardResult {
  snapshot: StripeDashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  preset: StripeDateRangePreset;
  setPreset: (p: StripeDateRangePreset) => void;
  refetch: () => Promise<void>;
}

export function useStripeDashboard(): UseStripeDashboardResult {
  const [preset, setPreset] = useState<StripeDateRangePreset>('30d');
  const [snapshot, setSnapshot] = useState<StripeDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStripeDashboardSnapshot(presetToRange(preset));
      setSnapshot(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Stripe dashboard');
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { snapshot, loading, error, preset, setPreset, refetch };
}
