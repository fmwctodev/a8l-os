import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  LayoutGrid,
  BarChart3,
  LineChart,
  PieChart,
  MoreVertical,
  Copy,
  Trash2,
  Clock,
  Eye,
  Users,
  Building2,
  Lock,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getReports, getReportStats, deleteReport, duplicateReport } from '../../services/reports';
import { QuickExportButton } from '../../components/reporting/ExportButton';
import type { Report, ReportFilters, ReportStats, ReportDataSource, ReportVisibility } from '../../types';
import { getDataSourceLabel } from '../../config/reportingFields';

const visualizationIcons: Record<string, React.ReactNode> = {
  table: <LayoutGrid className="w-4 h-4" />,
  bar: <BarChart3 className="w-4 h-4" />,
  line: <LineChart className="w-4 h-4" />,
  pie: <PieChart className="w-4 h-4" />,
};

const visibilityIcons: Record<ReportVisibility, React.ReactNode> = {
  private: <Lock className="w-3.5 h-3.5" />,
  department: <Users className="w-3.5 h-3.5" />,
  organization: <Building2 className="w-3.5 h-3.5" />,
};

const visibilityLabels: Record<ReportVisibility, string> = {
  private: 'Private',
  department: 'Department',
  organization: 'Organization',
};

export function Reporting() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ReportFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.organization_id) {
      loadData();
    }
  }, [user?.organization_id, filters]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [reportsData, statsData] = await Promise.all([
        getReports(user!.organization_id, { ...filters, search: searchQuery || undefined }),
        getReportStats(user!.organization_id),
      ]);
      setReports(reportsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (user?.organization_id) {
        loadData();
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleDelete = async (report: Report) => {
    if (!confirm(`Delete "${report.name}"? This action cannot be undone.`)) return;

    try {
      await deleteReport(report.id);
      setReports(reports.filter((r) => r.id !== report.id));
      setOpenMenuId(null);
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  const handleDuplicate = async (report: Report) => {
    try {
      const newReport = await duplicateReport(report.id, user!.id, `${report.name} (Copy)`);
      setReports([newReport, ...reports]);
      setOpenMenuId(null);
    } catch (err) {
      console.error('Failed to duplicate report:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 mt-1">Build custom reports with charts and scheduled exports</p>
        </div>
        <button
          onClick={() => navigate('/reporting/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          New Report
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total Reports</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.totalReports}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Scheduled</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.scheduledReports}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Exports This Month</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.exportsThisMonth}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Last Run</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {stats.lastRunDate ? formatDate(stats.lastRunDate) : '-'}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showFilters || Object.keys(filters).length > 0
                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {Object.keys(filters).length > 0 && (
                <span className="bg-sky-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {Object.keys(filters).length}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Data Source</label>
                <select
                  value={filters.dataSource || ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      dataSource: (e.target.value as ReportDataSource) || undefined,
                    })
                  }
                  className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
                >
                  <option value="">All Sources</option>
                  <option value="contacts">Contacts</option>
                  <option value="conversations">Conversations</option>
                  <option value="appointments">Appointments</option>
                  <option value="forms">Forms</option>
                  <option value="surveys">Surveys</option>
                  <option value="workflows">Workflows</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Visibility</label>
                <select
                  value={filters.visibility || ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      visibility: (e.target.value as ReportVisibility) || undefined,
                    })
                  }
                  className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
                >
                  <option value="">All</option>
                  <option value="private">Private</option>
                  <option value="department">Department</option>
                  <option value="organization">Organization</option>
                </select>
              </div>

              {Object.keys(filters).length > 0 && (
                <button
                  onClick={() => setFilters({})}
                  className="text-sm text-sky-600 hover:text-sky-700 mt-4"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">No reports yet</h3>
            <p className="text-slate-500 mb-4">Create your first custom report to get started</p>
            <button
              onClick={() => navigate('/reporting/new')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600"
            >
              <Plus className="w-4 h-4" />
              Create Report
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Report
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Data Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Visibility
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/reporting/${report.id}`)}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600">
                        {visualizationIcons[report.visualization_type]}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{report.name}</div>
                        {report.description && (
                          <div className="text-sm text-slate-500 truncate max-w-xs">
                            {report.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">
                    {getDataSourceLabel(report.data_source)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium capitalize">
                      {visualizationIcons[report.visualization_type]}
                      {report.visualization_type}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                      {visibilityIcons[report.visibility]}
                      {visibilityLabels[report.visibility]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500">
                    {formatDate(report.updated_at)}
                  </td>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <QuickExportButton
                        organizationId={report.organization_id}
                        reportId={report.id}
                        size="sm"
                      />

                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === report.id ? null : report.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuId === report.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                              <button
                                onClick={() => navigate(`/reporting/${report.id}`)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Eye className="w-4 h-4" />
                                View Report
                              </button>
                              <button
                                onClick={() => navigate(`/reporting/${report.id}/edit`)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <BarChart3 className="w-4 h-4" />
                                Edit Report
                              </button>
                              <button
                                onClick={() => handleDuplicate(report)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Copy className="w-4 h-4" />
                                Duplicate
                              </button>
                              {report.created_by === user?.id && (
                                <>
                                  <div className="border-t border-slate-100 my-1" />
                                  <button
                                    onClick={() => handleDelete(report)}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
