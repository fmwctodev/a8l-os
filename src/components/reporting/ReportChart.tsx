import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ReportQueryResult, ReportVisualizationType } from '../../types';

interface ReportChartProps {
  data: ReportQueryResult;
  visualizationType: ReportVisualizationType;
}

const CHART_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
];

function formatValue(value: unknown, format?: string): string {
  if (value === null || value === undefined) return '-';
  const numValue = Number(value);

  if (format === 'percentage') return `${(numValue * 100).toFixed(1)}%`;
  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
  }
  return numValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatAxisLabel(value: unknown, dataType: string): string {
  if (value === null || value === undefined) return '-';

  if (dataType === 'date' || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
    return new Date(String(value)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  const strValue = String(value);
  return strValue.length > 15 ? strValue.substring(0, 15) + '...' : strValue;
}

export function ReportChart({ data, visualizationType }: ReportChartProps) {
  if (data.rows.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center border border-slate-200 rounded-lg bg-slate-50">
        <div className="text-center">
          <div className="text-slate-400 text-sm">No data to visualize</div>
          <div className="text-slate-300 text-xs mt-1">Try adjusting your filters or time range</div>
        </div>
      </div>
    );
  }

  const dimensions = data.columns.filter((c) => c.type === 'dimension');
  const metrics = data.columns.filter((c) => c.type === 'metric');

  if (dimensions.length === 0 || metrics.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center border border-slate-200 rounded-lg bg-slate-50">
        <div className="text-center">
          <div className="text-slate-400 text-sm">Cannot render chart</div>
          <div className="text-slate-300 text-xs mt-1">
            Select at least one dimension and one metric
          </div>
        </div>
      </div>
    );
  }

  const primaryDimension = dimensions[0];
  const chartData = data.rows.map((row) => ({
    ...row,
    name: formatAxisLabel(row[primaryDimension.key], primaryDimension.dataType),
  }));

  if (visualizationType === 'bar') {
    return (
      <div className="h-96 border border-slate-200 rounded-lg p-4 bg-white">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#64748b' }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value: number, name: string) => {
                const metric = metrics.find((m) => m.key === name);
                return [formatValue(value, metric?.format), metric?.label || name];
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            {metrics.map((metric, index) => (
              <Bar
                key={metric.key}
                dataKey={metric.key}
                name={metric.label}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (visualizationType === 'line') {
    return (
      <div className="h-96 border border-slate-200 rounded-lg p-4 bg-white">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#64748b' }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value: number, name: string) => {
                const metric = metrics.find((m) => m.key === name);
                return [formatValue(value, metric?.format), metric?.label || name];
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            {metrics.map((metric, index) => (
              <Line
                key={metric.key}
                type="monotone"
                dataKey={metric.key}
                name={metric.label}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (visualizationType === 'pie') {
    const primaryMetric = metrics[0];
    const pieData = chartData.slice(0, 10).map((row, index) => ({
      name: row.name,
      value: Number(row[primaryMetric.key]) || 0,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));

    const total = pieData.reduce((sum, item) => sum + item.value, 0);

    return (
      <div className="h-96 border border-slate-200 rounded-lg p-4 bg-white">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              outerRadius={120}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value: number) => [
                `${formatValue(value, primaryMetric.format)} (${((value / total) * 100).toFixed(1)}%)`,
                primaryMetric.label,
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
