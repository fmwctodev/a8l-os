import { Users, MessageSquare, Calendar, FileText, ClipboardList, Workflow } from 'lucide-react';
import type { ReportDataSource } from '../../types';
import { getDataSourceLabel } from '../../config/reportingFields';

interface DataSourceSelectorProps {
  value: ReportDataSource | null;
  onChange: (source: ReportDataSource) => void;
  disabled?: boolean;
}

const dataSourceIcons: Record<ReportDataSource, React.ReactNode> = {
  contacts: <Users className="w-5 h-5" />,
  conversations: <MessageSquare className="w-5 h-5" />,
  appointments: <Calendar className="w-5 h-5" />,
  forms: <FileText className="w-5 h-5" />,
  surveys: <ClipboardList className="w-5 h-5" />,
  workflows: <Workflow className="w-5 h-5" />,
};

const dataSources: ReportDataSource[] = ['contacts', 'conversations', 'appointments', 'forms', 'surveys', 'workflows'];

export function DataSourceSelector({ value, onChange, disabled }: DataSourceSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">Data Source</label>
      <div className="grid grid-cols-2 gap-2">
        {dataSources.map((source) => (
          <button
            key={source}
            type="button"
            onClick={() => onChange(source)}
            disabled={disabled}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
              value === source
                ? 'border-sky-500 bg-sky-50 text-sky-700'
                : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className={value === source ? 'text-sky-500' : 'text-slate-400'}>
              {dataSourceIcons[source]}
            </span>
            <span className="text-sm font-medium">{getDataSourceLabel(source)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
