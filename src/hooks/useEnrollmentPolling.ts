import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { WorkflowExecutionLog, EnrollmentStatus } from '../types';

interface EnrollmentState {
  status: EnrollmentStatus;
  currentNodeId: string | null;
  logs: WorkflowExecutionLog[];
  lastUpdated: string;
}

interface UseEnrollmentPollingOptions {
  pollInterval?: number;
  enabled?: boolean;
}

export function useEnrollmentPolling(
  enrollmentId: string | null,
  options: UseEnrollmentPollingOptions = {}
) {
  const { pollInterval = 5000, enabled = true } = options;

  const [state, setState] = useState<EnrollmentState | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [recentChanges, setRecentChanges] = useState<Set<string>>(new Set());

  const previousLogsRef = useRef<WorkflowExecutionLog[]>([]);
  const intervalRef = useRef<number | null>(null);

  const fetchEnrollmentData = useCallback(async () => {
    if (!enrollmentId) return;

    try {
      const [enrollmentResult, logsResult] = await Promise.all([
        supabase
          .from('workflow_enrollments')
          .select('status, current_node_id, updated_at')
          .eq('id', enrollmentId)
          .single(),
        supabase
          .from('workflow_execution_logs')
          .select('*')
          .eq('enrollment_id', enrollmentId)
          .order('created_at', { ascending: true })
      ]);

      if (enrollmentResult.error) throw enrollmentResult.error;
      if (logsResult.error) throw logsResult.error;

      const enrollment = enrollmentResult.data;
      const logs = logsResult.data as WorkflowExecutionLog[];

      const previousLogIds = new Set(previousLogsRef.current.map(l => l.id));
      const newLogIds = new Set<string>();
      logs.forEach(log => {
        if (!previousLogIds.has(log.id)) {
          newLogIds.add(log.node_id);
        }
      });

      if (newLogIds.size > 0) {
        setRecentChanges(newLogIds);
        setTimeout(() => setRecentChanges(new Set()), 2000);
      }

      previousLogsRef.current = logs;

      setState({
        status: enrollment.status as EnrollmentStatus,
        currentNodeId: enrollment.current_node_id,
        logs,
        lastUpdated: enrollment.updated_at
      });

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch enrollment data'));
    }
  }, [enrollmentId]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    setIsPolling(true);
    fetchEnrollmentData();

    intervalRef.current = window.setInterval(() => {
      if (state?.status !== 'active') {
        stopPolling();
        return;
      }
      fetchEnrollmentData();
    }, pollInterval);
  }, [fetchEnrollmentData, pollInterval, state?.status]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const refresh = useCallback(() => {
    return fetchEnrollmentData();
  }, [fetchEnrollmentData]);

  useEffect(() => {
    if (!enrollmentId || !enabled) {
      stopPolling();
      setState(null);
      return;
    }

    fetchEnrollmentData();

    return () => {
      stopPolling();
    };
  }, [enrollmentId, enabled, fetchEnrollmentData, stopPolling]);

  useEffect(() => {
    if (!enrollmentId || !enabled || !state) return;

    if (state.status === 'active') {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enrollmentId, enabled, state?.status, startPolling, stopPolling]);

  const getNodeStatus = useCallback((nodeId: string): {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting' | 'skipped';
    logs: WorkflowExecutionLog[];
  } => {
    if (!state) {
      return { status: 'pending', logs: [] };
    }

    const nodeLogs = state.logs.filter(l => l.node_id === nodeId);

    if (nodeLogs.length === 0) {
      if (state.currentNodeId === nodeId) {
        return { status: 'running', logs: [] };
      }
      return { status: 'pending', logs: [] };
    }

    const lastLog = nodeLogs[nodeLogs.length - 1];

    switch (lastLog.event_type) {
      case 'node_started':
        return { status: 'running', logs: nodeLogs };
      case 'node_completed':
        return { status: 'completed', logs: nodeLogs };
      case 'node_failed':
        return { status: 'failed', logs: nodeLogs };
      case 'node_waiting':
        return { status: 'waiting', logs: nodeLogs };
      case 'node_skipped':
        return { status: 'skipped', logs: nodeLogs };
      default:
        return { status: 'pending', logs: nodeLogs };
    }
  }, [state]);

  const hasRecentChange = useCallback((nodeId: string): boolean => {
    return recentChanges.has(nodeId);
  }, [recentChanges]);

  return {
    state,
    isPolling,
    error,
    refresh,
    startPolling,
    stopPolling,
    getNodeStatus,
    hasRecentChange
  };
}
