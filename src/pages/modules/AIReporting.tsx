import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Send,
  ChevronDown,
  ArrowLeft,
  Clock,
  Loader2,
  ChevronRight,
  FileText,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  generateReport,
  getAIReports,
  pollReportStatus,
  SUGGESTED_PROMPTS,
  TIMEFRAME_OPTIONS,
  SCOPE_OPTIONS,
} from '../../services/aiReports';
import type { AIReport, ReportScope, ChatMessage } from '../../types/aiReports';

export function AIReporting() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState<ReportScope>('my');
  const [timeframe, setTimeframe] = useState('last_30_days');
  const [isGenerating, setIsGenerating] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentReports, setRecentReports] = useState<AIReport[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [parentReportId, setParentReportId] = useState<string | null>(null);

  const userRole = user?.role?.name || '';
  const availableScopes = SCOPE_OPTIONS.filter(
    (opt) =>
      !opt.minRole ||
      (opt.minRole === 'Manager' && ['Super Admin', 'Admin', 'Manager'].includes(userRole)) ||
      (opt.minRole === 'Admin' && ['Super Admin', 'Admin'].includes(userRole))
  );

  useEffect(() => {
    if (user?.organization_id) loadRecentReports();
  }, [user?.organization_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadRecentReports = async () => {
    try {
      setIsLoadingHistory(true);
      const data = await getAIReports(user!.organization_id, { status: 'complete' });
      setRecentReports(data.slice(0, 20));
    } catch {
      // ignore
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || isGenerating || !user) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: prompt.trim(),
      timestamp: new Date(),
    };

    const loadingMsg: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'ai',
      content: 'Generating your report...',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    const currentPrompt = prompt.trim();
    setPrompt('');
    setIsGenerating(true);

    try {
      const result = await generateReport(user.organization_id, user.id, {
        prompt: currentPrompt,
        scope,
        timeframe: { type: 'preset', preset: timeframe },
        parent_report_id: parentReportId || undefined,
      });

      if (!result.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMsg.id
              ? { ...m, content: result.error || 'Report generation failed', isLoading: false, type: 'system' as const }
              : m
          )
        );
        return;
      }

      const completed = await pollReportStatus(result.report_id);

      if (completed.status === 'complete') {
        setParentReportId(completed.id);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMsg.id
              ? {
                  ...m,
                  content: completed.result_json?.executive_summary || 'Report generated successfully.',
                  isLoading: false,
                  reportId: completed.id,
                  report: completed,
                }
              : m
          )
        );
        loadRecentReports();
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMsg.id
              ? { ...m, content: completed.error_message || 'Report generation failed', isLoading: false, type: 'system' as const }
              : m
          )
        );
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: err instanceof Error ? err.message : 'Something went wrong', isLoading: false, type: 'system' as const }
            : m
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHistoryClick = (report: AIReport) => {
    setParentReportId(report.id);
    navigate(`/reporting/${report.id}`);
  };

  const handleNewConversation = () => {
    setMessages([]);
    setParentReportId(null);
    setPrompt('');
  };

  const formatHistoryDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimestamp = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <div className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700 space-y-3">
          <button
            onClick={() => navigate('/reporting')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </button>
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            New Report
          </button>
        </div>

        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Recent Reports
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingHistory ? (
            <div className="p-4 text-center">
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin mx-auto" />
            </div>
          ) : recentReports.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No reports yet
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {recentReports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => handleHistoryClick(report)}
                  className="w-full group p-3 rounded-lg hover:bg-slate-700/50 text-left transition-colors"
                >
                  <p className="text-sm text-slate-300 line-clamp-2 group-hover:text-white transition-colors">
                    {report.report_name}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    {formatHistoryDate(report.created_at)}
                  </div>
                </button>
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
                <h1 className="text-3xl font-bold text-white mb-3">AI Report Generator</h1>
                <p className="text-slate-400 text-lg">
                  Describe what you want to analyze and AI will build a full report
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {SUGGESTED_PROMPTS.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setPrompt(example)}
                    className="p-4 text-left bg-slate-800 border border-slate-700 rounded-xl hover:border-cyan-500/50 hover:bg-slate-700/50 transition-all group"
                  >
                    <p className="text-slate-300 group-hover:text-white transition-colors text-sm">
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
                        : message.type === 'system'
                        ? 'bg-red-500/10 border border-red-500/20 rounded-2xl rounded-bl-md'
                        : 'bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-md'
                    } p-4`}
                  >
                    {message.type === 'ai' && (
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-700">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium text-cyan-400">AI Report</span>
                        <span className="text-xs text-slate-500">{formatTimestamp(message.timestamp)}</span>
                      </div>
                    )}

                    {message.isLoading ? (
                      <div className="flex items-center gap-3 py-2">
                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                        <span className="text-slate-400">Building your report...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-white leading-relaxed whitespace-pre-wrap text-sm">
                          {message.content}
                        </p>

                        {message.type === 'ai' && message.reportId && (
                          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-3">
                            <button
                              onClick={() => navigate(`/reporting/${message.reportId}`)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors text-sm"
                            >
                              <FileText className="w-4 h-4" />
                              View Full Report
                            </button>
                            {message.report?.result_json?.kpis && message.report.result_json.kpis.length > 0 && (
                              <span className="text-xs text-slate-500">
                                {message.report.result_json.kpis.length} KPIs |{' '}
                                {message.report.result_json.charts?.length || 0} charts
                              </span>
                            )}
                          </div>
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
            {parentReportId && (
              <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                <span>Following up on previous report</span>
                <button
                  onClick={handleNewConversation}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Start fresh
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={parentReportId ? 'Ask a follow-up question or request changes...' : 'Describe the report you want to generate...'}
                  rows={1}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as ReportScope)}
                    className="appearance-none h-full px-3 pr-8 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                  >
                    {availableScopes.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                <div className="relative">
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="appearance-none h-full px-3 pr-8 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                  >
                    {TIMEFRAME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!prompt.trim() || isGenerating}
                  className="p-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl hover:from-cyan-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
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
    </div>
  );
}
