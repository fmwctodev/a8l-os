import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { ReportComposeChart } from '../../types/aiReports';

const COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
  '#ec4899', '#84cc16', '#f97316', '#6366f1', '#14b8a6',
];

interface AIReportChartProps {
  chart: ReportComposeChart;
}

function formatTickValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  }
  const str = String(value);
  return str.length > 16 ? str.slice(0, 14) + '...' : str;
}

function getSeriesKeys(data: Array<Record<string, unknown>>): string[] {
  if (!data || data.length === 0) return [];
  const allKeys = new Set<string>();
  data.forEach((row) => Object.keys(row).forEach((k) => allKeys.add(k)));
  return Array.from(allKeys).filter((k) => {
    const sample = data.find((d) => d[k] != null);
    return sample && typeof sample[k] === 'number';
  });
}

function getXKey(data: Array<Record<string, unknown>>): string {
  if (!data || data.length === 0) return 'name';
  const keys = Object.keys(data[0]);
  const nonNumeric = keys.find((k) => typeof data[0][k] !== 'number');
  return nonNumeric || keys[0] || 'name';
}

export function AIReportChart({ chart }: AIReportChartProps) {
  const { data, type, title } = chart;

  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          No data available for this chart
        </div>
      </div>
    );
  }

  const xKey = getXKey(data);
  const seriesKeys = getSeriesKeys(data).filter((k) => k !== xKey);

  if (seriesKeys.length === 0) {
    return (
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          No numeric data for chart rendering
        </div>
      </div>
    );
  }

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      fontSize: '12px',
      color: '#e2e8f0',
    },
    labelStyle: { color: '#94a3b8' },
  };

  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-6">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={320}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-35} textAnchor="end" tickFormatter={formatTickValue} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatTickValue} />
            <Tooltip {...tooltipStyle} />
            {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }} />}
            {seriesKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-35} textAnchor="end" tickFormatter={formatTickValue} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatTickValue} />
            <Tooltip {...tooltipStyle} />
            {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }} />}
            {seriesKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        ) : type === 'area' ? (
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-35} textAnchor="end" tickFormatter={formatTickValue} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatTickValue} />
            <Tooltip {...tooltipStyle} />
            {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }} />}
            {seriesKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
            ))}
          </AreaChart>
        ) : (
          <PieChart>
            <Pie
              data={data.slice(0, 10)}
              dataKey={seriesKeys[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={110}
              label={({ name, percent }: { name: string; percent: number }) =>
                `${formatTickValue(name)} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={{ stroke: '#475569' }}
            >
              {data.slice(0, 10).map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

interface AIReportChartGridProps {
  charts: ReportComposeChart[];
}

export function AIReportChartGrid({ charts }: AIReportChartGridProps) {
  if (!charts || charts.length === 0) return null;

  return (
    <div className={`grid gap-6 ${charts.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
      {charts.map((chart) => (
        <AIReportChart key={chart.chart_id} chart={chart} />
      ))}
    </div>
  );
}
