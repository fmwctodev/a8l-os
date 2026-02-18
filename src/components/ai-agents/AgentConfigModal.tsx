import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createAgent, updateAgent } from '../../services/aiAgents';
import { TOOL_DEFINITIONS } from '../../services/aiAgentTools';
import type { AIAgent, AIAgentToolName, AIAgentChannel, AIAgentType } from '../../types';
import {
  X,
  Loader2,
  Bot,
  FileText,
  Wrench,
  MessageSquare,
  Settings,
  Mail,
  Check,
  Info,
  Mic,
  Volume2,
} from 'lucide-react';

interface AgentConfigModalProps {
  agent: AIAgent | null;
  defaultAgentType?: AIAgentType;
  onClose: () => void;
  onSuccess: () => void;
}

type TabId = 'basic' | 'prompt' | 'tools' | 'channels' | 'settings';

const TABS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: 'basic', label: 'Basic Info', icon: Bot },
  { id: 'prompt', label: 'System Prompt', icon: FileText },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'channels', label: 'Channels', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const TOOL_CATEGORIES: { name: string; label: string; tools: AIAgentToolName[] }[] = [
  {
    name: 'read',
    label: 'CRM Read',
    tools: ['get_contact', 'get_timeline', 'get_conversation_history', 'get_appointment_history'],
  },
  {
    name: 'write',
    label: 'CRM Write',
    tools: ['add_note', 'update_field', 'add_tag', 'remove_tag', 'assign_owner'],
  },
  {
    name: 'calendar',
    label: 'Calendar',
    tools: ['create_appointment'],
  },
  {
    name: 'communication',
    label: 'Communication',
    tools: ['send_sms', 'send_email'],
  },
];

const CHANNEL_OPTIONS: { id: AIAgentChannel; label: string; description: string; icon: typeof MessageSquare }[] = [
  { id: 'sms', label: 'SMS', description: 'Allow agent to draft SMS messages', icon: MessageSquare },
  { id: 'email', label: 'Email', description: 'Allow agent to draft email messages', icon: Mail },
  { id: 'internal_note', label: 'Internal Note', description: 'Allow agent to create internal notes only', icon: FileText },
];

const MERGE_FIELDS = [
  '{{contact.first_name}}',
  '{{contact.last_name}}',
  '{{contact.email}}',
  '{{contact.phone}}',
  '{{contact.company}}',
  '{{contact.job_title}}',
  '{{contact.tags}}',
  '{{contact.owner_name}}',
  '{{memory.key_facts}}',
  '{{memory.lead_stage}}',
  '{{memory.conversation_summary}}',
];

