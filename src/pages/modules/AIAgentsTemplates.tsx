import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FileCode, Plus, Search, Filter, Loader2, Mic, MessageSquare, TrendingUp } from 'lucide-react';
import type { AgentTemplate } from '../../types';
import { getTemplates } from '../../services/agentTemplates';

export function AIAgentsTemplates() {
  const { user, hasPermission } = useAuth();
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const canManage = hasPermission('ai_agents.manage');

  useEffect(() => {
    loadTemplates();
  }, [user?.organization_id]);

  const loadTemplates = async () => {
    if (!user?.organization_id) return;

    try {
      setIsLoading(true);
      const data = await getTemplates(user.organization_id, {
        search: searchQuery || undefined,
      });
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
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
          <h2 className="text-xl font-bold text-white">Agent Templates</h2>
          <p className="text-sm text-slate-400 mt-1">
            Pre-built agent configurations you can customize and deploy
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates..."
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

      {templates.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileCode className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Templates Yet</h3>
            <p className="text-slate-400 mb-6">
              Create agent templates to quickly deploy similar agents across your organization.
            </p>
            {canManage && (
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                <Plus className="w-4 h-4" />
                Create from Existing Agent
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-cyan-500 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                    {template.agent_type === 'voice' ? (
                      <Mic className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <MessageSquare className="w-5 h-5 text-cyan-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-sm text-slate-400 mt-1 line-clamp-2">{template.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {template.use_case && (
                <div className="mb-4">
                  <span className="inline-block px-2 py-1 text-xs font-medium bg-slate-700 text-slate-300 rounded">
                    {template.use_case}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <div className="flex items-center gap-1 text-sm text-slate-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>Used {template.times_used} times</span>
                </div>
                <button className="text-sm text-cyan-400 group-hover:text-cyan-300 transition-colors font-medium">
                  Use Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
