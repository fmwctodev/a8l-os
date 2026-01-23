import { LayoutGrid, BarChart3, LineChart, PieChart } from 'lucide-react';
import type { ReportVisualizationType } from '../../types';

interface ChartTypeSelectorProps {
  value: ReportVisualizationType;
  onChange: (type: ReportVisualizationType) => void;
  disabled?: boolean;
}

const chartTypes: Array<{
  value: ReportVisualizationType;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: 'table', label: 'Table', icon: <LayoutGrid className="w-5 h-5" /> },
  { value: 'bar', label: 'Bar', icon: <BarChart3 className="w-5 h-5" /> },
  { value: 'line', label: 'Line', icon: <LineChart className="w-5 h-5" /> },
  { value: 'pie', label: 'Pie', icon: <PieChart className="w-5 h-5" /> },
];

export function ChartTypeSelector({ value, onChange, disabled }: ChartTypeSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
      {chartTypes.map((type) => (
        <button
          key={type.value}
          type="button"
          onClick={() => onChange(type.value)}
          disabled={disabled}
          title={type.label}
          className={`flex items-center justify-center p-2 rounded-md transition-all ${
            value === type.value
              ? 'bg-white text-sky-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {type.icon}
        </button>
      ))}
    </div>
  );
}

interface ChartTypeSelectorWithLabelProps extends ChartTypeSelectorProps {
  label?: string;
}

export function ChartTypeSelectorWithLabel({
  value,
  onChange,
  disabled,
  label = 'Visualization',
}: ChartTypeSelectorWithLabelProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        {chartTypes.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            disabled={disabled}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
              value === type.value
                ? 'border-sky-500 bg-sky-50 text-sky-700'
                : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className={value === type.value ? 'text-sky-500' : 'text-slate-400'}>
              {type.icon}
            </span>
            <span className="text-sm font-medium">{type.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
