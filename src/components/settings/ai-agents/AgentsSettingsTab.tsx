import { useState, useEffect } from 'react';
import { Plus, MoreVertical, Pencil, Copy, Power, Trash2, History, Bot } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as aiAgentsService from '../../../services/aiAgents';
import * as knowledgeService from '../../../services/knowledgeCollections';
import type { AIAgent, KnowledgeCollection } from '../../../types';
import { AgentEditorDrawer } from './AgentEditorDrawer';

export function AgentsSettingsTab() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [knowledgeCounts, setKnowledgeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const orgId = user?.organization_id;

  useEffect(() => {
    if (orgId) {
      loadAgents();
    }
  }, [orgId]);

  const loadAgents = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const data = await aiAgentsService.getAgents(orgId);
      setAgents(data);

      const counts: Record<string, number> = {};
      for (const agent of data) {
        const collections = await knowledgeService.getAgentCollections(agent.id);
        counts[agent.id] = collections.length;
      }
      setKnowledgeCounts(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = () => {
    setSelectedAgent(null);
    setIsDrawerOpen(true);
  };

  const handleEditAgent = (agent: AIAgent) => {
    setSelectedAgent(agent);
    setIsDrawerOpen(true);
    setOpenMenuId(null);
  };

  const handleDuplicateAgent = async (agent: AIAgent) => {
    if (!orgId || !user) return;
    try {
      await aiAgentsService.createAgent(orgId, {
        name: `${agent.name} (Copy)`,
        description: agent.description || undefined,
        system_prompt: agent.system_prompt,
        allowed_tools: agent.allowed_tools,
        allowed_channels: agent.allowed_channels,
        temperature: agent.temperature,
        max_tokens: agent.max_tokens,
        enabled: false,
      }, user.id);
      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate agent');
    }
    setOpenMenuId(null);
  };

  const handleToggleEnabled = async (agent: AIAgent) => {
    try {
      await aiAgentsService.updateAgent(agent.id, { enabled: !agent.enabled });
      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent');
    }
    setOpenMenuId(null);
  };

  const handleDeleteAgent = async (agent: AIAgent) => {
    if (!confirm(`Are you sure you want to delete "${agent.name}"?`)) return;
    try {
      await aiAgentsService.deleteAgent(agent.id);
      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
    }
    setOpenMenuId(null);
  };

  const handleSaveAgent = async () => {
    setIsDrawerOpen(false);
    setSelectedAgent(null);
    await loadAgents();
  };

  const formatChannels = (channels: string[]) => {
    const icons: Record<string, string> = {
      sms: 'SMS',
      email: 'Email',
      internal_note: 'Notes',
    };
    return channels.map((c) => icons[c] || c).join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white">AI Agents</h2>
          <p className="text-sm text-slate-400">
            Configure AI agents that can analyze data and assist with conversations
          </p>
        </div>
        <button
          onClick={handleCreateAgent}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Agent
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
          <Bot className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No agents yet</h3>
          <p className="text-slate-400 mb-4">Create your first AI agent to get started</p>
          <button
            onClick={handleCreateAgent}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </button>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Channels</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Knowledge</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Updated</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr
                  key={agent.id}
                  className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30"
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-white">{agent.name}</div>
                      {agent.description && (
                        <div className="text-sm text-slate-400 truncate max-w-xs">
                          {agent.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        agent.enabled
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {agent.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {formatChannels(agent.allowed_channels)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {knowledgeCounts[agent.id] || 0} collections
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {new Date(agent.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === agent.id ? null : agent.id)}
                        className="p-1 text-slate-400 hover:text-white rounded"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {openMenuId === agent.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10">
                          <button
                            onClick={() => handleEditAgent(agent)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDuplicateAgent(agent)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                          >
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleToggleEnabled(agent)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                          >
                            <Power className="w-4 h-4" />
                            {agent.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <a
                            href={`/ai-agents/${agent.id}`}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                          >
                            <History className="w-4 h-4" />
                            View History
                          </a>
                          <button
                            onClick={() => handleDeleteAgent(agent)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isDrawerOpen && (
        <AgentEditorDrawer
          agent={selectedAgent}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedAgent(null);
          }}
          onSave={handleSaveAgent}
        />
      )}
    </div>
  );
}
