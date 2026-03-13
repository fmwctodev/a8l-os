import { useState, useEffect } from 'react';
import {
  BarChart3, PhoneCall, MessageSquare, Globe, Users,
  Clock, AlertTriangle, CheckCircle, TrendingUp, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getVoiceAnalytics } from '../../../services/vapiAnalytics';
import type { VapiAnalyticsData } from '../../../services/vapiAnalytics';

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: typeof PhoneCall;
  color: string;
  bgColor: string;
  subtitle?: string;
}

function StatCard({ label, value, icon: Icon, color, bgColor, subtitle }: StatCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
}

export function VapiAnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<VapiAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (showRefresh = false) => {
    if (!user?.organization_id) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const analytics = await getVoiceAnalytics(user.organization_id);
      setData(analytics);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.organization_id]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Voice AI Analytics</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Today's overview of your voice, SMS, and web chat operations
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5 animate-pulse">
              <div className="w-10 h-10 bg-slate-700 rounded-lg mb-3" />
              <div className="h-7 w-16 bg-slate-700 rounded mb-2" />
              <div className="h-4 w-24 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Assistants"
              value={data.totalAssistants}
              icon={Users}
              color="text-cyan-400"
              bgColor="bg-cyan-500/10"
              subtitle={`${data.publishedAssistants} published`}
            />
            <StatCard
              label="Calls Today"
              value={data.callsToday}
              icon={PhoneCall}
              color="text-emerald-400"
              bgColor="bg-emerald-500/10"
            />
            <StatCard
              label="SMS Sessions"
              value={data.smsSessionsToday}
              icon={MessageSquare}
              color="text-blue-400"
              bgColor="bg-blue-500/10"
            />
            <StatCard
              label="Web Chat Sessions"
              value={data.webchatSessionsToday}
              icon={Globe}
              color="text-teal-400"
              bgColor="bg-teal-500/10"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Avg Call Duration"
              value={formatDuration(data.avgCallDuration)}
              icon={Clock}
              color="text-amber-400"
              bgColor="bg-amber-500/10"
            />
            <StatCard
              label="Tool Success Rate"
              value={`${data.toolCallSuccessRate}%`}
              icon={CheckCircle}
              color="text-emerald-400"
              bgColor="bg-emerald-500/10"
            />
            <StatCard
              label="Failed"
              value={data.failedCount}
              icon={AlertTriangle}
              color={data.failedCount > 0 ? 'text-red-400' : 'text-slate-400'}
              bgColor={data.failedCount > 0 ? 'bg-red-500/10' : 'bg-slate-500/10'}
              subtitle="Calls & sessions"
            />
            <StatCard
              label="Total Volume"
              value={data.callsToday + data.smsSessionsToday + data.webchatSessionsToday}
              icon={TrendingUp}
              color="text-cyan-400"
              bgColor="bg-cyan-500/10"
              subtitle="All channels today"
            />
          </div>

          {data.totalAssistants === 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
              <BarChart3 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-medium text-white mb-1">Get started with Voice AI</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Create your first assistant in the Assistants tab to start seeing analytics here.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-800/50 border border-slate-700 rounded-xl">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-white mb-1">Unable to load analytics</h3>
          <p className="text-sm text-slate-400">Please try refreshing the page.</p>
        </div>
      )}
    </div>
  );
}
