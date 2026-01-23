import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getDashboardStats,
  getAssignedConversations,
  getUserTasksDue,
  getNextAppointments,
  getSystemHealthStatus,
  type DashboardStats,
  type AssignedConversation,
  type TaskDue,
  type UpcomingAppointment,
  type SystemHealthStatus,
  type DateRange,
} from '../services/dashboard';
import {
  getRecentActivity,
  type ActivityLogEntry,
  type ActivityFilter,
} from '../services/activityLog';

interface DashboardData {
  stats: DashboardStats | null;
  conversations: AssignedConversation[];
  tasks: TaskDue[];
  appointments: UpcomingAppointment[];
  activity: ActivityLogEntry[];
  systemHealth: SystemHealthStatus;
}

interface LoadingState {
  stats: boolean;
  conversations: boolean;
  tasks: boolean;
  appointments: boolean;
  activity: boolean;
  systemHealth: boolean;
}

interface ErrorState {
  stats: Error | null;
  conversations: Error | null;
  tasks: Error | null;
  appointments: Error | null;
  activity: Error | null;
  systemHealth: Error | null;
}

export function useDashboardData(dateRange?: DateRange) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    stats: null,
    conversations: [],
    tasks: [],
    appointments: [],
    activity: [],
    systemHealth: { messaging: 'disconnected', calendar: 'disconnected', payments: 'disconnected' },
  });
  const [loading, setLoading] = useState<LoadingState>({
    stats: true,
    conversations: true,
    tasks: true,
    appointments: true,
    activity: true,
    systemHealth: true,
  });
  const [errors, setErrors] = useState<ErrorState>({
    stats: null,
    conversations: null,
    tasks: null,
    appointments: null,
    activity: null,
    systemHealth: null,
  });
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');

  const organizationId = user?.organization_id;
  const userId = user?.id;

  const fetchStats = useCallback(async () => {
    if (!organizationId) return;
    setLoading((prev) => ({ ...prev, stats: true }));
    const { data: stats, error } = await getDashboardStats(organizationId, dateRange);
    setData((prev) => ({ ...prev, stats }));
    setErrors((prev) => ({ ...prev, stats: error }));
    setLoading((prev) => ({ ...prev, stats: false }));
  }, [organizationId, dateRange]);

  const fetchConversations = useCallback(async () => {
    if (!userId || !organizationId) return;
    setLoading((prev) => ({ ...prev, conversations: true }));
    const { data: conversations, error } = await getAssignedConversations(userId, organizationId);
    setData((prev) => ({ ...prev, conversations }));
    setErrors((prev) => ({ ...prev, conversations: error }));
    setLoading((prev) => ({ ...prev, conversations: false }));
  }, [userId, organizationId]);

  const fetchTasks = useCallback(async () => {
    if (!userId || !organizationId) return;
    setLoading((prev) => ({ ...prev, tasks: true }));
    const { data: tasks, error } = await getUserTasksDue(userId, organizationId);
    setData((prev) => ({ ...prev, tasks }));
    setErrors((prev) => ({ ...prev, tasks: error }));
    setLoading((prev) => ({ ...prev, tasks: false }));
  }, [userId, organizationId]);

  const fetchAppointments = useCallback(async () => {
    if (!userId || !organizationId) return;
    setLoading((prev) => ({ ...prev, appointments: true }));
    const { data: appointments, error } = await getNextAppointments(userId, organizationId);
    setData((prev) => ({ ...prev, appointments }));
    setErrors((prev) => ({ ...prev, appointments: error }));
    setLoading((prev) => ({ ...prev, appointments: false }));
  }, [userId, organizationId]);

  const fetchActivity = useCallback(async () => {
    if (!organizationId) return;
    setLoading((prev) => ({ ...prev, activity: true }));
    const { data: activity, error } = await getRecentActivity(organizationId, {
      filter: activityFilter,
      userId,
      limit: 20,
    });
    setData((prev) => ({ ...prev, activity }));
    setErrors((prev) => ({ ...prev, activity: error }));
    setLoading((prev) => ({ ...prev, activity: false }));
  }, [organizationId, userId, activityFilter]);

  const fetchSystemHealth = useCallback(async () => {
    if (!organizationId) return;
    setLoading((prev) => ({ ...prev, systemHealth: true }));
    const { data: systemHealth, error } = await getSystemHealthStatus(organizationId);
    setData((prev) => ({ ...prev, systemHealth }));
    setErrors((prev) => ({ ...prev, systemHealth: error }));
    setLoading((prev) => ({ ...prev, systemHealth: false }));
  }, [organizationId]);

  const refetch = useCallback(() => {
    fetchStats();
    fetchConversations();
    fetchTasks();
    fetchAppointments();
    fetchActivity();
    fetchSystemHealth();
  }, [fetchStats, fetchConversations, fetchTasks, fetchAppointments, fetchActivity, fetchSystemHealth]);

  useEffect(() => {
    if (organizationId && userId) {
      refetch();
    }
  }, [organizationId, userId]);

  useEffect(() => {
    if (organizationId) {
      fetchActivity();
    }
  }, [activityFilter, organizationId, fetchActivity]);

  const isLoading = Object.values(loading).some(Boolean);

  return {
    ...data,
    loading,
    errors,
    isLoading,
    activityFilter,
    setActivityFilter,
    refetch,
    refetchStats: fetchStats,
    refetchConversations: fetchConversations,
    refetchTasks: fetchTasks,
    refetchAppointments: fetchAppointments,
    refetchActivity: fetchActivity,
  };
}
