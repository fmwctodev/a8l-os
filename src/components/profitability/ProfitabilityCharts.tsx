import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { BarChart3, Target } from 'lucide-react';
import type { ProjectProfitabilityRow } from '../../types';

interface Props {
  rows: ProjectProfitabilityRow[];
  isLoading: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
};

function ChartSkeleton() {
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 animate-pulse">
      <div className="h-5 w-40 bg-slate-700 rounded mb-6" />
      <div className="h-[280px] bg-slate-800/40 rounded-lg" />
    </div>
  );
}

export function ProfitabilityCharts({ rows, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  const top10Revenue = [...rows]
    .sort((a, b) => Number(b.total_invoiced) - Number(a.total_invoiced))
    .slice(0, 10)
    .map((r) => ({
      name: r.project_name.length > 20 ? r.project_name.slice(0, 18) + '...' : r.project_name,
      revenue: Number(r.total_invoiced),
      costs: Number(r.total_costs),
    }));

  const marginRanking = [...rows]
    .filter((r) => Number(r.total_invoiced) > 0)
    .sort((a, b) => Number(b.margin_percent) - Number(a.margin_percent))
    .slice(0, 12)
    .map((r) => ({
      name: r.project_name.length > 22 ? r.project_name.slice(0, 20) + '...' : r.project_name,
      margin: Number(r.margin_percent),
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
        <h4 className="text-white font-medium flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          Revenue vs Costs (Top 10)
        </h4>
        {top10Revenue.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top10Revenue} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                height={70}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [
                  fmt(value),
                  name === 'revenue' ? 'Revenue' : 'Costs',
                ]}
              />
              <Legend
                wrapperStyle={{ paddingTop: 8 }}
                formatter={(v: string) => (
                  <span className="text-slate-300 text-sm">{v === 'revenue' ? 'Revenue' : 'Costs'}</span>
                )}
              />
              <Bar dataKey="revenue" fill="#06b6d4" radius={[3, 3, 0, 0]} />
              <Bar dataKey="costs" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-slate-500 text-sm">
            No project revenue data available
          </div>
        )}
      </div>

      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
        <h4 className="text-white font-medium flex items-center gap-2 mb-5">
          <Target className="w-5 h-5 text-emerald-400" />
          Margin Ranking
        </h4>
        {marginRanking.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={marginRanking} layout="vertical" barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
                domain={[
                  Math.min(0, ...marginRanking.map((r) => r.margin)),
                  Math.max(100, ...marginRanking.map((r) => r.margin)),
                ]}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                width={140}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`${value}%`, 'Margin']}
              />
              <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
                {marginRanking.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.margin >= 40 ? '#10b981' : entry.margin >= 20 ? '#f59e0b' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-slate-500 text-sm">
            No margin data available
          </div>
        )}
      </div>
    </div>
  );
}
