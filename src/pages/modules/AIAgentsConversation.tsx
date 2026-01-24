import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Plus, Search, Filter, Loader2, Play, Pause, Mail, Phone as PhoneIcon } from 'lucide-react';
import type { AIAgent } from '../../types';
import { getAgents } from '../../services/aiAgents';

const CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
  internal_note: 'Internal',
};

export function AIAgentsConversation() {
  const { user, hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const canManage = hasPermission('ai_agents.manage');

  useEffect(() => {
    loadAgents();
  }, [user?.organization_id]);

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
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search conversation agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
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
              className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{agent.name}</h3>
                    {agent.description && (
                      <p className="text-sm text-slate-400 mt-1">{agent.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                  {agent.requires_approval ? 'Requires approval' : 'Auto-reply enabled'}
                </div>
                <button className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                  Configure
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
