import type { AIAgent } from '../../../types';

interface AgentFormHeaderProps {
  sourceName: string;
  setSourceName: (name: string) => void;
  agents: AIAgent[];
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
}

interface GlobalFormHeaderProps {
  sourceName: string;
  setSourceName: (name: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  applyToAllAgents: boolean;
  setApplyToAllAgents: (value: boolean) => void;
}

export function AgentFormHeader({
  sourceName,
  setSourceName,
  agents,
  selectedAgentId,
  setSelectedAgentId,
}: AgentFormHeaderProps) {
  return (
    <div className="space-y-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
        <input
          type="text"
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Enter knowledge source name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Link to Agent</label>
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">No agent (shared)</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Shared sources can be used by any agent
        </p>
      </div>
    </div>
  );
}

export function GlobalFormHeader({
  sourceName,
  setSourceName,
  description,
  setDescription,
  applyToAllAgents,
  setApplyToAllAgents,
}: GlobalFormHeaderProps) {
  return (
    <div className="space-y-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
        <input
          type="text"
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="e.g., Company Overview"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Brief description of this knowledge collection"
        />
      </div>
      <label className="flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:border-slate-600 transition-colors">
        <input
          type="checkbox"
          checked={applyToAllAgents}
          onChange={(e) => setApplyToAllAgents(e.target.checked)}
          className="mt-0.5 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
        />
        <div>
          <span className="text-white font-medium">Apply to all agents</span>
          <p className="text-sm text-slate-400 mt-0.5">
            This knowledge will be automatically included in all AI agent runs
          </p>
        </div>
      </label>
    </div>
  );
}
