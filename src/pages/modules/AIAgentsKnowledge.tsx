import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Database, Plus, Search, Filter, Loader2, Globe, FileQuestion, Table, FileText, Upload, Link as LinkIcon } from 'lucide-react';
import type { AgentKnowledgeSource } from '../../types';
import { getKnowledgeSources } from '../../services/agentKnowledge';

const SOURCE_TYPE_CONFIG = {
  website: { icon: Globe, label: 'Website', color: 'blue' },
  faq: { icon: FileQuestion, label: 'FAQ', color: 'purple' },
  table: { icon: Table, label: 'Table', color: 'emerald' },
  rich_text: { icon: FileText, label: 'Rich Text', color: 'amber' },
  file_upload: { icon: Upload, label: 'File Upload', color: 'cyan' },
};

export function AIAgentsKnowledge() {
  const { user, hasPermission } = useAuth();
  const [sources, setSources] = useState<AgentKnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const canManage = hasPermission('ai_agents.manage');

  useEffect(() => {
    loadSources();
  }, [user?.organization_id]);

  const loadSources = async () => {
    if (!user?.organization_id) return;

    try {
      setIsLoading(true);
      const data = await getKnowledgeSources(user.organization_id, {
        search: searchQuery || undefined,
      });
      setSources(data);
    } catch (error) {
      console.error('Failed to load knowledge sources:', error);
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
          <h2 className="text-xl font-bold text-white">Knowledge Base</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage knowledge sources that your AI agents can reference
          </p>
        </div>
        {canManage && (
          <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Add Knowledge Source
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search knowledge sources..."
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

      {sources.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Database className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Knowledge Sources Yet</h3>
            <p className="text-slate-400 mb-6">
              Add knowledge sources like websites, FAQs, or documents that your agents can reference.
            </p>
            {canManage && (
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                <Plus className="w-4 h-4" />
                Add Knowledge Source
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sources.map((source) => {
            const config = SOURCE_TYPE_CONFIG[source.source_type];
            const Icon = config.icon;

            return (
              <div
                key={source.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 bg-${config.color}-500/10 rounded-lg`}>
                      <Icon className={`w-5 h-5 text-${config.color}-400`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{source.source_name}</h3>
                      <span className={`inline-block text-xs font-medium text-${config.color}-400 mt-1`}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    source.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : source.status === 'processing'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {source.status}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    {source.agent ? (
                      <div className="flex items-center gap-1">
                        <LinkIcon className="w-4 h-4" />
                        <span>Linked to agent</span>
                      </div>
                    ) : (
                      <span>Not linked</span>
                    )}
                    <span>{source.embedding_count} chunks</span>
                  </div>
                  <button className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                    Configure
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
