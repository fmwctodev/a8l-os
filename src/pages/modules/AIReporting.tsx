import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Send,
  ChevronDown,
  ArrowLeft,
  Clock,
  Trash2,
  Save,
  BarChart3,
  Table,
  LineChart,
  PieChart,
  Loader2,
  ChevronRight,
  X,
  Database,
  Info,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  askQuestion,
  getQueryHistory,
  deleteQuery,
  saveQueryAsReport,
  exampleQueries,
  defaultTimeRange,
  defaultDataScope,
} from '../../services/aiReporting';
import { getDataSourceLabel, dataSourceConfigs, timeRangePresets } from '../../config/reportingFields';
import type {
  AIReportQuery,
  AIQueryDataScope,
  ReportTimeRange,
  AIQueryResponse,
  ReportVisibility,
} from '../../types';

interface ConversationMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  queryId?: string;
  response?: AIQueryResponse;
  isLoading?: boolean;
}

const chartIcons: Record<string, React.ReactNode> = {
  table: <Table className="w-4 h-4" />,
  bar: <BarChart3 className="w-4 h-4" />,
  line: <LineChart className="w-4 h-4" />,
  pie: <PieChart className="w-4 h-4" />,
};

export function AIReporting() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [dataScope, setDataScope] = useState<AIQueryDataScope>(defaultDataScope);
  const [timeRange, setTimeRange] = useState<ReportTimeRange>(defaultTimeRange);
  const [isLoading, setIsLoading] = useState(false);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [history, setHistory] = useState<AIReportQuery[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveQueryId, setSaveQueryId] = useState<string | null>(null);
  const [saveReportName, setSaveReportName] = useState('');
  const [saveVisibility, setSaveVisibility] = useState<ReportVisibility>('private');
  const [isSaving, setIsSaving] = useState(false);

  const userRole = user?.role?.name || '';
  const canAccessDepartment = ['Super Admin', 'Admin', 'Manager'].includes(userRole);
  const canAccessOrganization = ['Super Admin', 'Admin'].includes(userRole);

  useEffect(() => {
    if (user?.organization_id) {
      loadHistory();
    }
  }, [user?.organization_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const data = await getQueryHistory(user!.organization_id, user!.id, { limit: 20 });
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSubmit = async () => {
    if (!query.trim() || isLoading || !user) return;

    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: query,
      timestamp: new Date(),
    };

    const loadingMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      type: 'ai',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      const response = await askQuestion(user.organization_id, user.id, {
        query_text: query,
        data_scope: dataScope,
        time_range: timeRange,
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: response.answer,
                isLoading: false,
                queryId: response.query_id,
                response,
              }
            : msg
        )
      );

      loadHistory();
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: err instanceof Error ? err.message : 'Failed to process your question',
                isLoading: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleHistoryClick = (historyItem: AIReportQuery) => {
    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: historyItem.query_text,
      timestamp: new Date(historyItem.created_at),
    };

    const aiMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      type: 'ai',
      content: historyItem.response_text || '',
      timestamp: new Date(historyItem.created_at),
      queryId: historyItem.id,
      response: historyItem.response_data as unknown as AIQueryResponse,
    };

    setMessages([userMessage, aiMessage]);
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteQuery(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleOpenSaveModal = (queryId: string) => {
    setSaveQueryId(queryId);
    setSaveReportName('');
    setSaveVisibility('private');
    setShowSaveModal(true);
  };

  const handleSaveAsReport = async () => {
    if (!saveQueryId || !saveReportName.trim() || !user) return;

    setIsSaving(true);
    try {
      const { reportId } = await saveQueryAsReport(
        saveQueryId,
        user.organization_id,
        user.id,
        saveReportName,
        saveVisibility,
        user.department_id
      );
      setShowSaveModal(false);
      navigate(`/reporting/${reportId}`);
    } catch (err) {
      console.error('Failed to save report:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatHistoryDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <div className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <button
            onClick={() => navigate('/reporting')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </button>
        </div>

        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Recent Queries
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingHistory ? (
            <div className="p-4 text-center">
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin mx-auto" />
            </div>
          ) : history.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No queries yet. Start asking questions!
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleHistoryClick(item)}
                  className="group p-3 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-300 line-clamp-2">{item.query_text}</p>
                    <button
                      onClick={(e) => handleDeleteHistory(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    {formatHistoryDate(item.created_at)}
                    {item.saved_as_report_id && (
                      <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                        Saved
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto pt-12">
              <div className="text-center mb-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-3">AI Data Assistant</h1>
                <p className="text-slate-400 text-lg">
                  Ask questions about your data in plain English
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {exampleQueries.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setQuery(example)}
                    className="p-4 text-left bg-slate-800 border border-slate-700 rounded-xl hover:border-cyan-500/50 hover:bg-slate-700/50 transition-all group"
                  >
                    <p className="text-slate-300 group-hover:text-white transition-colors">
                      {example}
                    </p>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 mt-2 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] ${
                      message.type === 'user'
                        ? 'bg-slate-700 rounded-2xl rounded-br-md'
                        : 'bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-md'
                    } p-4`}
                  >
                    {message.type === 'ai' && (
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-700">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium text-cyan-400">AI Assistant</span>
                        <span className="text-xs text-slate-500">{formatTimestamp(message.timestamp)}</span>
                      </div>
                    )}

                    {message.isLoading ? (
                      <div className="flex items-center gap-3 py-2">
                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                        <span className="text-slate-400">Analyzing your data...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-white leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>

                        {message.type === 'ai' && message.response && (
                          <>
                            {message.response.explanation && (
                              <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                  <Info className="w-3.5 h-3.5" />
                                  How we calculated this
                                </div>
                                <p className="text-sm text-slate-300">
                                  {message.response.explanation}
                                </p>
                              </div>
                            )}

                            {message.response.data_sources_used &&
                              message.response.data_sources_used.length > 0 && (
                                <div className="mt-4 flex items-center gap-2 flex-wrap">
                                  <Database className="w-4 h-4 text-slate-500" />
                                  <span className="text-xs text-slate-500">Data from:</span>
                                  {message.response.data_sources_used.map((source) => (
                                    <span
                                      key={source}
                                      className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300"
                                    >
                                      {getDataSourceLabel(source)}
                                    </span>
                                  ))}
                                </div>
                              )}

                            {message.response.chart_type && message.response.chart_data && (
                              <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                                <div className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                                  {chartIcons[message.response.chart_type]}
                                  <span className="capitalize">
                                    {message.response.chart_type} visualization available
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500">
                                  {message.response.table_rows?.length || 0} rows of data
                                </p>
                              </div>
                            )}

                            <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-3">
                              {message.queryId && (
                                <button
                                  onClick={() => handleOpenSaveModal(message.queryId!)}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors text-sm"
                                >
                                  <Save className="w-4 h-4" />
                                  Save as Report
                                </button>
                              )}
                              <span className="text-xs text-slate-500">
                                {message.response.execution_time_ms}ms |{' '}
                                {message.response.tokens_used} tokens
                              </span>
                            </div>
                          </>
                        )}

                        {message.type === 'user' && (
                          <span className="text-xs text-slate-400 mt-2 block">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-slate-700 bg-slate-800/50 backdrop-blur p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask a question about your data..."
                  rows={1}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={dataScope}
                    onChange={(e) => setDataScope(e.target.value as AIQueryDataScope)}
                    className="appearance-none h-full px-3 pr-8 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                  >
                    <option value="my_data">My Data</option>
                    {canAccessDepartment && <option value="department">Department</option>}
                    {canAccessOrganization && <option value="organization">Organization</option>}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                <div className="relative">
                  <select
                    value={timeRange.preset || 'last_30_days'}
                    onChange={(e) => setTimeRange({ type: 'preset', preset: e.target.value })}
                    className="appearance-none h-full px-3 pr-8 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                  >
                    {timeRangePresets.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!query.trim() || isLoading}
                  className="p-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl hover:from-cyan-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>

      <div className="w-72 bg-slate-800 border-l border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Query Context
        </h3>

        <div className="space-y-4">
          <div className="p-3 bg-slate-900/50 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">Data Scope</div>
            <div className="text-sm text-white">
              {dataScope === 'my_data'
                ? 'My Data Only'
                : dataScope === 'department'
                ? 'My Department'
                : 'Entire Organization'}
            </div>
          </div>

          <div className="p-3 bg-slate-900/50 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">Time Range</div>
            <div className="text-sm text-white">
              {timeRangePresets.find((p) => p.value === timeRange.preset)?.label || 'Last 30 Days'}
            </div>
          </div>

          <div className="p-3 bg-slate-900/50 rounded-lg">
            <div className="text-xs text-slate-500 mb-2">Available Data</div>
            <div className="space-y-1.5">
              {Object.entries(dataSourceConfigs).map(([key, config]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span className="text-slate-300">{config.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Save as Report</h2>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Report Name
                </label>
                <input
                  type="text"
                  value={saveReportName}
                  onChange={(e) => setSaveReportName(e.target.value)}
                  placeholder="My AI Report"
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Visibility
                </label>
                <select
                  value={saveVisibility}
                  onChange={(e) => setSaveVisibility(e.target.value as ReportVisibility)}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="private">Private - Only you can view</option>
                  <option value="department">Department - Team members can view</option>
                  <option value="organization">Organization - Everyone can view</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsReport}
                disabled={!saveReportName.trim() || isSaving}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg hover:from-cyan-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
