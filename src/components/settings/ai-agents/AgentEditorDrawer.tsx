import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as aiAgentsService from '../../../services/aiAgents';
import * as llmModelsService from '../../../services/llmModels';
import * as knowledgeService from '../../../services/knowledgeCollections';
import * as promptsService from '../../../services/promptTemplates';
import * as defaultsService from '../../../services/aiAgentDefaults';
import type {
  AIAgent,
  LLMModel,
  KnowledgeCollection,
  PromptTemplate,
  AIAgentToolName,
  AIAgentChannel,
  AI_TOOL_DEFINITIONS,
} from '../../../types';

interface Props {
  agent: AIAgent | null;
  onClose: () => void;
  onSave: () => void;
}

const TOOL_CATEGORIES = {
  read: 'Read Operations',
  write: 'Write Operations',
  calendar: 'Calendar Operations',
  communication: 'Communication',
};

const CHANNELS: { id: AIAgentChannel; label: string }[] = [
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'Email' },
  { id: 'internal_note', label: 'Internal Notes' },
];

export function AgentEditorDrawer({ agent, onClose, onSave }: Props) {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || '');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [temperature, setTemperature] = useState(agent?.temperature || 0.7);
  const [maxTokens, setMaxTokens] = useState(agent?.max_tokens || 1024);
  const [allowedTools, setAllowedTools] = useState<AIAgentToolName[]>(agent?.allowed_tools || []);
  const [allowedChannels, setAllowedChannels] = useState<AIAgentChannel[]>(
    agent?.allowed_channels || ['internal_note']
  );
  const [requireHumanApproval, setRequireHumanApproval] = useState(true);
  const [maxOutboundPerRun, setMaxOutboundPerRun] = useState(5);
  const [enableMemory, setEnableMemory] = useState(true);
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([]);
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);

  const [models, setModels] = useState<LLMModel[]>([]);
  const [knowledgeCollections, setKnowledgeCollections] = useState<KnowledgeCollection[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    model: false,
    prompt: false,
    tools: false,
    channels: false,
    safety: false,
    knowledge: false,
    templates: false,
  });

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId]);

  const loadData = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const [modelsData, knowledgeData, promptsData, defaults] = await Promise.all([
        llmModelsService.getEnabledModels(orgId),
        knowledgeService.getCollections(orgId, { status: 'active' }),
        promptsService.getTemplates(orgId, { status: 'active' }),
        defaultsService.getOrCreateDefaults(orgId),
      ]);

      setModels(modelsData);
      setKnowledgeCollections(knowledgeData);
      setPromptTemplates(promptsData);

      if (agent) {
        const agentAny = agent as unknown as Record<string, unknown>;
        setSelectedModelId((agentAny.model_id as string) || null);
        setRequireHumanApproval((agentAny.require_human_approval as boolean) ?? true);
        setMaxOutboundPerRun((agentAny.max_outbound_per_run as number) ?? 5);
        setEnableMemory((agentAny.enable_memory as boolean) ?? true);

        const agentKnowledge = await knowledgeService.getAgentCollections(agent.id);
        setSelectedKnowledge(agentKnowledge.map((k) => k.id));

        const agentPrompts = await promptsService.getAgentTemplates(agent.id);
        setSelectedPrompts(agentPrompts.map((p) => p.id));
      } else {
        setAllowedTools(defaults.default_allowed_tools);
        setRequireHumanApproval(defaults.require_human_approval_default);
        setMaxOutboundPerRun(defaults.max_outbound_per_run_default);
        setSelectedModelId(defaults.default_model_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleTool = (tool: AIAgentToolName) => {
    setAllowedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const toggleChannel = (channel: AIAgentChannel) => {
    setAllowedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const toggleKnowledge = (id: string) => {
    setSelectedKnowledge((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const togglePrompt = (id: string) => {
    setSelectedPrompts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!orgId || !user) return;
    if (!name.trim() || !systemPrompt.trim()) {
      setError('Name and system prompt are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        system_prompt: systemPrompt,
        allowed_tools: allowedTools,
        allowed_channels: allowedChannels,
        temperature,
        max_tokens: maxTokens,
        model_id: selectedModelId || undefined,
        require_human_approval: requireHumanApproval,
        max_outbound_per_run: maxOutboundPerRun,
        enable_memory: enableMemory,
      };

      let agentId: string;

      if (agent) {
        await aiAgentsService.updateAgent(agent.id, data);
        agentId = agent.id;
      } else {
        const newAgent = await aiAgentsService.createAgent(orgId, data, user.id);
        agentId = newAgent.id;
      }

      await knowledgeService.setAgentCollections(agentId, selectedKnowledge);
      await promptsService.setAgentTemplates(agentId, selectedPrompts);

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (
    id: string,
    title: string,
    children: React.ReactNode
  ) => (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <span className="font-medium text-white">{title}</span>
        {expandedSections[id] ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {expandedSections[id] && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
      <div className="w-full max-w-2xl bg-slate-900 h-full overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-white">
            {agent ? 'Edit Agent' : 'Create Agent'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
              {error}
            </div>
          )}

          {renderSection('basic', 'Basic Information', (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="e.g., Lead Qualifier"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Brief description of what this agent does"
                />
              </div>
            </>
          ))}

          {renderSection('model', 'Model Selection', (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                LLM Model
              </label>
              <select
                value={selectedModelId || ''}
                onChange={(e) => setSelectedModelId(e.target.value || null)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Use Organization Default</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.display_name}
                    {model.is_default ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Select a specific model or use the organization's default
              </p>
            </div>
          ))}

          {renderSection('prompt', 'System Prompt', (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  System Prompt *
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                  placeholder="You are a helpful AI assistant..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Temperature: {temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-400">
                    Lower = more focused, Higher = more creative
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    min="128"
                    max="4096"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </>
          ))}

          {renderSection('tools', 'Available Tools', (
            <div className="space-y-4">
              {Object.entries(TOOL_CATEGORIES).map(([category, label]) => {
                const categoryTools = [
                  { name: 'get_contact', displayName: 'Get Contact Info', category: 'read' },
                  { name: 'get_timeline', displayName: 'Get Contact Timeline', category: 'read' },
                  { name: 'get_conversation_history', displayName: 'Get Conversation History', category: 'read' },
                  { name: 'get_appointment_history', displayName: 'Get Appointment History', category: 'read' },
                  { name: 'add_note', displayName: 'Add Note', category: 'write' },
                  { name: 'update_field', displayName: 'Update Contact Field', category: 'write' },
                  { name: 'add_tag', displayName: 'Add Tag', category: 'write' },
                  { name: 'remove_tag', displayName: 'Remove Tag', category: 'write' },
                  { name: 'assign_owner', displayName: 'Assign Owner', category: 'write' },
                  { name: 'create_appointment', displayName: 'Create Appointment', category: 'calendar' },
                  { name: 'send_sms', displayName: 'Send SMS', category: 'communication' },
                  { name: 'send_email', displayName: 'Send Email', category: 'communication' },
                ].filter((t) => t.category === category);

                return (
                  <div key={category}>
                    <h4 className="text-sm font-medium text-slate-300 mb-2">{label}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {categoryTools.map((tool) => (
                        <label
                          key={tool.name}
                          className="flex items-center gap-2 p-2 bg-slate-800/50 rounded cursor-pointer hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={allowedTools.includes(tool.name as AIAgentToolName)}
                            onChange={() => toggleTool(tool.name as AIAgentToolName)}
                            className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                          />
                          <span className="text-sm text-slate-300">{tool.displayName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {renderSection('channels', 'Output Channels', (
            <div className="space-y-2">
              {CHANNELS.map((channel) => (
                <label
                  key={channel.id}
                  className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={allowedChannels.includes(channel.id)}
                    onChange={() => toggleChannel(channel.id)}
                    className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-slate-300">{channel.label}</span>
                </label>
              ))}
            </div>
          ))}

          {renderSection('safety', 'Safety Settings', (
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800">
                <div>
                  <span className="text-slate-300">Require Human Approval</span>
                  <p className="text-xs text-slate-400">
                    Messages must be approved before sending
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={requireHumanApproval}
                  onChange={(e) => setRequireHumanApproval(e.target.checked)}
                  className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                />
              </label>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Max Outbound Messages Per Run
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxOutboundPerRun}
                  onChange={(e) => setMaxOutboundPerRun(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800">
                <div>
                  <span className="text-slate-300">Enable Memory</span>
                  <p className="text-xs text-slate-400">
                    Agent remembers past interactions with contacts
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={enableMemory}
                  onChange={(e) => setEnableMemory(e.target.checked)}
                  className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                />
              </label>
            </div>
          ))}

          {renderSection('knowledge', 'Knowledge Sources', (
            <div className="space-y-2">
              {knowledgeCollections.length === 0 ? (
                <p className="text-slate-400 text-sm">
                  No knowledge collections available. Create one in the Knowledge tab.
                </p>
              ) : (
                knowledgeCollections.map((collection) => (
                  <label
                    key={collection.id}
                    className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedKnowledge.includes(collection.id)}
                      onChange={() => toggleKnowledge(collection.id)}
                      className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                    />
                    <div>
                      <span className="text-slate-300">{collection.name}</span>
                      {collection.apply_to_all_agents && (
                        <span className="ml-2 text-xs text-cyan-400">(Global)</span>
                      )}
                      {collection.description && (
                        <p className="text-xs text-slate-400">{collection.description}</p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          ))}

          {renderSection('templates', 'Prompt Templates', (
            <div className="space-y-2">
              {promptTemplates.length === 0 ? (
                <p className="text-slate-400 text-sm">
                  No prompt templates available. Create one in the Prompts tab.
                </p>
              ) : (
                promptTemplates.map((template) => (
                  <label
                    key={template.id}
                    className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPrompts.includes(template.id)}
                      onChange={() => togglePrompt(template.id)}
                      className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                    />
                    <div>
                      <span className="text-slate-300">{template.name}</span>
                      <span className="ml-2 text-xs text-slate-500 capitalize">
                        {template.category.replace('_', ' ')}
                      </span>
                    </div>
                  </label>
                ))
              )}
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : agent ? 'Save Changes' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}
