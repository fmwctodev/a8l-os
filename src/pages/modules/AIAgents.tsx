import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAgents, getAgentStats, toggleAgentEnabled, deleteAgent } from '../../services/aiAgents';
import type { AIAgent, AIAgentFilters } from '../../types';
import {
  Search,
  Plus,
  Filter,
  Loader2,
  AlertCircle,
  Bot,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Settings,
  Activity,
  CheckCircle2,
  XCircle,
  ChevronDown,
  MessageSquare,
  Mail,
  FileText,
  Clock,
} from 'lucide-react';
import { AgentConfigModal } from '../../components/ai-agents/AgentConfigModal';

const CHANNEL_ICONS: Record<string, typeof MessageSquare> = {
  sms: MessageSquare,
  email: Mail,
  internal_note: FileText,
};

export function AIAgents() {
  const { user: currentUser, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [stats, setStats] = useState({
    totalAgents: 0,
    enabledAgents: 0,
    totalRuns: 0,
    successfulRuns: 0,
    pendingApprovals: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);

  const canManage = hasPermission('ai_agents.manage');
  const canRun = hasPermission('ai_agents.run');

  const loadData = useCallback(async () => {
    if (!currentUser?.organization_id) return;

    try {
      setIsLoading(true);
      setError(null);

      const filters: AIAgentFilters = {
        search: searchQuery || undefined,
        enabled: enabledFilter === 'all' ? undefined : enabledFilter === 'enabled',
      };

      const [agentsData, statsData] = await Promise.all([
        getAgents(currentUser.organization_id, filters),
        getAgentStats(currentUser.organization_id),
      ]);

      setAgents(agentsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI agents');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.organization_id, searchQuery, enabledFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleEnabled = async (agent: AIAgent, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleAgentEnabled(agent.id, !agent.enabled);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this AI agent? This action cannot be undone.')) return;

    try {
      await deleteAgent(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
    }
  };

  const handleEdit = (agent: AIAgent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAgent(agent);
    setIsConfigModalOpen(true);
    setActiveDropdown(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">Error loading AI agents</p>
        <p className="text-slate-400 text-sm">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">AI Agents</h1>
          <p className="text-slate-400 mt-1">
            Configure AI-powered assistants to analyze contacts and draft responses
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEditingAgent(null);
              setIsConfigModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.totalAgents}</p>
              <p className="text-sm text-slate-400">Total Agents</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Play className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.enabledAgents}</p>
              <p className="text-sm text-slate-400">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.totalRuns}</p>
              <p className="text-sm text-slate-400">Total Runs</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.successfulRuns}</p>
              <p className="text-sm text-slate-400">Successful</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats.pendingApprovals}</p>
              <p className="text-sm text-slate-400">Pending Approval</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Filter className="w-4 h-4" />
                {enabledFilter === 'all' ? 'All Agents' : enabledFilter === 'enabled' ? 'Active' : 'Disabled'}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showFilterDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowFilterDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                    <button
                      onClick={() => {
                        setEnabledFilter('all');
                        setShowFilterDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700"
                    >
                      All Agents
                    </button>
                    <button
                      onClick={() => {
                        setEnabledFilter('enabled');
                        setShowFilterDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-emerald-400 hover:bg-slate-700"
                    >
                      Active
                    </button>
                    <button
                      onClick={() => {
                        setEnabledFilter('disabled');
                        setShowFilterDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-400 hover:bg-slate-700"
                    >
                      Disabled
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="p-4 hover:bg-slate-800/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/ai-agents/${agent.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    agent.enabled
                      ? 'bg-gradient-to-br from-cyan-500/20 to-teal-500/20'
                      : 'bg-slate-800'
                  }`}>
                    <Bot className={`w-5 h-5 ${agent.enabled ? 'text-cyan-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white">{agent.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          agent.enabled
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {agent.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">
                      {agent.description || 'No description'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1">
                    {(agent.allowed_channels || []).map((channel) => {
                      const Icon = CHANNEL_ICONS[channel] || FileText;
                      return (
                        <div
                          key={channel}
                          className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center"
                          title={channel}
                        >
                          <Icon className="w-3 h-3 text-slate-400" />
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-right min-w-[60px]">
                    <p className="text-sm font-medium text-white">
                      {agent.stats?.total_runs || 0}
                    </p>
                    <p className="text-xs text-slate-400">Runs</p>
                  </div>
                  <div className="text-right min-w-[60px]">
                    <p className="text-sm font-medium text-white">
                      {agent.stats?.success_rate || 0}%
                    </p>
                    <p className="text-xs text-slate-400">Success</p>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <p className="text-xs text-slate-400">
                      {formatDate(agent.stats?.last_run_at || null)}
                    </p>
                    <p className="text-xs text-slate-500">Last run</p>
                  </div>

                  {(canManage || canRun) && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {canManage && (
                        <button
                          onClick={(e) => handleToggleEnabled(agent, e)}
                          className={`p-2 rounded-lg transition-colors ${
                            agent.enabled
                              ? 'hover:bg-amber-500/10 text-amber-400'
                              : 'hover:bg-emerald-500/10 text-emerald-400'
                          }`}
                          title={agent.enabled ? 'Disable agent' : 'Enable agent'}
                        >
                          {agent.enabled ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveDropdown(activeDropdown === agent.id ? null : agent.id)
                          }
                          className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                        {activeDropdown === agent.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setActiveDropdown(null)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                              <button
                                onClick={() => {
                                  navigate(`/ai-agents/${agent.id}`);
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Activity className="w-4 h-4" />
                                View Details
                              </button>
                              {canManage && (
                                <>
                                  <button
                                    onClick={(e) => handleEdit(agent, e)}
                                    className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Settings className="w-4 h-4" />
                                    Edit Configuration
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDelete(agent.id);
                                      setActiveDropdown(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Agent
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {agents.length === 0 && (
            <div className="p-12 text-center">
              <Bot className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No AI agents found</p>
              <p className="text-slate-400 text-sm mb-6">
                {searchQuery || enabledFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first AI agent'}
              </p>
              {canManage && !searchQuery && enabledFilter === 'all' && (
                <button
                  onClick={() => {
                    setEditingAgent(null);
                    setIsConfigModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Agent
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isConfigModalOpen && (
        <AgentConfigModal
          agent={editingAgent}
          onClose={() => {
            setIsConfigModalOpen(false);
            setEditingAgent(null);
          }}
          onSuccess={() => {
            setIsConfigModalOpen(false);
            setEditingAgent(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
