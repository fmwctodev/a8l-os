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
  Eye,
  Users,
  Building2,
  Lock,
  Filter,
  Sparkles,
  Send,
  ChevronDown,
  Clock,
  Zap,
  TrendingUp,
  FileText,
  X,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getReports, getReportStats, deleteReport, duplicateReport } from '../../services/reports';
import { askQuestion, exampleQueries, defaultTimeRange, defaultDataScope } from '../../services/aiReporting';
import { QuickExportButton } from '../../components/reporting/ExportButton';
import type {
  Report,
  ReportFilters,
  ReportStats,
  ReportDataSource,
  ReportVisibility,
  AIQueryDataScope,
  ReportTimeRange,
  AIQueryResponse,
} from '../../types';
import { getDataSourceLabel, dataSourceConfigs, timeRangePresets } from '../../config/reportingFields';
import { PermissionGate } from '../../components/PermissionGate';

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

  const [aiQuery, setAiQuery] = useState('');
  const [aiDataScope, setAiDataScope] = useState<AIQueryDataScope>(defaultDataScope);
  const [aiTimeRange, setAiTimeRange] = useState<ReportTimeRange>(defaultTimeRange);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIQueryResponse | null>(null);
  const [showAiResponse, setShowAiResponse] = useState(false);

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

  const handleAiQuery = async () => {
    if (!aiQuery.trim() || !user) return;

    setIsAiLoading(true);
    setShowAiResponse(true);

    try {
      const response = await askQuestion(user.organization_id, user.id, {
        query_text: aiQuery,
        data_scope: aiDataScope,
        time_range: aiTimeRange,
      });
      setAiResponse(response);
    } catch (err) {
      console.error('AI query failed:', err);
      setAiResponse({
        success: false,
        query_id: '',
        answer: '',
        data_sources_used: [],
        execution_time_ms: 0,
        tokens_used: 0,
        error: err instanceof Error ? err.message : 'Failed to process your question',
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setAiQuery(example);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const userRole = user?.role?.name || '';
  const canAccessDepartment = ['Super Admin', 'Admin', 'Manager'].includes(userRole);
  const canAccessOrganization = ['Super Admin', 'Admin'].includes(userRole);

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Reporting</h1>
            <p className="text-slate-400 mt-1">Analyze performance across your system</p>
          </div>
          <div className="flex items-center gap-3">
            <PermissionGate permission="reporting.ai.query">
              <button
                onClick={() => navigate('/reporting/ai')}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-slate-700 transition-colors font-medium"
              >
                <Sparkles className="w-5 h-5" />
                Ask AI
              </button>
            </PermissionGate>
            <button
              onClick={() => navigate('/reporting/new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg hover:from-cyan-600 hover:to-teal-600 transition-all font-medium shadow-lg shadow-cyan-500/25"
            >
              <Plus className="w-5 h-5" />
              Create Report
            </button>
          </div>
        </div>

        <PermissionGate permission="reporting.ai.query">
          <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Quick Question</h2>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAiQuery()}
                  placeholder="Ask anything about your data... e.g., 'How many leads did we get this month?'"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div className="relative">
                <select
                  value={aiDataScope}
                  onChange={(e) => setAiDataScope(e.target.value as AIQueryDataScope)}
                  className="appearance-none h-full px-4 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                >
                  <option value="my_data">My Data</option>
                  {canAccessDepartment && <option value="department">My Department</option>}
                  {canAccessOrganization && <option value="organization">All Organization</option>}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={aiTimeRange.preset || 'last_30_days'}
                  onChange={(e) => setAiTimeRange({ type: 'preset', preset: e.target.value })}
                  className="appearance-none h-full px-4 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                >
                  {timeRangePresets.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              <button
                onClick={handleAiQuery}
                disabled={!aiQuery.trim() || isAiLoading}
                className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg hover:from-cyan-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAiLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {exampleQueries.slice(0, 4).map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example)}
                  className="px-3 py-1.5 bg-slate-700/50 text-slate-300 text-sm rounded-full hover:bg-slate-600 hover:text-white transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>

            {showAiResponse && (
              <div className="mt-6 bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-medium text-white">AI Response</span>
                  </div>
                  <button
                    onClick={() => setShowAiResponse(false)}
                    className="p-1 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4">
                  {isAiLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                      <span className="ml-3 text-slate-400">Analyzing your data...</span>
                    </div>
                  ) : aiResponse?.error ? (
                    <div className="text-red-400 py-4">{aiResponse.error}</div>
                  ) : aiResponse ? (
                    <div className="space-y-4">
                      <p className="text-lg text-white leading-relaxed">{aiResponse.answer}</p>

                      {aiResponse.explanation && (
                        <div className="text-sm text-slate-400 bg-slate-800/50 rounded-lg p-3">
                          <span className="font-medium text-slate-300">How we calculated this: </span>
                          {aiResponse.explanation}
                        </div>
                      )}

                      {aiResponse.data_sources_used.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span>Data from:</span>
                          {aiResponse.data_sources_used.map((source) => (
                            <span
                              key={source}
                              className="px-2 py-0.5 bg-slate-700 rounded text-slate-300"
                            >
                              {getDataSourceLabel(source)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-4 pt-2 border-t border-slate-700">
                        <button
                          onClick={() => navigate('/reporting/ai')}
                          className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          Ask follow-up
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-slate-500">
                          {aiResponse.execution_time_ms}ms | {aiResponse.tokens_used} tokens
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </PermissionGate>

        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Total Reports</div>
                  <div className="text-2xl font-bold text-white">{stats.totalReports}</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Scheduled</div>
                  <div className="text-2xl font-bold text-white">{stats.scheduledReports}</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Exports This Month</div>
                  <div className="text-2xl font-bold text-white">{stats.exportsThisMonth}</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Last Run</div>
                  <div className="text-2xl font-bold text-white">
                    {stats.lastRunDate ? formatDate(stats.lastRunDate) : '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reports..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                  showFilters || Object.keys(filters).length > 0
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {Object.keys(filters).length > 0 && (
                  <span className="bg-cyan-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {Object.keys(filters).length}
                  </span>
                )}
              </button>
            </div>

            {showFilters && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-700">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Data Source</label>
                  <select
                    value={filters.dataSource || ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        dataSource: (e.target.value as ReportDataSource) || undefined,
                      })
                    }
                    className="text-sm bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">All Sources</option>
                    {Object.entries(dataSourceConfigs).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Visibility</label>
                  <select
                    value={filters.visibility || ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        visibility: (e.target.value as ReportVisibility) || undefined,
                      })
                    }
                    className="text-sm bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
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
                    className="text-sm text-cyan-400 hover:text-cyan-300 mt-5"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            </div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No reports yet</h3>
              <p className="text-slate-400 mb-4">Create your first custom report to get started</p>
              <button
                onClick={() => navigate('/reporting/new')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg hover:from-cyan-600 hover:to-teal-600"
              >
                <Plus className="w-4 h-4" />
                Create Report
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Report
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Data Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Visibility
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/reporting/${report.id}`)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center text-cyan-400">
                          {visualizationIcons[report.visualization_type]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{report.name}</span>
                            {report.report_type === 'ai_generated' && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs">
                                <Sparkles className="w-3 h-3" />
                                AI
                              </span>
                            )}
                          </div>
                          {report.description && (
                            <div className="text-sm text-slate-400 truncate max-w-xs">
                              {report.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-300">
                      {getDataSourceLabel(report.data_source)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 text-slate-300 rounded-full text-xs font-medium capitalize">
                        {visualizationIcons[report.visualization_type]}
                        {report.visualization_type}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                        {visibilityIcons[report.visibility]}
                        {visibilityLabels[report.visibility]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-400">
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
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuId === report.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 w-48 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 z-20">
                                <button
                                  onClick={() => navigate(`/reporting/${report.id}`)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600"
                                >
                                  <Eye className="w-4 h-4" />
                                  View Report
                                </button>
                                <button
                                  onClick={() => navigate(`/reporting/${report.id}/edit`)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600"
                                >
                                  <BarChart3 className="w-4 h-4" />
                                  Edit Report
                                </button>
                                <button
                                  onClick={() => handleDuplicate(report)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600"
                                >
                                  <Copy className="w-4 h-4" />
                                  Duplicate
                                </button>
                                {report.created_by === user?.id && (
                                  <>
                                    <div className="border-t border-slate-600 my-1" />
                                    <button
                                      onClick={() => handleDelete(report)}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
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
    </div>
  );
}
