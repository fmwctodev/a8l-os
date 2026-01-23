import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  RefreshCw,
  Clock,
  Calendar,
  Loader2,
  LayoutGrid,
  BarChart3,
  LineChart,
  PieChart,
  ChevronDown,
  History,
  Users,
  Building2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getReportById, createReportRun, updateReportRun } from '../../services/reports';
import { getSchedulesByReportId } from '../../services/reportSchedules';
import { getReportPreview } from '../../services/reportEngine';
import { ReportTable } from '../../components/reporting/ReportTable';
import { ReportChart } from '../../components/reporting/ReportChart';
import { ExportButton } from '../../components/reporting/ExportButton';
import { ScheduleModal } from '../../components/reporting/ScheduleModal';
import { getDataSourceLabel } from '../../config/reportingFields';
import type { Report, ReportQueryResult, ReportSchedule, ReportSorting, ReportVisibility } from '../../types';

const visualizationIcons: Record<string, React.ReactNode> = {
  table: <LayoutGrid className="w-5 h-5" />,
  bar: <BarChart3 className="w-5 h-5" />,
  line: <LineChart className="w-5 h-5" />,
  pie: <PieChart className="w-5 h-5" />,
};

const visibilityIcons: Record<ReportVisibility, React.ReactNode> = {
  private: <Lock className="w-4 h-4" />,
  department: <Users className="w-4 h-4" />,
  organization: <Building2 className="w-4 h-4" />,
};

const visibilityLabels: Record<ReportVisibility, string> = {
  private: 'Private',
  department: 'Department',
  organization: 'Organization',
};

export function ReportView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const [report, setReport] = useState<Report | null>(null);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<ReportQueryResult | null>(null);
  const [sorting, setSorting] = useState<ReportSorting[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ReportSchedule | null>(null);

  useEffect(() => {
    if (id && user?.organization_id) {
      loadReport();
    }
  }, [id, user?.organization_id]);

  const loadReport = async () => {
    try {
      setIsLoading(true);
      const [reportData, schedulesData] = await Promise.all([
        getReportById(id!),
        getSchedulesByReportId(id!),
      ]);

      if (reportData) {
        setReport(reportData);
        setSchedules(schedulesData);
        setSorting(reportData.config.sorting);
        await runReport(reportData);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const runReport = async (reportToRun: Report) => {
    try {
      setIsRefreshing(true);

      const result = await getReportPreview(
        reportToRun.organization_id,
        reportToRun.data_source,
        { ...reportToRun.config, sorting }
      );

      setData(result);
    } catch (err) {
      console.error('Failed to run report:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (report) {
      runReport(report);
    }
  };

  const handleScheduleSave = (schedule: ReportSchedule) => {
    if (editingSchedule) {
      setSchedules(schedules.map((s) => (s.id === schedule.id ? schedule : s)));
    } else {
      setSchedules([...schedules, schedule]);
    }
    setEditingSchedule(null);
  };

  const handleScheduleDelete = () => {
    if (editingSchedule) {
      setSchedules(schedules.filter((s) => s.id !== editingSchedule.id));
      setEditingSchedule(null);
    }
  };

  const formatTimeRange = () => {
    if (!report) return '';
    const { timeRange } = report.config;
    if (timeRange.type === 'custom') {
      return `${timeRange.customStart} to ${timeRange.customEnd}`;
    }
    return timeRange.preset?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'All Time';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Report Not Found</h2>
          <button
            onClick={() => navigate('/reporting')}
            className="text-sky-600 hover:text-sky-700"
          >
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/reporting')}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600">
                {visualizationIcons[report.visualization_type]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{report.name}</h1>
                {report.description && (
                  <p className="text-sm text-slate-500">{report.description}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <ExportButton report={report} />

            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              <Clock className="w-4 h-4" />
              Schedule
            </button>

            {report.created_by === user?.id && (
              <button
                onClick={() => navigate(`/reporting/${report.id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="w-4 h-4" />
            {formatTimeRange()}
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            {visibilityIcons[report.visibility]}
            {visibilityLabels[report.visibility]}
          </div>
          <div className="text-slate-500">
            Source: {getDataSourceLabel(report.data_source)}
          </div>
          {data && (
            <div className="text-slate-500">
              {data.totalRows.toLocaleString()} rows
            </div>
          )}
        </div>

        {report.config.filters.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              {report.config.filters.length} filter{report.config.filters.length !== 1 ? 's' : ''} applied
            </button>
            {showFilters && (
              <div className="mt-2 flex flex-wrap gap-2">
                {report.config.filters.map((filter) => (
                  <span
                    key={filter.id}
                    className="px-3 py-1 bg-slate-100 rounded-full text-sm text-slate-600"
                  >
                    {filter.field} {filter.operator} {String(filter.value)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {schedules.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">
              {schedules.filter((s) => s.enabled).length} active schedule{schedules.filter((s) => s.enabled).length !== 1 ? 's' : ''}
            </span>
            {schedules.map((schedule) => (
              <button
                key={schedule.id}
                onClick={() => {
                  setEditingSchedule(schedule);
                  setShowScheduleModal(true);
                }}
                className={`text-xs px-2 py-1 rounded-full ${
                  schedule.enabled
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {schedule.cadence}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
        {isRefreshing ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-500">Running query...</p>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {report.visualization_type === 'table' ? (
              <ReportTable
                data={data}
                sorting={sorting}
                onSortChange={(newSorting) => {
                  setSorting(newSorting);
                }}
              />
            ) : (
              <ReportChart
                data={data}
                visualizationType={report.visualization_type}
              />
            )}
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center text-slate-500">No data available</div>
          </div>
        )}
      </div>

      {showScheduleModal && (
        <ScheduleModal
          isOpen={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false);
            setEditingSchedule(null);
          }}
          reportId={report.id}
          reportName={report.name}
          organizationId={report.organization_id}
          existingSchedule={editingSchedule}
          onSave={handleScheduleSave}
          onDelete={handleScheduleDelete}
        />
      )}
    </div>
  );
}
