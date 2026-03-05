import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Send,
  ChevronDown,
  Clock,
  FileText,
  TrendingUp,
  Loader2,
  MoreVertical,
  Eye,
  Copy,
  Trash2,
  Calendar as CalendarIcon,
  Filter,
  Download,
  X,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  generateReport,
  getAIReports,
  getAIReportStats,
  deleteReport,
  duplicateReport,
  pollReportStatus,
  getReportCategoryLabel,
  getScopeLabel,
  SUGGESTED_PROMPTS,
  TIMEFRAME_OPTIONS,
  SCOPE_OPTIONS,
} from '../../services/aiReports';
import type {
  AIReport,
  AIReportFilters,
  AIReportStats,
  ReportScope,
  ReportCategory,
} from '../../types/aiReports';
import { PermissionGate } from '../../components/PermissionGate';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  complete: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Complete' },
  running: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'Running' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Failed' },
};

const CATEGORY_FILTERS: { value: ReportCategory | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'ops', label: 'Operations' },
  { value: 'reputation', label: 'Reputation' },
  { value: 'finance', label: 'Finance' },
  { value: 'projects', label: 'Projects' },
  { value: 'custom', label: 'Custom' },
];

export function Reporting() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [reports, setReports] = useState<AIReport[]>([]);
  const [stats, setStats] = useState<AIReportStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<AIReportFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState<ReportScope>('my');
  const [timeframe, setTimeframe] = useState('last_30_days');
  const [isGenerating, setIsGenerating] = useState(false);

  const userRole = user?.role?.name || '';
  const availableScopes = SCOPE_OPTIONS.filter(
    (opt) =>
      !opt.minRole ||
      (opt.minRole === 'Manager' && ['Super Admin', 'Admin', 'Manager'].includes(userRole)) ||
      (opt.minRole === 'Admin' && ['Super Admin', 'Admin'].includes(userRole))
  );

  const loadData = useCallback(async () => {
    if (!user?.organization_id) return;
    try {
      setIsLoading(true);
      const [reportsData, statsData] = await Promise.all([
        getAIReports(user.organization_id, { ...filters, search: searchQuery || undefined }),
        getAIReportStats(user.organization_id),
      ]);
      setReports(reportsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organization_id, filters, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    if (!prompt.trim() || !user || isGenerating) return;

    setIsGenerating(true);
    try {
      const result = await generateReport(user.organization_id, user.id, {
        prompt: prompt.trim(),
        scope,
        timeframe: { type: 'preset', preset: timeframe },
      });

      if (!result.success) {
        showToast('warning', 'Generation failed', result.error || 'Could not generate report');
        return;
      }

      showToast('info', 'Report generating', 'Your report is being prepared...');
      setPrompt('');

      const completed = await pollReportStatus(result.report_id);
      if (completed.status === 'complete') {
        showToast('success', 'Report ready', completed.report_name);
        navigate(`/reporting/${completed.id}`);
      } else {
        showToast('warning', 'Generation failed', completed.error_message || 'Report generation encountered an error');
        loadData();
      }
    } catch (err) {
      showToast('warning', 'Error', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (report: AIReport) => {
    if (!confirm(`Delete "${report.report_name}"? This cannot be undone.`)) return;
    try {
      await deleteReport(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      setOpenMenuId(null);
      showToast('success', 'Report deleted');
    } catch {
      showToast('warning', 'Failed to delete report');
    }
  };

  const handleDuplicate = async (report: AIReport) => {
    if (!user) return;
    try {
      const dup = await duplicateReport(report.id, user.id);
      setReports((prev) => [dup, ...prev]);
      setOpenMenuId(null);
      showToast('success', 'Report duplicated');
    } catch {
      showToast('warning', 'Failed to duplicate report');
    }
  };

  const handleExportCSV = (report: AIReport) => {
    if (!report.csv_data) {
      showToast('info', 'No CSV data available for this report');
      return;
    }
    const blob = new Blob([report.csv_data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.report_name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = (report: AIReport) => {
    if (!report.rendered_html) {
      showToast('info', 'No PDF data available for this report');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(report.rendered_html);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

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
                Full Chat
              </button>
            </PermissionGate>
          </div>
        </div>

        <PermissionGate permission="reporting.ai.query">
          <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Generate Report</h2>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleGenerate()}
                  placeholder="Describe the report you need... e.g., 'Sales performance breakdown by rep this quarter'"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>

              <div className="relative">
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as ReportScope)}
                  disabled={isGenerating}
                  className="appearance-none h-full px-4 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                >
                  {availableScopes.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  disabled={isGenerating}
                  className="appearance-none h-full px-4 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                >
                  {TIMEFRAME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg hover:from-cyan-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {SUGGESTED_PROMPTS.slice(0, 5).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(suggestion)}
                  disabled={isGenerating}
                  className="px-3 py-1.5 bg-slate-700/50 text-slate-300 text-sm rounded-full hover:bg-slate-600 hover:text-white transition-colors disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {isGenerating && (
              <div className="mt-6 bg-slate-900/50 rounded-lg border border-cyan-500/20 p-6">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                    <Sparkles className="w-4 h-4 text-cyan-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Generating your report...</p>
                    <p className="text-sm text-slate-400">AI is analyzing your data and building the report</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </PermissionGate>

        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={<FileText className="w-5 h-5 text-cyan-400" />}
              iconBg="bg-cyan-500/20"
              label="Total Reports"
              value={stats.totalReports}
            />
            <StatCard
              icon={<Loader2 className="w-5 h-5 text-amber-400" />}
              iconBg="bg-amber-500/20"
              label="Running"
              value={stats.runningReports}
            />
            <StatCard
              icon={<Clock className="w-5 h-5 text-teal-400" />}
              iconBg="bg-teal-500/20"
              label="Scheduled"
              value={stats.scheduledReports}
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
              iconBg="bg-emerald-500/20"
              label="Last Generated"
              value={stats.lastGeneratedDate ? formatDate(stats.lastGeneratedDate) : '-'}
            />
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
                  showFilters || Object.values(filters).some(Boolean)
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>

            {showFilters && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-700">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Category</label>
                  <select
                    value={filters.category || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, category: (e.target.value as ReportCategory) || undefined })
                    }
                    className="text-sm bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {CATEGORY_FILTERS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Scope</label>
                  <select
                    value={filters.scope || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, scope: (e.target.value as ReportScope) || undefined })
                    }
                    className="text-sm bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">All Scopes</option>
                    <option value="my">My Data</option>
                    <option value="team">Team</option>
                    <option value="org">Organization</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Status</label>
                  <select
                    value={filters.status || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, status: (e.target.value as 'complete' | 'running' | 'failed') || undefined })
                    }
                    className="text-sm bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">All Statuses</option>
                    <option value="complete">Complete</option>
                    <option value="running">Running</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                {Object.values(filters).some(Boolean) && (
                  <button
                    onClick={() => setFilters({})}
                    className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 mt-5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear
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
              <p className="text-slate-400 mb-4">Use the prompt above to generate your first AI report</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Report</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Scope</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Timeframe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {reports.map((report) => {
                  const statusStyle = STATUS_STYLES[report.status] || STATUS_STYLES.failed;
                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/reporting/${report.id}`)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center text-cyan-400">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-medium text-white">{report.report_name}</span>
                            {report.created_by_user && (
                              <div className="text-xs text-slate-500 mt-0.5">{report.created_by_user.name}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 bg-slate-700 text-slate-300 rounded-full text-xs font-medium">
                          {getReportCategoryLabel(report.report_category)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">{getScopeLabel(report.scope)}</td>
                      <td className="px-4 py-4 text-sm text-slate-400">
                        {report.timeframe_start && report.timeframe_end ? (
                          <span className="flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {formatDate(report.timeframe_start)} - {formatDate(report.timeframe_end)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-400">{formatDate(report.created_at)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          {report.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {report.status === 'complete' && report.csv_data && (
                            <button
                              onClick={() => handleExportCSV(report)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                              title="Export CSV"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === report.id ? null : report.id)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {openMenuId === report.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 z-20">
                                  <button onClick={() => navigate(`/reporting/${report.id}`)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600">
                                    <Eye className="w-4 h-4" />View Report
                                  </button>
                                  <button onClick={() => handleDuplicate(report)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600">
                                    <Copy className="w-4 h-4" />Duplicate
                                  </button>
                                  {report.status === 'complete' && report.rendered_html && (
                                    <button onClick={() => handleExportPDF(report)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600">
                                      <Download className="w-4 h-4" />Export PDF
                                    </button>
                                  )}
                                  {report.created_by_user_id === user?.id && (
                                    <>
                                      <div className="border-t border-slate-600 my-1" />
                                      <button onClick={() => handleDelete(report)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10">
                                        <Trash2 className="w-4 h-4" />Delete
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
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, iconBg, label, value }: { icon: React.ReactNode; iconBg: string; label: string; value: number | string }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>{icon}</div>
        <div>
          <div className="text-sm text-slate-400">{label}</div>
          <div className="text-2xl font-bold text-white">{value}</div>
        </div>
      </div>
    </div>
  );
}
