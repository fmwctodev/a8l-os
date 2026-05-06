import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Activity, Target, AlertTriangle } from 'lucide-react';

interface DailyMetrics {
  date: string;             // ISO date "2026-05-05"
  enrolled: number;
  completed: number;
  failed: number;
  active: number;
}

interface ActionBreakdown {
  action_type: string;
  success: number;
  failed: number;
  skipped: number;
}

interface FailureReason {
  reason: string;
  count: number;
}

interface Props {
  daily: DailyMetrics[];
  actionBreakdown: ActionBreakdown[];
  failureReasons: FailureReason[];
  goalAchievementRate?: { goal: string; rate: number; total: number }[];
}

const ACTION_COLORS = ['#10b981', '#ef4444', '#9ca3af'];
const PIE_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#06b6d4'];

/**
 * WorkflowTrendsChart — P12 polish for the workflow analytics dashboard.
 *
 * Renders four panels using recharts:
 *  1. Daily enrollment trend (area chart, last 30 days)
 *  2. Action success/failure breakdown by action_type (stacked bar)
 *  3. Top failure reasons (pie + table)
 *  4. Goal achievement rate (gauge cards)
 */
export function WorkflowTrendsChart({
  daily,
  actionBreakdown,
  failureReasons,
  goalAchievementRate,
}: Props) {
  const dailyData = useMemo(
    () =>
      daily.map((d) => ({
        ...d,
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })),
    [daily]
  );

  const actionData = useMemo(
    () =>
      actionBreakdown.slice(0, 10).map((a) => ({
        name: a.action_type.replace(/_/g, ' '),
        Success: a.success,
        Failed: a.failed,
        Skipped: a.skipped,
      })),
    [actionBreakdown]
  );

  const totalFailures = useMemo(
    () => failureReasons.reduce((sum, r) => sum + r.count, 0),
    [failureReasons]
  );

  return (
    <div className="space-y-4">
      {/* ─── 1. Daily enrollment trend ─────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Daily Enrollment Trend
          </h3>
          <span className="text-xs text-gray-500">Last {dailyData.length} days</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="enrolled" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
            <Area type="monotone" dataKey="completed" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
            <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ─── 2. Action success/failure breakdown ────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            Action Breakdown
          </h3>
          <span className="text-xs text-gray-500">Top 10 actions</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={actionData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={140} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Success" stackId="a" fill={ACTION_COLORS[0]} />
            <Bar dataKey="Failed" stackId="a" fill={ACTION_COLORS[1]} />
            <Bar dataKey="Skipped" stackId="a" fill={ACTION_COLORS[2]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── 3. Top failure reasons ───────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Top Failure Reasons
            </h3>
            <span className="text-xs text-gray-500">{totalFailures} total</span>
          </div>
          {failureReasons.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No failures yet 🎉</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={failureReasons.slice(0, 6)}
                    dataKey="count"
                    nameKey="reason"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                  >
                    {failureReasons.slice(0, 6).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-3">
                {failureReasons.slice(0, 5).map((r, i) => (
                  <div
                    key={r.reason}
                    className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0"
                  >
                    <span className="flex items-center gap-2 text-gray-700">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      {r.reason}
                    </span>
                    <span className="font-medium text-gray-900">
                      {r.count}{' '}
                      <span className="text-gray-400">
                        ({totalFailures > 0 ? Math.round((r.count / totalFailures) * 100) : 0}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ─── 4. Goal achievement rate ─────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-500" />
              Goal Achievement
            </h3>
          </div>
          {!goalAchievementRate?.length ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No goal nodes configured in this workflow
            </div>
          ) : (
            <div className="space-y-3">
              {goalAchievementRate.map((g) => {
                const pct = Math.round(g.rate * 100);
                return (
                  <div key={g.goal}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-700 truncate">{g.goal}</span>
                      <span className="text-gray-900 font-medium">
                        {pct}%{' '}
                        <span className="text-gray-400">({Math.round(g.rate * g.total)} / {g.total})</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 50 ? 'bg-emerald-500' : pct >= 25 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
