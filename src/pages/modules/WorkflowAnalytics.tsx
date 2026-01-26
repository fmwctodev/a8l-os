import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Mail,
  Calendar,
  DollarSign,
  AlertTriangle,
  BarChart3,
  Activity,
  Bot
} from 'lucide-react';
import { getWorkflowById, getWorkflowVersions } from '../../services/workflows';
import {
  getWorkflowAnalytics,
  invalidateAnalyticsCache,
  type WorkflowAnalytics as WorkflowAnalyticsType,
  type TimeRange
} from '../../services/workflowAnalytics';
import { TimeRangeSelector } from '../../components/analytics/TimeRangeSelector';
import { WorkflowSankeyFunnel } from '../../components/analytics/WorkflowSankeyFunnel';
import { WorkflowErrors } from '../../components/analytics/WorkflowErrors';
import { WorkflowAIAnalytics } from '../../components/analytics/WorkflowAIAnalytics';
import type { Workflow, WorkflowVersion, WorkflowDefinition } from '../../types';

type TabId = 'overview' | 'funnel' | 'errors' | 'ai';

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
  return `${Math.round(ms / 86400000)}d`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function DeltaIndicator({ current, previous, format = 'number' }: {
  current: number;
  previous: number;
  format?: 'number' | 'percent';
}) {
  const delta = current - previous;
  const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;

  if (delta === 0) return null;

  const isPositive = delta > 0;

  return (
    <span className={`flex items-center gap-0.5 text-xs ${
      isPositive ? 'text-emerald-600' : 'text-red-600'
    }`}>
      {isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {format === 'percent'
        ? `${Math.abs(percentChange).toFixed(1)}%`
        : isPositive ? `+${delta}` : delta}
    </span>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  previousValue,
  color,
  format = 'number'
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  previousValue?: number;
  color: string;
  format?: 'number' | 'percent' | 'duration' | 'currency';
}) {
  const formattedValue = format === 'percent'
    ? `${(value * 100).toFixed(1)}%`
    : format === 'duration'
    ? formatDuration(value)
    : format === 'currency'
    ? formatCurrency(value)
    : value.toLocaleString();

  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className={`flex items-center gap-2 ${color} mb-2`}>
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formattedValue}
        </p>
        {previousValue !== undefined && (
          <DeltaIndicator
            current={value}
            previous={previousValue}
            format={format === 'percent' ? 'percent' : 'number'}
          />
        )}
      </div>
    </div>
  );
}

