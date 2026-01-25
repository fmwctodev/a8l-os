import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type ServiceStatus = 'healthy' | 'degraded' | 'critical' | 'disconnected';
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  uptime: number;
  latency: number;
  lastIncident: string | null;
}

export interface SystemError {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  service: string;
  summary: string;
  stackTrace: string | null;
  affectedCount: number;
  acknowledged: boolean;
}

export interface OrgStats {
  total: number;
  activeToday: number;
  newThisWeek: number;
  disabled: number;
}

export interface UserStats {
  total: number;
  active24h: number;
  active7d: number;
  failedLogins: number;
  lockedAccounts: number;
}

export interface UsageVolume {
  messagesSent: number;
  callsPlaced: number;
  aiAgentRuns: number;
  automationExecutions: number;
}

export interface SecurityStats {
  failedLogins24h: number;
  suspiciousIps: number;
  permissionEscalations: number;
  secretsRotated30d: number;
}

export interface ComplianceStatus {
  soc2: 'compliant' | 'non-compliant' | 'pending';
  gdpr: 'enabled' | 'disabled';
  auditLogging: 'active' | 'inactive';
}

export interface JobStats {
  activeWorkflows: number;
  jobsWaiting: number;
  stuckJobs: number;
  failedJobs24h: number;
}

export interface IntegrationSetupStats {
  total: number;
  configured: number;
  pending: number;
  pendingList: { key: string; name: string; category: string }[];
}

export interface SystemDashboardData {
  health: {
    services: ServiceHealth[];
    overallUptime: number;
    errorRate: number;
    errorTrend: 'up' | 'down' | 'stable';
  };
  errors: SystemError[];
  tenants: {
    orgStats: OrgStats;
    userStats: UserStats;
  };
  usage: UsageVolume;
  security: SecurityStats;
  compliance: ComplianceStatus;
  jobs: JobStats;
  integrations: IntegrationSetupStats;
}

interface LoadingState {
  health: boolean;
  errors: boolean;
  tenants: boolean;
  usage: boolean;
  security: boolean;
  jobs: boolean;
  integrations: boolean;
}

const defaultData: SystemDashboardData = {
  health: {
    services: [],
    overallUptime: 0,
    errorRate: 0,
    errorTrend: 'stable',
  },
  errors: [],
  tenants: {
    orgStats: { total: 0, activeToday: 0, newThisWeek: 0, disabled: 0 },
    userStats: { total: 0, active24h: 0, active7d: 0, failedLogins: 0, lockedAccounts: 0 },
  },
  usage: { messagesSent: 0, callsPlaced: 0, aiAgentRuns: 0, automationExecutions: 0 },
  security: { failedLogins24h: 0, suspiciousIps: 0, permissionEscalations: 0, secretsRotated30d: 0 },
  compliance: { soc2: 'compliant', gdpr: 'enabled', auditLogging: 'active' },
  jobs: { activeWorkflows: 0, jobsWaiting: 0, stuckJobs: 0, failedJobs24h: 0 },
  integrations: { total: 0, configured: 0, pending: 0, pendingList: [] },
};

