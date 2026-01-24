import { RefreshCw, TrendingUp, Mail, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import type { EmailCampaignDomain, EmailWarmupDailyStat } from '../../../types';

interface WarmUpProgressPanelProps {
  domain: EmailCampaignDomain;
  stats: EmailWarmupDailyStat[];
  syncing: boolean;
  onSync: () => void;
}

export function WarmUpProgressPanel({ domain, stats, syncing, onSync }: WarmUpProgressPanelProps) {
  const chartData = stats.map((stat) => ({
    date: new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sent: stat.emails_sent,
    delivered: stat.emails_delivered,
    bounces: stat.bounces,
    opens: stat.opens,
  }));

  const latestStats = stats.length > 0 ? stats[stats.length - 1] : null;
  const totalSent = stats.reduce((sum, s) => sum + s.emails_sent, 0);
  const totalDelivered = stats.reduce((sum, s) => sum + s.emails_delivered, 0);
  const totalBounces = stats.reduce((sum, s) => sum + s.bounces, 0);
  const totalOpens = stats.reduce((sum, s) => sum + s.opens, 0);

  const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : '0';
  const bounceRate = totalSent > 0 ? ((totalBounces / totalSent) * 100).toFixed(2) : '0';
  const openRate = totalDelivered > 0 ? ((totalOpens / totalDelivered) * 100).toFixed(1) : '0';

  const bounceRateNum = parseFloat(bounceRate);
  const isBounceWarning = bounceRateNum > 1.5;
  const isBounceAlert = bounceRateNum > 2;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-white">Warm-up Progress</h4>
          <p className="text-xs text-slate-400 mt-1">
            {domain.status === 'warmed'
              ? 'Domain is fully warmed and ready for campaigns'
              : `Day ${Math.ceil(domain.warmup_progress_percent * 0.21)} of warm-up`}
          </p>
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          className="inline-flex items-center px-3 py-1.5 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          Sync Stats
        </button>
      </div>

      <div className="bg-slate-900/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Progress</span>
          <span className="text-sm font-medium text-white">{domain.warmup_progress_percent}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              domain.status === 'warmed'
                ? 'bg-emerald-500'
                : domain.status === 'paused'
                ? 'bg-slate-500'
                : 'bg-gradient-to-r from-amber-500 to-emerald-500'
            }`}
            style={{ width: `${domain.warmup_progress_percent}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>Started {domain.warmup_started_at ? new Date(domain.warmup_started_at).toLocaleDateString() : 'N/A'}</span>
          <span>Target: {domain.target_daily_volume.toLocaleString()} emails/day</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Mail className="h-5 w-5 text-cyan-400" />
            <span className="text-xs text-slate-500">Today</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">
            {domain.current_daily_limit.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400">Daily Limit</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <span className="text-xs text-slate-500">7 days</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{deliveryRate}%</p>
          <p className="text-xs text-slate-400">Delivery Rate</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            {isBounceAlert ? (
              <AlertTriangle className="h-5 w-5 text-red-400" />
            ) : isBounceWarning ? (
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            ) : (
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            )}
            <span className="text-xs text-slate-500">7 days</span>
          </div>
          <p className={`mt-2 text-2xl font-semibold ${
            isBounceAlert ? 'text-red-400' : isBounceWarning ? 'text-amber-400' : 'text-white'
          }`}>
            {bounceRate}%
          </p>
          <p className="text-xs text-slate-400">Bounce Rate</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            <span className="text-xs text-slate-500">7 days</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{openRate}%</p>
          <p className="text-xs text-slate-400">Open Rate</p>
        </div>
      </div>

      {isBounceAlert && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400">High bounce rate detected</p>
              <p className="text-xs text-slate-400 mt-1">
                Your bounce rate of {bounceRate}% exceeds the 2% threshold. This may affect
                deliverability and could trigger automatic warm-up pause.
              </p>
            </div>
          </div>
        </div>
      )}

      {stats.length > 0 ? (
        <div className="bg-slate-900/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-4">Send Volume (Last 30 Days)</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="deliveredGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke="#06b6d4"
                  fill="url(#sentGradient)"
                  strokeWidth={2}
                  name="Sent"
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  stroke="#10b981"
                  fill="url(#deliveredGradient)"
                  strokeWidth={2}
                  name="Delivered"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/50 rounded-lg p-8 text-center">
          <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-sm text-slate-400">No statistics available yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Stats will appear after the first warm-up sync
          </p>
        </div>
      )}

      {domain.last_synced_at && (
        <p className="text-xs text-slate-500 text-center">
          Last synced: {new Date(domain.last_synced_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