export default function WorkflowAnalytics() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [analytics, setAnalytics] = useState<WorkflowAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [versionFilter, setVersionFilter] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const loadData = useCallback(async (showRefreshing = false, bypassCache = false) => {
    if (!id) return;

    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [wf, vers] = await Promise.all([
        getWorkflowById(id),
        getWorkflowVersions(id)
      ]);

      setWorkflow(wf);
      setVersions(vers);

      const analyticsData = await getWorkflowAnalytics(
        id,
        timeRange,
        versionFilter,
        undefined,
        undefined,
        bypassCache
      );

      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, timeRange, versionFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    invalidateAnalyticsCache(id!);
    loadData(true, true);
  };

  const handleExport = () => {
    if (!analytics) return;

    const data = {
      workflow: workflow?.name,
      timeRange,
      versionFilter,
      exportedAt: new Date().toISOString(),
      metrics: analytics.metrics,
      attribution: analytics.attribution,
      stepFunnel: analytics.stepFunnel,
      errors: analytics.errors
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-analytics-${id}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasAISteps = analytics?.aiPerformance !== null;

  const tabs: { id: TabId; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3, show: true },
    { id: 'funnel', label: 'Funnel', icon: Activity, show: true },
    { id: 'errors', label: 'Errors', icon: AlertTriangle, show: true },
    { id: 'ai', label: 'AI Performance', icon: Bot, show: hasAISteps }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!workflow || !analytics) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Unable to load analytics
        </h2>
        <button
          onClick={() => navigate(`/automation/${id}`)}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          Back to Workflow
        </button>
      </div>
    );
  }

  const { metrics, attribution } = analytics;
  const definition = workflow.published_definition as WorkflowDefinition | undefined;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/automation/${id}`)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {workflow.name} - Analytics
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated {new Date(analytics.computedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <TimeRangeSelector
              value={timeRange}
              onChange={(v) => setTimeRange(v as TimeRange)}
            />

            <select
              value={versionFilter ?? ''}
              onChange={(e) => setVersionFilter(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <option value="">All versions</option>
              {versions.map(v => (
                <option key={v.id} value={v.version_number}>
                  Version {v.version_number}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 border-t border-gray-200 dark:border-gray-700">
          <nav className="flex gap-6">
            {tabs.filter(t => t.show).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                icon={Users}
                label="Total Enrollments"
                value={metrics.totalEnrollments}
                previousValue={metrics.previousPeriod?.totalEnrollments}
                color="text-blue-600 dark:text-blue-400"
              />
              <KPICard
                icon={Activity}
                label="Active"
                value={metrics.activeEnrollments}
                color="text-emerald-600 dark:text-emerald-400"
              />
              <KPICard
                icon={CheckCircle}
                label="Completed"
                value={metrics.completedEnrollments}
                previousValue={metrics.previousPeriod?.completedEnrollments}
                color="text-emerald-600 dark:text-emerald-400"
              />
              <KPICard
                icon={XCircle}
                label="Failed"
                value={metrics.failedEnrollments}
                previousValue={metrics.previousPeriod?.failedEnrollments}
                color="text-red-600 dark:text-red-400"
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                icon={Clock}
                label="Avg Completion Time"
                value={metrics.avgCompletionTimeMs || 0}
                color="text-amber-600 dark:text-amber-400"
                format="duration"
              />
              <KPICard
                icon={TrendingDown}
                label="Drop-off Rate"
                value={metrics.dropOffRate}
                color="text-red-600 dark:text-red-400"
                format="percent"
              />
              <KPICard
                icon={Mail}
                label="Messages Sent"
                value={attribution.messagesSent}
                color="text-blue-600 dark:text-blue-400"
              />
              <KPICard
                icon={Calendar}
                label="Appointments Booked"
                value={attribution.appointmentsBooked}
                color="text-emerald-600 dark:text-emerald-400"
              />
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Revenue Influenced
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    From invoices paid by enrolled contacts within 30 days
                  </p>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(attribution.revenueInfluenced)}
              </p>
            </div>

            {analytics.stepFunnel.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Step Performance Overview
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                          Step
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">
                          Reached
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">
                          Succeeded
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">
                          Failed
                        </th>
                        <th className="text-right py-2 pl-4 font-medium text-gray-500 dark:text-gray-400">
                          Success Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.stepFunnel.slice(0, 10).map(step => {
                        const successRate = step.reached > 0
                          ? (step.succeeded / step.reached) * 100
                          : 0;

                        return (
                          <tr
                            key={step.nodeId}
                            className="border-b border-gray-100 dark:border-gray-800"
                          >
                            <td className="py-3 pr-4">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {step.nodeName}
                              </span>
                            </td>
                            <td className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">
                              {step.reached.toLocaleString()}
                            </td>
                            <td className="text-right py-3 px-4 text-emerald-600">
                              {step.succeeded.toLocaleString()}
                            </td>
                            <td className="text-right py-3 px-4 text-red-600">
                              {step.failed.toLocaleString()}
                            </td>
                            <td className="text-right py-3 pl-4">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${successRate}%` }}
                                  />
                                </div>
                                <span className="text-gray-600 dark:text-gray-400 w-12 text-right">
                                  {successRate.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'funnel' && definition && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Workflow Funnel
              </h3>
              <WorkflowSankeyFunnel
                stepData={analytics.stepFunnel}
                definition={definition}
                totalEnrollments={metrics.totalEnrollments}
              />
            </div>
          </div>
        )}

        {activeTab === 'errors' && (
          <WorkflowErrors
            errors={analytics.errors}
            onViewEnrollments={(nodeId) => {
              navigate(`/automation/${id}/runs?nodeId=${nodeId}&status=errored`);
            }}
          />
        )}

        {activeTab === 'ai' && analytics.aiPerformance && (
          <WorkflowAIAnalytics metrics={analytics.aiPerformance} />
        )}
      </div>
    </div>
  );
}
