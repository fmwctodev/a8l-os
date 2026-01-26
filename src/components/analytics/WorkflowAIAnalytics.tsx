import {
  Bot,
  Clock,
  Coins,
  CheckCircle,
  XCircle,
  MessageSquare,
  Calendar,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { AIPerformanceMetrics } from '../../services/workflowAnalytics';

interface WorkflowAIAnalyticsProps {
  metrics: AIPerformanceMetrics;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#ec4899'];

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  color
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}) {
  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className={`flex items-center gap-2 ${color} mb-2`}>
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      {subValue && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {subValue}
        </p>
      )}
    </div>
  );
}

export function WorkflowAIAnalytics({ metrics }: WorkflowAIAnalyticsProps) {
  const conversionData = [
    { name: 'Reply Rate', value: metrics.replyRate * 100 },
    { name: 'Booking Rate', value: metrics.bookingRate * 100 },
    { name: 'Deal Won', value: metrics.dealWonRate * 100 }
  ];

  const approvalData = [
    { name: 'Approved', value: metrics.approvalRate * metrics.totalRuns, color: '#10b981' },
    { name: 'Pending', value: (1 - metrics.approvalRate) * metrics.totalRuns * 0.5, color: '#f59e0b' },
    { name: 'Rejected', value: (1 - metrics.approvalRate) * metrics.totalRuns * 0.5, color: '#ef4444' }
  ].filter(d => d.value > 0);

  if (metrics.totalRuns === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bot className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          No AI runs yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          AI metrics will appear once enrollments execute AI actions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Bot}
          label="Total AI Runs"
          value={metrics.totalRuns.toLocaleString()}
          color="text-blue-600 dark:text-blue-400"
        />
        <MetricCard
          icon={Clock}
          label="Avg Latency"
          value={formatLatency(metrics.avgLatencyMs)}
          color="text-amber-600 dark:text-amber-400"
        />
        <MetricCard
          icon={Coins}
          label="Avg Tokens"
          value={metrics.avgTokensUsed.toLocaleString()}
          subValue="per run"
          color="text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard
          icon={CheckCircle}
          label="Approval Rate"
          value={`${(metrics.approvalRate * 100).toFixed(1)}%`}
          color="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Conversion Outcomes
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conversionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs">Replies</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {(metrics.replyRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs">Bookings</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {(metrics.bookingRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs">Deals Won</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {(metrics.dealWonRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Approval Distribution
          </h3>
          <div className="h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={approvalData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {approvalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => Math.round(value)}
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 mt-4">
            {approvalData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {metrics.rejectionReasons.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Rejection Reasons
          </h3>
          <div className="space-y-3">
            {metrics.rejectionReasons.map((reason, index) => {
              const totalRejections = metrics.rejectionReasons.reduce((sum, r) => sum + r.count, 0);
              const percentage = totalRejections > 0 ? (reason.count / totalRejections) * 100 : 0;

              return (
                <div key={index} className="flex items-center gap-4">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">
                      {reason.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-8 text-right">
                      {reason.count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-300">
              Performance Insights
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              {metrics.replyRate > 0.3
                ? 'AI responses are generating good engagement. Consider A/B testing different tones to improve further.'
                : metrics.replyRate > 0.1
                ? 'Reply rates are moderate. Review AI prompts and ensure they are personalized to the contact context.'
                : 'Reply rates are low. Consider reviewing AI output quality and timing of messages.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
