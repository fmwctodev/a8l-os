import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, Search, Filter, Loader2, Play, Pause, MoreVertical, Settings, Trash2, Eye } from 'lucide-react';
import type { AIAgent } from '../../types';
import { getAgents, deleteAgent, toggleAgentEnabled } from '../../services/aiAgents';
import { AgentConfigModal } from '../../components/ai-agents/AgentConfigModal';

const CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
  internal_note: 'Internal',
};

export function AIAgentsConversation() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const canManage = hasPermission('ai_agents.manage');

  useEffect(() => {
    loadAgents();
  }, [user?.organization_id]);

  useEffect(() => {
    if (searchParams.get('create') === 'true' && canManage) {
      setEditingAgent(null);
      setIsConfigModalOpen(true);
      setSearchParams({});
    }
  }, [searchParams]);

  const loadAgents = async () => {
    if (!user?.organization_id) return;

    try {
      setIsLoading(true);
      const data = await getAgents(user.organization_id, {
        agentType: 'conversation',
        search: searchQuery || undefined,
      });
      setAgents(data);
    } catch (error) {
      console.error('Failed to load conversation agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigure = (agent: AIAgent) => {
    setEditingAgent(agent);
    setIsConfigModalOpen(true);
  };

  const handleCreate = () => {
    setEditingAgent(null);
    setIsConfigModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsConfigModalOpen(false);
    setEditingAgent(null);
    loadAgents();
  };

  const handleToggleEnabled = async (agent: AIAgent) => {
    try {
      await toggleAgentEnabled(agent.id, !agent.enabled);
      loadAgents();
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    }
  };

  const handleDelete = async (agent: AIAgent) => {
    if (!confirm(`Are you sure you want to delete "${agent.name}"? This cannot be undone.`)) return;
    try {
      await deleteAgent(agent.id);
      loadAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Conversation AI Agents</h2>
          <p className="text-sm text-slate-400 mt-1">
            AI agents that handle text-based conversations across multiple channels
          </p>
        </div>
        {canManage && agents.length > 0 && (
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            New Conversation Agent
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search conversation agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadAgents()}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Conversation AI Agents Yet</h3>
            <p className="text-slate-400 mb-6">
              Create your first conversation agent to handle SMS, email, and web chat automatically.
            </p>
            {canManage && (
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Conversation Agent
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <button
                  onClick={() => navigate(`/ai-agents/${agent.id}`)}
                  className="flex items-start gap-3 text-left flex-1 min-w-0"
                >
                  <div className="p-2 bg-cyan-500/10 rounded-lg flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white hover:text-cyan-400 transition-colors">{agent.name}</h3>
                    {agent.description && (
                      <p className="text-sm text-slate-400 mt-1 line-clamp-2">{agent.description}</p>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {agent.enabled ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                      <Play className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Pause className="w-3 h-3" />
                      Paused
                    </span>
                  )}
                  {canManage && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === agent.id ? null : agent.id)}
                        className="p-1 rounded hover:bg-slate-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                      {openMenuId === agent.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                            <button
                              onClick={() => { navigate(`/ai-agents/${agent.id}`); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </button>
                            <button
                              onClick={() => { handleConfigure(agent); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                            >
                              <Settings className="w-4 h-4" />
                              Edit Configuration
                            </button>
                            <button
                              onClick={() => { handleToggleEnabled(agent); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                            >
                              {agent.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              {agent.enabled ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => { handleDelete(agent); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {agent.allowed_channels.map((channel) => (
                  <span
                    key={channel}
                    className="px-2 py-1 text-xs font-medium bg-slate-700 text-slate-300 rounded"
                  >
                    {CHANNEL_LABELS[channel] || channel}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <div className="text-sm text-slate-400">
                  {agent.auto_reply_enabled ? 'Auto-reply enabled' : agent.requires_approval ? 'Requires approval' : 'Manual mode'}
                </div>
                {canManage && (
                  <button
                    onClick={() => handleConfigure(agent)}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                  >
                    Configure
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isConfigModalOpen && (
        <AgentConfigModal
          agent={editingAgent}
          defaultAgentType="conversation"
          onClose={() => { setIsConfigModalOpen(false); setEditingAgent(null); }}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