export function AgentConfigModal({ agent, defaultAgentType, onClose, onSuccess }: AgentConfigModalProps) {
  const { user: currentUser } = useAuth();
  const isEditing = !!agent;

  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || getDefaultSystemPrompt());
  const [allowedTools, setAllowedTools] = useState<AIAgentToolName[]>(
    (agent?.allowed_tools as AIAgentToolName[]) || ['get_contact', 'get_timeline', 'get_conversation_history']
  );
  const [allowedChannels, setAllowedChannels] = useState<AIAgentChannel[]>(
    (agent?.allowed_channels as AIAgentChannel[]) || ['internal_note']
  );
  const [temperature, setTemperature] = useState(agent?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(agent?.max_tokens ?? 1024);
  const [enabled, setEnabled] = useState(agent?.enabled ?? true);
  const [agentType, setAgentType] = useState<AIAgentType>(
    agent?.agent_type || defaultAgentType || 'conversation'
  );

  const [voiceProvider, setVoiceProvider] = useState(agent?.voice_provider || 'elevenlabs');
  const [voiceId, setVoiceId] = useState(agent?.voice_id || '');
  const [speakingSpeed, setSpeakingSpeed] = useState(agent?.speaking_speed ?? 1.0);
  const [voiceTone, setVoiceTone] = useState(agent?.voice_tone || '');

  const [requiresApproval, setRequiresApproval] = useState(agent?.requires_approval ?? false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(agent?.auto_reply_enabled ?? false);
  const [cooldownMinutes, setCooldownMinutes] = useState(agent?.cooldown_minutes ?? 5);
  const [maxMessagesPerDay, setMaxMessagesPerDay] = useState(agent?.max_messages_per_day ?? 50);

  const handleToolToggle = (tool: AIAgentToolName) => {
    setAllowedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const handleCategoryToggle = (tools: AIAgentToolName[], selected: boolean) => {
    if (selected) {
      setAllowedTools((prev) => [...new Set([...prev, ...tools])]);
    } else {
      setAllowedTools((prev) => prev.filter((t) => !tools.includes(t)));
    }
  };

  const handleChannelToggle = (channel: AIAgentChannel) => {
    setAllowedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const insertMergeField = (field: string) => {
    setSystemPrompt((prev) => prev + field);
  };

  const validateForm = (): string | null => {
    if (!name.trim()) return 'Name is required';
    if (name.length > 100) return 'Name must be less than 100 characters';
    if (!systemPrompt.trim()) return 'System prompt is required';
    if (allowedTools.length === 0) return 'At least one tool must be selected';
    if (allowedChannels.length === 0) return 'At least one channel must be selected';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!currentUser?.organization_id) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        system_prompt: systemPrompt.trim(),
        allowed_tools: allowedTools,
        allowed_channels: allowedChannels,
        temperature,
        max_tokens: maxTokens,
        enabled,
        agent_type: agentType,
        voice_provider: agentType === 'voice' ? voiceProvider : null,
        voice_id: agentType === 'voice' ? (voiceId.trim() || null) : null,
        speaking_speed: agentType === 'voice' ? speakingSpeed : null,
        voice_tone: agentType === 'voice' ? (voiceTone.trim() || null) : null,
        requires_approval: agentType === 'conversation' ? requiresApproval : false,
        auto_reply_enabled: agentType === 'conversation' ? autoReplyEnabled : false,
        cooldown_minutes: agentType === 'conversation' ? cooldownMinutes : null,
        max_messages_per_day: agentType === 'conversation' ? maxMessagesPerDay : null,
      };

      if (isEditing) {
        await updateAgent(agent.id, payload);
      } else {
        await createAgent(currentUser.organization_id, payload, currentUser.id);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center">
              {agentType === 'voice' ? (
                <Mic className="w-5 h-5 text-cyan-400" />
              ) : (
                <Bot className="w-5 h-5 text-cyan-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isEditing ? 'Edit AI Agent' : 'Create AI Agent'}
              </h2>
              <p className="text-sm text-slate-400">
                {isEditing ? 'Modify agent configuration' : 'Configure your new AI assistant'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex border-b border-slate-800 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {activeTab === 'basic' && (
            <BasicInfoTab
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
              enabled={enabled}
              setEnabled={setEnabled}
              agentType={agentType}
              setAgentType={setAgentType}
              isEditing={isEditing}
            />
          )}

          {activeTab === 'prompt' && (
            <SystemPromptTab
              systemPrompt={systemPrompt}
              setSystemPrompt={setSystemPrompt}
              insertMergeField={insertMergeField}
            />
          )}

          {activeTab === 'tools' && (
            <ToolsTab
              allowedTools={allowedTools}
              handleToolToggle={handleToolToggle}
              handleCategoryToggle={handleCategoryToggle}
            />
          )}

          {activeTab === 'channels' && (
            <ChannelsTab
              allowedChannels={allowedChannels}
              handleChannelToggle={handleChannelToggle}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              temperature={temperature}
              setTemperature={setTemperature}
              maxTokens={maxTokens}
              setMaxTokens={setMaxTokens}
              agentType={agentType}
              voiceProvider={voiceProvider}
              setVoiceProvider={setVoiceProvider}
              voiceId={voiceId}
              setVoiceId={setVoiceId}
              speakingSpeed={speakingSpeed}
              setSpeakingSpeed={setSpeakingSpeed}
              voiceTone={voiceTone}
              setVoiceTone={setVoiceTone}
              requiresApproval={requiresApproval}
              setRequiresApproval={setRequiresApproval}
              autoReplyEnabled={autoReplyEnabled}
              setAutoReplyEnabled={setAutoReplyEnabled}
              cooldownMinutes={cooldownMinutes}
              setCooldownMinutes={setCooldownMinutes}
              maxMessagesPerDay={maxMessagesPerDay}
              setMaxMessagesPerDay={setMaxMessagesPerDay}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BasicInfoTab({
  name, setName, description, setDescription, enabled, setEnabled,
  agentType, setAgentType, isEditing,
}: {
  name: string; setName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  enabled: boolean; setEnabled: (v: boolean) => void;
  agentType: AIAgentType; setAgentType: (v: AIAgentType) => void;
  isEditing: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Agent Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAgentType('conversation')}
            className={`p-4 rounded-lg border text-left transition-all ${
              agentType === 'conversation'
                ? 'bg-cyan-500/10 border-cyan-500/30'
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                agentType === 'conversation' ? 'bg-cyan-500/20' : 'bg-slate-700'
              }`}>
                <MessageSquare className={`w-5 h-5 ${agentType === 'conversation' ? 'text-cyan-400' : 'text-slate-400'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Conversation</p>
                <p className="text-xs text-slate-400">SMS, email, web chat</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setAgentType('voice')}
            className={`p-4 rounded-lg border text-left transition-all ${
              agentType === 'voice'
                ? 'bg-cyan-500/10 border-cyan-500/30'
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                agentType === 'voice' ? 'bg-cyan-500/20' : 'bg-slate-700'
              }`}>
                <Mic className={`w-5 h-5 ${agentType === 'voice' ? 'text-cyan-400' : 'text-slate-400'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Voice</p>
                <p className="text-xs text-slate-400">Phone calls</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Agent Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="e.g., Lead Qualification Agent"
          className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-slate-500">{name.length}/100 characters</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Describe what this agent does..."
          className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
        />
        <p className="mt-1 text-xs text-slate-500">{description.length}/500 characters</p>
      </div>

      <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
        <div>
          <p className="text-sm font-medium text-white">Agent Status</p>
          <p className="text-xs text-slate-400">Enable or disable this agent</p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            enabled ? 'bg-cyan-500' : 'bg-slate-700'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              enabled ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function SystemPromptTab({
  systemPrompt, setSystemPrompt, insertMergeField,
}: {
  systemPrompt: string; setSystemPrompt: (v: string) => void;
  insertMergeField: (field: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          System Prompt <span className="text-red-400">*</span>
        </label>
        <p className="text-xs text-slate-400 mb-3">
          Instructions that define how the AI agent behaves and responds. Use merge fields to include contact data.
        </p>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={16}
          placeholder="Enter system prompt instructions..."
          className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none font-mono text-sm"
        />
      </div>

      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
        <p className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400" />
          Available Merge Fields
        </p>
        <div className="flex flex-wrap gap-2">
          {MERGE_FIELDS.map((field) => (
            <button
              key={field}
              onClick={() => insertMergeField(field)}
              className="px-2 py-1 rounded bg-slate-700 text-xs text-slate-300 hover:bg-slate-600 font-mono transition-colors"
            >
              {field}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolsTab({
  allowedTools, handleToolToggle, handleCategoryToggle,
}: {
  allowedTools: AIAgentToolName[];
  handleToolToggle: (tool: AIAgentToolName) => void;
  handleCategoryToggle: (tools: AIAgentToolName[], selected: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Select which tools this agent can use. Read tools gather information, write tools modify CRM data, and communication tools draft messages for approval.
      </p>

      {TOOL_CATEGORIES.map((category) => {
        const allSelected = category.tools.every((t) => allowedTools.includes(t));

        return (
          <div key={category.name} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">{category.label}</h3>
              <button
                onClick={() => handleCategoryToggle(category.tools, !allSelected)}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {category.tools.map((tool) => {
                const def = TOOL_DEFINITIONS[tool];
                const isSelected = allowedTools.includes(tool);

                return (
                  <button
                    key={tool}
                    onClick={() => handleToolToggle(tool)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-cyan-500' : 'bg-slate-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{def.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                          {def.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChannelsTab({
  allowedChannels, handleChannelToggle,
}: {
  allowedChannels: AIAgentChannel[];
  handleChannelToggle: (channel: AIAgentChannel) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-sm text-amber-400">
          All SMS and email communications require explicit user approval before sending. The agent will create drafts that must be reviewed and accepted.
        </p>
      </div>

      <div className="space-y-3">
        {CHANNEL_OPTIONS.map((channel) => {
          const isSelected = allowedChannels.includes(channel.id);
          const Icon = channel.icon;

          return (
            <button
              key={channel.id}
              onClick={() => handleChannelToggle(channel.id)}
              className={`w-full p-4 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'bg-cyan-500/10 border-cyan-500/30'
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-cyan-500/20' : 'bg-slate-700'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{channel.label}</p>
                  <p className="text-xs text-slate-400">{channel.description}</p>
                </div>
                <div
                  className={`w-6 h-6 rounded flex items-center justify-center ${
                    isSelected ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        enabled ? 'bg-cyan-500' : 'bg-slate-700'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  );
}

function SettingsTab({
  temperature, setTemperature, maxTokens, setMaxTokens,
  agentType,
  voiceProvider, setVoiceProvider, voiceId, setVoiceId,
  speakingSpeed, setSpeakingSpeed, voiceTone, setVoiceTone,
  requiresApproval, setRequiresApproval,
  autoReplyEnabled, setAutoReplyEnabled,
  cooldownMinutes, setCooldownMinutes,
  maxMessagesPerDay, setMaxMessagesPerDay,
}: {
  temperature: number; setTemperature: (v: number) => void;
  maxTokens: number; setMaxTokens: (v: number) => void;
  agentType: AIAgentType;
  voiceProvider: string; setVoiceProvider: (v: string) => void;
  voiceId: string; setVoiceId: (v: string) => void;
  speakingSpeed: number; setSpeakingSpeed: (v: number) => void;
  voiceTone: string; setVoiceTone: (v: string) => void;
  requiresApproval: boolean; setRequiresApproval: (v: boolean) => void;
  autoReplyEnabled: boolean; setAutoReplyEnabled: (v: boolean) => void;
  cooldownMinutes: number; setCooldownMinutes: (v: number) => void;
  maxMessagesPerDay: number; setMaxMessagesPerDay: (v: number) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Model Settings</h3>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Temperature: {temperature}
          </label>
          <p className="text-xs text-slate-400 mb-3">
            Controls creativity. Lower values (0.1-0.3) for more focused responses, higher values (0.7-1.0) for more creative responses.
          </p>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Focused (0)</span>
            <span>Creative (1)</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Max Tokens: {maxTokens}
          </label>
          <p className="text-xs text-slate-400 mb-3">
            Maximum length of the AI response. Higher values allow longer responses but increase cost.
          </p>
          <input
            type="range"
            min="128"
            max="4096"
            step="128"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Short (128)</span>
            <span>Long (4096)</span>
          </div>
        </div>
      </div>

      {agentType === 'voice' && (
        <div className="space-y-6 pt-6 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            Voice Configuration
          </h3>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Voice Provider</label>
            <select
              value={voiceProvider}
              onChange={(e) => setVoiceProvider(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="elevenlabs">ElevenLabs</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Voice ID</label>
            <input
              type="text"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="e.g., 21m00Tcm4TlvDq8ikWAM"
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-500">Enter the voice ID from your provider</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Speaking Speed: {speakingSpeed.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speakingSpeed}
              onChange={(e) => setSpeakingSpeed(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Slow (0.5x)</span>
              <span>Normal (1.0x)</span>
              <span>Fast (2.0x)</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Voice Tone</label>
            <input
              type="text"
              value={voiceTone}
              onChange={(e) => setVoiceTone(e.target.value)}
              placeholder="e.g., Warm and professional"
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-500">Describe the desired tone for this agent</p>
          </div>
        </div>
      )}

      {agentType === 'conversation' && (
        <div className="space-y-6 pt-6 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            Conversation Rules
          </h3>

          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <div>
              <p className="text-sm font-medium text-white">Auto-Reply</p>
              <p className="text-xs text-slate-400">Automatically send replies without manual approval</p>
            </div>
            <ToggleSwitch enabled={autoReplyEnabled} onToggle={() => setAutoReplyEnabled(!autoReplyEnabled)} />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <div>
              <p className="text-sm font-medium text-white">Require Approval</p>
              <p className="text-xs text-slate-400">All drafts must be approved before sending</p>
            </div>
            <ToggleSwitch enabled={requiresApproval} onToggle={() => setRequiresApproval(!requiresApproval)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Cooldown Period (minutes)
            </label>
            <p className="text-xs text-slate-400 mb-3">
              Minimum time between automated messages to the same contact.
            </p>
            <input
              type="number"
              min="0"
              max="1440"
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Max Messages Per Day
            </label>
            <p className="text-xs text-slate-400 mb-3">
              Maximum number of automated messages this agent can send per day.
            </p>
            <input
              type="number"
              min="1"
              max="1000"
              value={maxMessagesPerDay}
              onChange={(e) => setMaxMessagesPerDay(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultSystemPrompt(): string {
  return `You are a helpful AI assistant analyzing CRM contacts and their interactions.

Your role is to:
1. Gather and analyze contact information using the available tools
2. Review conversation history and timeline events
3. Make assessments about the contact's status, interests, and needs
4. Take appropriate actions like adding notes, updating fields, or tagging contacts
5. Draft professional messages when communication is needed

Guidelines:
- Always be professional and helpful
- Base your decisions on the data you gather from the CRM
- When drafting messages, be concise and personalized
- Update contact memory with key facts you learn
- If unsure about something, gather more information before acting

Remember: All outbound messages (SMS/Email) will be reviewed by a team member before sending.`;
}
