import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Mic, Plus, Search, Filter, Loader2, Play, Pause, Settings, Phone } from 'lucide-react';
import type { AIAgent } from '../../types';
import { getAgents } from '../../services/aiAgents';

export function AIAgentsVoice() {
  const { user, hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const canManage = hasPermission('ai_agents.manage');
  const shouldShowCreate = searchParams.get('create') === 'true';

  useEffect(() => {
    loadAgents();
  }, [user?.organization_id]);

  const loadAgents = async () => {
    if (!user?.organization_id) return;

    try {
      setIsLoading(true);
      const data = await getAgents(user.organization_id, {
        agentType: 'voice',
        search: searchQuery || undefined,
      });
      setAgents(data);
    } catch (error) {
      console.error('Failed to load voice agents:', error);
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
          <h2 className="text-xl font-bold text-white">Voice AI Agents</h2>
          <p className="text-sm text-slate-400 mt-1">
            AI agents that handle phone calls using natural voice interactions
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search voice agents..."
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
              <Mic className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Voice AI Agents Yet</h3>
            <p className="text-slate-400 mb-6">
              Create your first voice agent to handle inbound and outbound phone calls automatically.
            </p>
            {canManage && (
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                <Plus className="w-4 h-4" />
                Create Voice Agent
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
                    <Mic className="w-5 h-5 text-cyan-400" />
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

              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    <span>0 numbers</span>
                  </div>
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
