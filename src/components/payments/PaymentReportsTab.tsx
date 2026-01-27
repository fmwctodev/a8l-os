import { useState, useEffect } from 'react';
import {
  getPaymentAnalyticsSummary,
  getRevenueByPeriod,
  getOutstandingAging,
  getPaymentMethodBreakdown,
  getRecentPayments,
  type PaymentAnalyticsSummary,
  type RevenueByPeriod,
  type OutstandingAging,
  type PaymentMethodBreakdown,
} from '../../services/paymentAnalytics';
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  CreditCard,
  BarChart3,
  PieChart,
  Calendar,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function PaymentReportsTab() {
  const [summary, setSummary] = useState<PaymentAnalyticsSummary | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueByPeriod[]>([]);
  const [agingData, setAgingData] = useState<OutstandingAging[]>([]);
  const [methodData, setMethodData] = useState<PaymentMethodBreakdown[]>([]);
  const [recentPayments, setRecentPayments] = useState<{
    id: string;
    amount: number;
    payment_method: string;
    received_at: string;
    invoice?: { doc_number: string };
    contact?: { first_name: string; last_name: string; company?: string };
  }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  useEffect(() => {
    loadData();
  }, [periodType]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [summaryData, revenue, aging, methods, payments] = await Promise.all([
        getPaymentAnalyticsSummary(),
        getRevenueByPeriod(periodType),
        getOutstandingAging(),
        getPaymentMethodBreakdown(),
        getRecentPayments(5),
      ]);
      setSummary(summaryData);
      setRevenueData(revenue);
      setAgingData(aging);
      setMethodData(methods);
      setRecentPayments(payments);
    } catch (err) {
      console.error('Failed to load payment analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatPeriod = (period: string) => {
    if (periodType === 'monthly') {
      const [year, month] = period.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    return new Date(period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Payment Analytics</h3>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{formatCurrency(summary.totalRevenue)}</p>
                <p className="text-sm text-slate-400">Total Revenue</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{formatCurrency(summary.totalOutstanding)}</p>
                <p className="text-sm text-slate-400">Outstanding</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{formatCurrency(summary.totalOverdue)}</p>
                <p className="text-sm text-slate-400">Overdue</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{summary.collectionRate}%</p>
                <p className="text-sm text-slate-400">Collection Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/30 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Avg Invoice Value</p>
            <p className="text-xl font-semibold text-white mt-1">{formatCurrency(summary.averageInvoiceValue)}</p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Days Sales Outstanding</p>
            <p className="text-xl font-semibold text-white mt-1">{summary.daysOutstanding} days</p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Monthly Recurring</p>
            <p className="text-xl font-semibold text-white mt-1">{formatCurrency(summary.monthlyRecurringRevenue)}</p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Annual Recurring</p>
            <p className="text-xl font-semibold text-white mt-1">{formatCurrency(summary.annualRecurringRevenue)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white font-medium flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Revenue Over Time
            </h4>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as typeof periodType)}
              className="px-3 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="period"
                  tickFormatter={formatPeriod}
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  labelFormatter={formatPeriod}
                />
                <Bar dataKey="revenue" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500">
              No revenue data available
            </div>
          )}
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <h4 className="text-white font-medium flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-400" />
            Receivables Aging
          </h4>
          {agingData.some(d => d.amount > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={agingData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="bucket"
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Amount']}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {agingData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500">
              No outstanding invoices
            </div>
          )}
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <h4 className="text-white font-medium flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-emerald-400" />
            Payment Methods
          </h4>
          {methodData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <RechartsPie>
                  <Pie
                    data={methodData}
                    dataKey="amount"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {methodData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {methodData.map((method, index) => (
                  <div key={method.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-slate-300 text-sm">{method.method}</span>
                    </div>
                    <span className="text-white text-sm font-medium">{method.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-500">
              No payment data available
            </div>
          )}
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <h4 className="text-white font-medium flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-teal-400" />
            Recent Payments
          </h4>
          {recentPayments.length > 0 ? (
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                >
                  <div>
                    <p className="text-white font-medium">
                      {payment.contact?.company ||
                        `${payment.contact?.first_name || ''} ${payment.contact?.last_name || ''}`.trim() ||
                        'Unknown'}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {payment.invoice?.doc_number || 'No invoice'} - {formatDate(payment.received_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-slate-500 text-xs capitalize">{payment.payment_method.replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-500">
              No recent payments
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
