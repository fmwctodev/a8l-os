import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAgentById,
  getAgentRuns,
  getAgentMemories,
  resetAgentMemory,
  toggleAgentEnabled,
} from '../../services/aiAgents';
import type { AIAgent, AIAgentRun, AIAgentMemory, AIAgentRunFilters } from '../../types';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Bot,
  Play,
  Pause,
  Settings,
  Trash2,
  Activity,
  Brain,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  ChevronDown,
  Search,
  RefreshCw,
  MessageSquare,
  Mail,
  FileText,
  Zap,
} from 'lucide-react';
import { AgentConfigModal } from '../../components/ai-agents/AgentConfigModal';

type TabId = 'overview' | 'runs' | 'memory';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  running: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  success: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-400' },
  stopped: { bg: 'bg-slate-500/10', text: 'text-slate-400' },
};

export function AIAgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { user: currentUser, hasPermission } = useAuth();

  const [agent, setAgent] = useState<AIAgent | null>(null);
  const [runs, setRuns] = useState<AIAgentRun[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [memories, setMemories] = useState<AIAgentMemory[]>([]);
  const [memoriesTotal, setMemoriesTotal] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [runsPage, setRunsPage] = useState(1);
  const [memoryPage, setMemoryPage] = useState(1);
  const [runFilters, setRunFilters] = useState<AIAgentRunFilters>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedRun, setSelectedRun] = useState<AIAgentRun | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<AIAgentMemory | null>(null);
  const [memorySearch, setMemorySearch] = useState('');

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const canManage = hasPermission('ai_agents.manage');
  const canResetMemory = hasPermission('ai_agents.memory.reset');

  const loadAgent = useCallback(async () => {
    if (!agentId) return;

    try {
      setIsLoading(true);
      setError(null);

      const agentData = await getAgentById(agentId);
      if (!agentData) {
        setError('Agent not found');
        return;
      }

      setAgent(agentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent');
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  const loadRuns = useCallback(async () => {
    if (!agentId || !currentUser?.organization_id) return;

    try {
      const filters: AIAgentRunFilters = {
        ...runFilters,
        agentId,
        status: statusFilter !== 'all' ? [statusFilter as AIAgentRun['status']] : undefined,
      };

      const { data, total } = await getAgentRuns(currentUser.organization_id, filters, runsPage, 20);
      setRuns(data);
      setRunsTotal(total);
    } catch (err) {
      console.error('Failed to load runs:', err);
    }
  }, [agentId, currentUser?.organization_id, runFilters, statusFilter, runsPage]);

  const loadMemories = useCallback(async () => {
    if (!agentId) return;

    try {
      const { data, total } = await getAgentMemories(agentId, memoryPage, 20);
      setMemories(data);
      setMemoriesTotal(total);
    } catch (err) {
      console.error('Failed to load memories:', err);
    }
  }, [agentId, memoryPage]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  useEffect(() => {
    if (activeTab === 'runs') {
      loadRuns();
    } else if (activeTab === 'memory') {
      loadMemories();
    }
  }, [activeTab, loadRuns, loadMemories]);

  const handleToggleEnabled = async () => {
    if (!agent) return;

    try {
      await toggleAgentEnabled(agent.id, !agent.enabled);
      loadAgent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent');
    }
  };

  const handleResetMemory = async (memory: AIAgentMemory) => {
    if (!confirm('Are you sure you want to reset this memory? This cannot be undone.')) return;

    try {
      await resetAgentMemory(memory.agent_id, memory.contact_id);
      loadMemories();
      setSelectedMemory(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset memory');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">Error loading agent</p>
        <p className="text-slate-400 text-sm">{error || 'Agent not found'}</p>
        <button
          onClick={() => navigate('/ai-agents')}
          className="mt-4 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        >
          Back to Agents
        </button>
      </div>
    );
  }

  const filteredMemories = memories.filter((m) => {
    if (!memorySearch) return true;
    const search = memorySearch.toLowerCase();
    const contact = m.contact;
    if (!contact) return false;
    return (
      contact.first_name?.toLowerCase().includes(search) ||
      contact.last_name?.toLowerCase().includes(search) ||
      contact.email?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/ai-agents')}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">{agent.name}</h1>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                agent.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
              }`}
            >
              {agent.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">{agent.description || 'No description'}</p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleEnabled}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                agent.enabled
                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              {agent.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {agent.enabled ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('runs')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'runs'
              ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          Run History
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-xs">{runsTotal}</span>
        </button>
        <button
          onClick={() => setActiveTab('memory')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'memory'
              ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Brain className="w-4 h-4" />
          Memory Browser
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-xs">{memoriesTotal}</span>
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{agent.stats?.total_runs || 0}</p>
                    <p className="text-sm text-slate-400">Total Runs</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{agent.stats?.success_rate || 0}%</p>
                    <p className="text-sm text-slate-400">Success Rate</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{agent.stats?.successful_runs || 0}</p>
                    <p className="text-sm text-slate-400">Successful</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{agent.stats?.failed_runs || 0}</p>
                    <p className="text-sm text-slate-400">Failed</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Temperature</p>
                  <p className="text-white">{agent.temperature}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Max Tokens</p>
                  <p className="text-white">{agent.max_tokens}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Allowed Tools</p>
                  <p className="text-white">{(agent.allowed_tools || []).length} tools</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Allowed Channels</p>
                  <div className="flex gap-1 mt-1">
                    {(agent.allowed_channels || []).map((channel) => (
                      <span
                        key={channel}
                        className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-300"
                      >
                        {channel}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-lg font-medium text-white mb-4">System Prompt</h3>
              <div className="bg-slate-800 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                  {agent.system_prompt}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'runs' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                {statusFilter === 'all' ? 'All Status' : statusFilter}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showStatusDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
                  <div className="absolute left-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                    {['all', 'pending', 'running', 'success', 'failed', 'stopped'].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status);
                          setShowStatusDropdown(false);
                          setRunsPage(1);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 capitalize"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={loadRuns}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800">
            {runs.map((run) => (
              <div
                key={run.id}
                className="p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {run.contact?.first_name} {run.contact?.last_name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {run.triggered_by === 'user' ? 'Manual' : 'Automation'} - {formatDate(run.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {run.draft_message && (
                      <div className="flex items-center gap-1">
                        {run.draft_channel === 'sms' && <MessageSquare className="w-4 h-4 text-cyan-400" />}
                        {run.draft_channel === 'email' && <Mail className="w-4 h-4 text-cyan-400" />}
                        <span className="text-xs text-cyan-400">Draft</span>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-sm text-white">{run.tool_calls_count} tools</p>
                      <p className="text-xs text-slate-400">
                        {formatDuration(run.started_at, run.completed_at)}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                        STATUS_STYLES[run.status]?.bg || 'bg-slate-500/10'
                      } ${STATUS_STYLES[run.status]?.text || 'text-slate-400'}`}
                    >
                      {run.status}
                    </span>
                  </div>
                </div>

                {selectedRun?.id === run.id && (
                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-4">
                    {run.output_summary && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1">Output Summary</p>
                        <p className="text-sm text-slate-300">{run.output_summary}</p>
                      </div>
                    )}

                    {run.draft_message && (
                      <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <p className="text-xs font-medium text-cyan-400 mb-1">
                          Draft {run.draft_channel?.toUpperCase()}
                          {run.draft_subject && `: ${run.draft_subject}`}
                        </p>
                        <p className="text-sm text-slate-300">{run.draft_message}</p>
                        {run.user_approved !== null && (
                          <p className="text-xs text-slate-400 mt-2">
                            {run.user_approved ? 'Approved' : 'Rejected'}{' '}
                            {run.approved_at && `on ${formatDate(run.approved_at)}`}
                          </p>
                        )}
                      </div>
                    )}

                    {run.error_message && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-xs font-medium text-red-400 mb-1">Error</p>
                        <p className="text-sm text-red-300">{run.error_message}</p>
                      </div>
                    )}

                    {run.tool_calls && run.tool_calls.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-2">Tool Calls</p>
                        <div className="space-y-2">
                          {run.tool_calls.map((tc) => (
                            <div key={tc.id} className="p-2 rounded bg-slate-800 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-white">{tc.tool_name}</span>
                                <span
                                  className={
                                    tc.status === 'success' ? 'text-emerald-400' : 'text-red-400'
                                  }
                                >
                                  {tc.status} ({tc.duration_ms}ms)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {runs.length === 0 && (
              <div className="p-12 text-center">
                <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-white font-medium mb-1">No runs found</p>
                <p className="text-slate-400 text-sm">
                  This agent hasn't been executed yet
                </p>
              </div>
            )}
          </div>

          {runsTotal > 20 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setRunsPage(Math.max(1, runsPage - 1))}
                disabled={runsPage === 1}
                className="px-3 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-400">
                Page {runsPage} of {Math.ceil(runsTotal / 20)}
              </span>
              <button
                onClick={() => setRunsPage(runsPage + 1)}
                disabled={runsPage >= Math.ceil(runsTotal / 20)}
                className="px-3 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'memory' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={memorySearch}
                onChange={(e) => setMemorySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
              {filteredMemories.map((memory) => (
                <button
                  key={memory.id}
                  onClick={() => setSelectedMemory(memory)}
                  className={`w-full p-4 text-left transition-colors ${
                    selectedMemory?.id === memory.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {memory.contact?.first_name} {memory.contact?.last_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{memory.contact?.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">
                        {new Date(memory.last_updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}

              {filteredMemories.length === 0 && (
                <div className="p-12 text-center">
                  <Brain className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-white font-medium mb-1">No memories found</p>
                  <p className="text-slate-400 text-sm">
                    {memorySearch ? 'Try a different search' : 'This agent has no stored memories yet'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            {selectedMemory ? (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                      <User className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-white">
                        {selectedMemory.contact?.first_name} {selectedMemory.contact?.last_name}
                      </p>
                      <p className="text-sm text-slate-400">{selectedMemory.contact?.email}</p>
                    </div>
                  </div>
                  {canResetMemory && (
                    <button
                      onClick={() => handleResetMemory(selectedMemory)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Reset Memory
                    </button>
                  )}
                </div>

                {selectedMemory.lead_stage && (
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-slate-400">Lead Stage</p>
                      <p className="text-sm font-medium text-white capitalize">{selectedMemory.lead_stage}</p>
                    </div>
                    {selectedMemory.confidence_level && (
                      <div>
                        <p className="text-xs text-slate-400">Confidence</p>
                        <p className="text-sm font-medium text-white capitalize">{selectedMemory.confidence_level}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedMemory.key_facts && Object.keys(selectedMemory.key_facts).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-2">Key Facts</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedMemory.key_facts).map(([key, value]) => (
                        <div key={key} className="px-3 py-1.5 rounded-lg bg-slate-800">
                          <span className="text-xs text-slate-400">{key}: </span>
                          <span className="text-xs text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedMemory.conversation_summary && (
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-2">Conversation Summary</p>
                    <p className="text-sm text-slate-400">{selectedMemory.conversation_summary}</p>
                  </div>
                )}

                {selectedMemory.last_decision && (
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-2">Last Decision</p>
                    <p className="text-sm text-slate-400">{selectedMemory.last_decision}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-500">
                    Last updated: {formatDate(selectedMemory.last_updated_at)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
                <Brain className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-white font-medium mb-1">Select a contact</p>
                <p className="text-slate-400 text-sm">
                  Choose a contact from the list to view their memory
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {isConfigModalOpen && (
        <AgentConfigModal
          agent={agent}
          onClose={() => setIsConfigModalOpen(false)}
          onSuccess={() => {
            setIsConfigModalOpen(false);
            loadAgent();
          }}
        />
      )}
    </div>
  );
}