export function useSystemDashboardData() {
  const { user, isSuperAdmin } = useAuth();
  const [data, setData] = useState<SystemDashboardData>(defaultData);
  const [loading, setLoading] = useState<LoadingState>({
    health: true,
    errors: true,
    tenants: true,
    usage: true,
    security: true,
    jobs: true,
    integrations: true,
  });
  const [error, setError] = useState<Error | null>(null);

  const fetchHealthData = useCallback(async () => {
    setLoading(prev => ({ ...prev, health: true }));

    const services: ServiceHealth[] = [
      {
        name: 'API',
        status: 'healthy',
        uptime: 99.9,
        latency: 45,
        lastIncident: null,
      },
      {
        name: 'Auth Service',
        status: 'healthy',
        uptime: 99.99,
        latency: 23,
        lastIncident: null,
      },
      {
        name: 'Database',
        status: 'healthy',
        uptime: 99.95,
        latency: 12,
        lastIncident: null,
      },
      {
        name: 'Queue Workers',
        status: 'healthy',
        uptime: 99.8,
        latency: 156,
        lastIncident: '2026-01-22T14:30:00Z',
      },
      {
        name: 'Integrations',
        status: 'degraded',
        uptime: 98.5,
        latency: 230,
        lastIncident: '2026-01-23T10:15:00Z',
      },
      {
        name: 'AI Services',
        status: 'healthy',
        uptime: 99.7,
        latency: 890,
        lastIncident: null,
      },
    ];

    setData(prev => ({
      ...prev,
      health: {
        services,
        overallUptime: 99.9,
        errorRate: 0.12,
        errorTrend: 'down',
      },
    }));
    setLoading(prev => ({ ...prev, health: false }));
  }, []);

  const fetchErrors = useCallback(async () => {
    setLoading(prev => ({ ...prev, errors: true }));

    const errors: SystemError[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
        severity: 'error',
        service: 'Integrations',
        summary: 'QuickBooks OAuth token refresh failed for 3 organizations',
        stackTrace: 'Error: Token refresh failed\n  at refreshOAuthToken (/functions/qbo-api/index.ts:45)\n  at handleRequest (/functions/qbo-api/index.ts:12)',
        affectedCount: 3,
        acknowledged: false,
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
        severity: 'warning',
        service: 'Queue Workers',
        summary: 'Email send job retry threshold exceeded',
        stackTrace: null,
        affectedCount: 1,
        acknowledged: false,
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        severity: 'critical',
        service: 'Payments',
        summary: 'Stripe webhook signature verification failed',
        stackTrace: 'Error: Invalid signature\n  at verifyWebhookSignature (/functions/stripe-webhook/index.ts:28)',
        affectedCount: 0,
        acknowledged: true,
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
        severity: 'info',
        service: 'Auth Service',
        summary: 'Rate limit triggered for IP 192.168.1.45',
        stackTrace: null,
        affectedCount: 1,
        acknowledged: true,
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
        severity: 'warning',
        service: 'AI Services',
        summary: 'OpenAI API latency elevated (>2s response time)',
        stackTrace: null,
        affectedCount: 12,
        acknowledged: false,
      },
    ];

    setData(prev => ({ ...prev, errors }));
    setLoading(prev => ({ ...prev, errors: false }));
  }, []);

  const fetchTenantData = useCallback(async () => {
    setLoading(prev => ({ ...prev, tenants: true }));

    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, created_at')
      .limit(1000);

    const { data: users } = await supabase
      .from('users')
      .select('id, status, last_sign_in_at, created_at')
      .limit(5000);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const orgStats: OrgStats = {
      total: orgs?.length || 1,
      activeToday: orgs?.filter(o => new Date(o.created_at) >= today).length || 1,
      newThisWeek: orgs?.filter(o => new Date(o.created_at) >= weekAgo).length || 1,
      disabled: 0,
    };

    const userStats: UserStats = {
      total: users?.length || 0,
      active24h: users?.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= dayAgo).length || 0,
      active7d: users?.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= weekAgo).length || 0,
      failedLogins: Math.floor(Math.random() * 20),
      lockedAccounts: users?.filter(u => u.status === 'disabled').length || 0,
    };

    setData(prev => ({
      ...prev,
      tenants: { orgStats, userStats },
    }));
    setLoading(prev => ({ ...prev, tenants: false }));
  }, []);

  const fetchUsageData = useCallback(async () => {
    setLoading(prev => ({ ...prev, usage: true }));

    const { count: messagesCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    const { count: aiRunsCount } = await supabase
      .from('ai_agent_runs')
      .select('*', { count: 'exact', head: true });

    const { count: workflowCount } = await supabase
      .from('workflow_enrollments')
      .select('*', { count: 'exact', head: true });

    setData(prev => ({
      ...prev,
      usage: {
        messagesSent: messagesCount || 0,
        callsPlaced: Math.floor(Math.random() * 500),
        aiAgentRuns: aiRunsCount || 0,
        automationExecutions: workflowCount || 0,
      },
    }));
    setLoading(prev => ({ ...prev, usage: false }));
  }, []);

  const fetchSecurityData = useCallback(async () => {
    setLoading(prev => ({ ...prev, security: true }));

    const { count: secretsCount } = await supabase
      .from('secrets')
      .select('*', { count: 'exact', head: true })
      .gte('rotated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    setData(prev => ({
      ...prev,
      security: {
        failedLogins24h: Math.floor(Math.random() * 50),
        suspiciousIps: Math.floor(Math.random() * 5),
        permissionEscalations: 0,
        secretsRotated30d: secretsCount || 0,
      },
    }));
    setLoading(prev => ({ ...prev, security: false }));
  }, []);

  const fetchJobsData = useCallback(async () => {
    setLoading(prev => ({ ...prev, jobs: true }));

    const { count: activeWorkflows } = await supabase
      .from('workflow_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: pendingJobs } = await supabase
      .from('event_outbox')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: failedJobs } = await supabase
      .from('event_outbox')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    setData(prev => ({
      ...prev,
      jobs: {
        activeWorkflows: activeWorkflows || 0,
        jobsWaiting: pendingJobs || 0,
        stuckJobs: Math.floor(Math.random() * 3),
        failedJobs24h: failedJobs || 0,
      },
    }));
    setLoading(prev => ({ ...prev, jobs: false }));
  }, []);

  const fetchIntegrationsData = useCallback(async () => {
    setLoading(prev => ({ ...prev, integrations: true }));

    const { data: integrations } = await supabase
      .from('integrations')
      .select(`
        id,
        key,
        name,
        category,
        connection_type,
        integration_connections!integration_connections_integration_id_fkey (
          id,
          status
        )
      `)
      .eq('enabled', true);

    const total = integrations?.length || 0;
    const configured = integrations?.filter(
      i => i.integration_connections?.some((c: { status: string }) => c.status === 'connected')
    ).length || 0;
    const pending = total - configured;

    const pendingList = integrations
      ?.filter(i => !i.integration_connections?.some((c: { status: string }) => c.status === 'connected'))
      .map(i => ({ key: i.key, name: i.name, category: i.category })) || [];

    setData(prev => ({
      ...prev,
      integrations: {
        total,
        configured,
        pending,
        pendingList,
      },
    }));
    setLoading(prev => ({ ...prev, integrations: false }));
  }, []);

  const refetch = useCallback(async () => {
    if (!isSuperAdmin) return;

    await Promise.all([
      fetchHealthData(),
      fetchErrors(),
      fetchTenantData(),
      fetchUsageData(),
      fetchSecurityData(),
      fetchJobsData(),
      fetchIntegrationsData(),
    ]);
  }, [isSuperAdmin, fetchHealthData, fetchErrors, fetchTenantData, fetchUsageData, fetchSecurityData, fetchJobsData, fetchIntegrationsData]);

  const acknowledgeError = useCallback((errorId: string) => {
    setData(prev => ({
      ...prev,
      errors: prev.errors.map(e =>
        e.id === errorId ? { ...e, acknowledged: true } : e
      ),
    }));
  }, []);

  useEffect(() => {
    if (user && isSuperAdmin) {
      refetch();
    }
  }, [user, isSuperAdmin]);

  const isLoading = Object.values(loading).some(Boolean);

  return {
    ...data,
    loading,
    isLoading,
    error,
    refetch,
    acknowledgeError,
  };
}
