import { useState, useEffect } from 'react';
import {
  Bot,
  Brain,
  MessageSquare,
  Mail,
  Clock,
  Target,
  Calendar,
  GitBranch,
  Shield,
  AlertTriangle,
  Settings,
  ChevronDown,
  ChevronUp,
  Info,
  Zap,
} from 'lucide-react';
import type {
  AIWorkflowActionType,
  AIActionConfig,
  AIActionInputContext,
  AIActionGuardrailConfig,
  AIActionRetryConfig,
  AIOutputMode,
  AIResponseStyle,
  AIFallbackBehavior,
  DEFAULT_AI_INPUT_CONTEXT,
  DEFAULT_AI_GUARDRAILS,
  DEFAULT_AI_RETRY,
} from '../../types';
import { supabase } from '../../lib/supabase';

interface AIActionConfigPanelProps {
  actionType: AIWorkflowActionType;
  config: Partial<AIActionConfig>;
  onChange: (config: Partial<AIActionConfig>) => void;
  canEdit: boolean;
}

interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  temperature: number;
  enabled: boolean;
  allowed_channels: string[];
}

const ACTION_TYPE_INFO: Record<AIWorkflowActionType, { label: string; description: string; icon: typeof Bot }> = {
  ai_conversation_reply: {
    label: 'AI Conversation Reply',
    description: 'Generate a contextual reply to the current conversation',
    icon: MessageSquare,
  },
  ai_email_draft: {
    label: 'AI Email Draft',
    description: 'Create a professional email draft with AI assistance',
    icon: Mail,
  },
  ai_follow_up_message: {
    label: 'AI Follow-up Message',
    description: 'Generate a follow-up message based on interaction history',
    icon: Clock,
  },
  ai_lead_qualification: {
    label: 'AI Lead Qualification',
    description: 'Analyze and qualify leads based on conversation context',
    icon: Target,
  },
  ai_booking_assist: {
    label: 'AI Booking Assistant',
    description: 'Help contacts book appointments with suggested times',
    icon: Calendar,
  },
  ai_decision_step: {
    label: 'AI Decision Step',
    description: 'Make intelligent routing decisions based on context',
    icon: GitBranch,
  },
};

const OUTPUT_MODES: { value: AIOutputMode; label: string; description: string }[] = [
  { value: 'generate_draft', label: 'Generate Draft (Recommended)', description: 'Creates a draft for human review before sending' },
  { value: 'auto_send', label: 'Auto-send', description: 'Sends the message automatically without approval' },
  { value: 'generate_and_branch', label: 'Generate & Branch', description: 'For qualification/decision, routes to different branches' },
];

const RESPONSE_STYLES: { value: AIResponseStyle; label: string }[] = [
  { value: 'concise', label: 'Concise - Short and direct' },
  { value: 'normal', label: 'Normal - Balanced' },
  { value: 'detailed', label: 'Detailed - Comprehensive' },
];

const FALLBACK_OPTIONS: { value: AIFallbackBehavior; label: string }[] = [
  { value: 'notify_staff', label: 'Notify staff member' },
  { value: 'send_template', label: 'Send fallback template' },
  { value: 'route_to_human', label: 'Route to human agent' },
  { value: 'stop_workflow', label: 'Stop workflow' },
];

export function AIActionConfigPanel({
  actionType,
  config,
  onChange,
  canEdit,
}: AIActionConfigPanelProps) {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    agent: true,
    context: false,
    output: true,
    guardrails: false,
    retry: false,
    typeSpecific: true,
  });

  const actionInfo = ACTION_TYPE_INFO[actionType];
  const Icon = actionInfo.icon;

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, description, temperature, enabled, allowed_channels')
        .eq('enabled', true)
        .order('name');

      if (!error && data) {
        setAgents(data);
      }
    } catch (e) {
      console.error('Failed to load agents:', e);
    } finally {
      setLoadingAgents(false);
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateConfig = (updates: Partial<AIActionConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updateInputContext = (updates: Partial<AIActionInputContext>) => {
    onChange({
      ...config,
      inputContext: { ...getInputContext(), ...updates },
    });
  };

  const updateGuardrails = (updates: Partial<AIActionGuardrailConfig>) => {
    onChange({
      ...config,
      guardrails: { ...getGuardrails(), ...updates },
    });
  };

  const updateRetry = (updates: Partial<AIActionRetryConfig>) => {
    onChange({
      ...config,
      retry: { ...getRetry(), ...updates },
    });
  };

  const getInputContext = (): AIActionInputContext => ({
    includeLatestMessage: config.inputContext?.includeLatestMessage ?? true,
    threadWindowSize: config.inputContext?.threadWindowSize ?? 10,
    includeContactProfile: config.inputContext?.includeContactProfile ?? true,
    includeOpportunityContext: config.inputContext?.includeOpportunityContext ?? false,
    includeAppointmentContext: config.inputContext?.includeAppointmentContext ?? false,
    includeRecentTimeline: config.inputContext?.includeRecentTimeline ?? true,
    includeCustomFields: config.inputContext?.includeCustomFields ?? true,
    includePreviousAIOutputs: config.inputContext?.includePreviousAIOutputs ?? true,
  });

  const getGuardrails = (): AIActionGuardrailConfig => ({
    requireApproval: config.guardrails?.requireApproval ?? true,
    blockSensitiveClaims: config.guardrails?.blockSensitiveClaims ?? true,
    profanityFilter: config.guardrails?.profanityFilter ?? true,
    piiRedaction: config.guardrails?.piiRedaction ?? true,
    quietHoursEnabled: config.guardrails?.quietHoursEnabled ?? false,
    quietHoursStart: config.guardrails?.quietHoursStart,
    quietHoursEnd: config.guardrails?.quietHoursEnd,
    maxMessageLength: config.guardrails?.maxMessageLength,
    disallowedDomains: config.guardrails?.disallowedDomains,
  });

  const getRetry = (): AIActionRetryConfig => ({
    retryCount: config.retry?.retryCount ?? 2,
    retryDelayMs: config.retry?.retryDelayMs ?? 5000,
    fallbackBehavior: config.retry?.fallbackBehavior ?? 'notify_staff',
    fallbackTemplateId: config.retry?.fallbackTemplateId,
  });

  const inputContext = getInputContext();
  const guardrails = getGuardrails();
  const retry = getRetry();

  const selectedAgent = agents.find((a) => a.id === config.agentId);

  const estimatedTokens = calculateTokenEstimate(inputContext);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="p-2 rounded-lg bg-cyan-500/20">
          <Icon className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">{actionInfo.label}</div>
          <div className="text-xs text-slate-400 mt-0.5">{actionInfo.description}</div>
        </div>
      </div>

      <CollapsibleSection
        title="Agent Selection"
        icon={Bot}
        expanded={expandedSections.agent}
        onToggle={() => toggleSection('agent')}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              AI Agent
            </label>
            {loadingAgents ? (
              <div className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-sm">
                Loading agents...
              </div>
            ) : (
              <select
                value={config.agentId || ''}
                onChange={(e) => updateConfig({ agentId: e.target.value })}
                disabled={!canEdit}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              >
                <option value="">Select an agent...</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedAgent && (
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span>Temperature: {selectedAgent.temperature}</span>
                <span className="text-emerald-400">Active</span>
              </div>
              {selectedAgent.description && (
                <p className="text-slate-500 mt-1">{selectedAgent.description}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <ToggleOption
              label="Use Agent Memory"
              description="Include agent's memory of this contact"
              checked={config.useAgentMemory ?? true}
              onChange={(v) => updateConfig({ useAgentMemory: v })}
              disabled={!canEdit}
            />
            <ToggleOption
              label="Use Global Knowledge"
              description="Include knowledge base content"
              checked={config.useGlobalKnowledge ?? true}
              onChange={(v) => updateConfig({ useGlobalKnowledge: v })}
              disabled={!canEdit}
            />
            <ToggleOption
              label="Use Brandboard"
              description="Apply brand voice and guidelines"
              checked={config.useBrandboard ?? true}
              onChange={(v) => updateConfig({ useBrandboard: v })}
              disabled={!canEdit}
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Input Context"
        icon={Brain}
        expanded={expandedSections.context}
        onToggle={() => toggleSection('context')}
        badge={`~${estimatedTokens} tokens`}
      >
        <div className="space-y-3">
          <ToggleOption
            label="Include Latest Messages"
            description="Add recent conversation messages"
            checked={inputContext.includeLatestMessage}
            onChange={(v) => updateInputContext({ includeLatestMessage: v })}
            disabled={!canEdit}
          />

          {inputContext.includeLatestMessage && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Message Window Size
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={inputContext.threadWindowSize}
                onChange={(e) => updateInputContext({ threadWindowSize: parseInt(e.target.value) })}
                disabled={!canEdit}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>1</span>
                <span>{inputContext.threadWindowSize} messages</span>
                <span>50</span>
              </div>
            </div>
          )}

          <ToggleOption
            label="Include Contact Profile"
            description="Add contact details and tags"
            checked={inputContext.includeContactProfile}
            onChange={(v) => updateInputContext({ includeContactProfile: v })}
            disabled={!canEdit}
          />

          <ToggleOption
            label="Include Opportunity Context"
            description="Add active opportunity details"
            checked={inputContext.includeOpportunityContext}
            onChange={(v) => updateInputContext({ includeOpportunityContext: v })}
            disabled={!canEdit}
          />

          <ToggleOption
            label="Include Appointment Context"
            description="Add upcoming appointments"
            checked={inputContext.includeAppointmentContext}
            onChange={(v) => updateInputContext({ includeAppointmentContext: v })}
            disabled={!canEdit}
          />

          <ToggleOption
            label="Include Custom Fields"
            description="Add contact custom field values"
            checked={inputContext.includeCustomFields}
            onChange={(v) => updateInputContext({ includeCustomFields: v })}
            disabled={!canEdit}
          />

          <ToggleOption
            label="Include Previous AI Outputs"
            description="Reference earlier AI actions in workflow"
            checked={inputContext.includePreviousAIOutputs}
            onChange={(v) => updateInputContext({ includePreviousAIOutputs: v })}
            disabled={!canEdit}
          />

          <div className="mt-3 p-2 rounded bg-slate-800/50 border border-slate-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Estimated context size</span>
              <span className={estimatedTokens > 3000 ? 'text-amber-400' : 'text-emerald-400'}>
                ~{estimatedTokens} tokens
              </span>
            </div>
            <div className="mt-1.5 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  estimatedTokens > 3000 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min((estimatedTokens / 4000) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Output Mode"
        icon={Zap}
        expanded={expandedSections.output}
        onToggle={() => toggleSection('output')}
      >
        <div className="space-y-3">
          {OUTPUT_MODES.map((mode) => {
            const isSelected = (config.outputMode || 'generate_draft') === mode.value;
            const isBranchingAction = actionType === 'ai_lead_qualification' || actionType === 'ai_decision_step';
            const isDisabled = mode.value === 'generate_and_branch' && !isBranchingAction;

            return (
              <button
                key={mode.value}
                onClick={() => !isDisabled && canEdit && updateConfig({ outputMode: mode.value })}
                disabled={!canEdit || isDisabled}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : isDisabled
                    ? 'border-slate-800 bg-slate-900/50 opacity-50'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                } ${!canEdit || isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                    isSelected ? 'border-cyan-500 bg-cyan-500' : 'border-slate-600'
                  }`}
                >
                  {isSelected && <div className="w-full h-full rounded-full bg-white scale-50" />}
                </div>
                <div>
                  <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {mode.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{mode.description}</div>
                </div>
              </button>
            );
          })}

          {config.outputMode === 'auto_send' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200">
                Auto-send will deliver messages without human review. Use with caution.
              </p>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Type-Specific Settings"
        icon={Settings}
        expanded={expandedSections.typeSpecific}
        onToggle={() => toggleSection('typeSpecific')}
      >
        {actionType === 'ai_conversation_reply' && (
          <ConversationReplySettings config={config} onChange={updateConfig} canEdit={canEdit} />
        )}
        {actionType === 'ai_email_draft' && (
          <EmailDraftSettings config={config} onChange={updateConfig} canEdit={canEdit} />
        )}
        {actionType === 'ai_follow_up_message' && (
          <FollowUpSettings config={config} onChange={updateConfig} canEdit={canEdit} />
        )}
        {actionType === 'ai_lead_qualification' && (
          <QualificationSettings config={config} onChange={updateConfig} canEdit={canEdit} />
        )}
        {actionType === 'ai_booking_assist' && (
          <BookingAssistSettings config={config} onChange={updateConfig} canEdit={canEdit} />
        )}
        {actionType === 'ai_decision_step' && (
          <DecisionStepSettings config={config} onChange={updateConfig} canEdit={canEdit} />
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Safety & Guardrails"
        icon={Shield}
        expanded={expandedSections.guardrails}
        onToggle={() => toggleSection('guardrails')}
      >
        <div className="space-y-3">
          <ToggleOption
            label="Require Human Approval"
            description="Draft requires approval before sending"
            checked={guardrails.requireApproval}
            onChange={(v) => updateGuardrails({ requireApproval: v })}
            disabled={!canEdit}
          />

          <ToggleOption
            label="Block Sensitive Claims"
            description="Prevent promises, guarantees, legal statements"
            checked={guardrails.blockSensitiveClaims}
            onChange={(v) => updateGuardrails({ blockSensitiveClaims: v })}
            disabled={!canEdit}
          />

          <ToggleOption
            label="Profanity Filter"
            description="Block content with inappropriate language"
            checked={guardrails.profanityFilter}
            onChange={(v) => updateGuardrails({ profanityFilter: v })}
            disabled={!canEdit}
          />

          <ToggleOption
            label="PII Redaction in Logs"
            description="Remove sensitive data from audit logs"
            checked={guardrails.piiRedaction}
            onChange={(v) => updateGuardrails({ piiRedaction: v })}
            disabled={!canEdit}
          />

          <ToggleOption
            label="Enable Quiet Hours"
            description="Block sends during specified hours"
            checked={guardrails.quietHoursEnabled}
            onChange={(v) => updateGuardrails({ quietHoursEnabled: v })}
            disabled={!canEdit}
          />

          {guardrails.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Start</label>
                <input
                  type="time"
                  value={guardrails.quietHoursStart || '21:00'}
                  onChange={(e) => updateGuardrails({ quietHoursStart: e.target.value })}
                  disabled={!canEdit}
                  className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">End</label>
                <input
                  type="time"
                  value={guardrails.quietHoursEnd || '08:00'}
                  onChange={(e) => updateGuardrails({ quietHoursEnd: e.target.value })}
                  disabled={!canEdit}
                  className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-white text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Retry & Fallback"
        icon={AlertTriangle}
        expanded={expandedSections.retry}
        onToggle={() => toggleSection('retry')}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Retry Attempts
            </label>
            <input
              type="number"
              min="0"
              max="5"
              value={retry.retryCount}
              onChange={(e) => updateRetry({ retryCount: parseInt(e.target.value) || 0 })}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Retry Delay (ms)
            </label>
            <input
              type="number"
              min="1000"
              max="60000"
              step="1000"
              value={retry.retryDelayMs}
              onChange={(e) => updateRetry({ retryDelayMs: parseInt(e.target.value) || 5000 })}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Fallback Behavior
            </label>
            <select
              value={retry.fallbackBehavior}
              onChange={(e) => updateRetry({ fallbackBehavior: e.target.value as AIFallbackBehavior })}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
            >
              {FALLBACK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  expanded,
  onToggle,
  badge,
  children,
}: {
  title: string;
  icon: typeof Bot;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-white">{title}</span>
          {badge && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-300">
              {badge}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {expanded && <div className="p-3 border-t border-slate-700">{children}</div>}
    </div>
  );
}

function ToggleOption({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
      />
      <div>
        <div className="text-sm text-white">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
    </label>
  );
}

function ConversationReplySettings({
  config,
  onChange,
  canEdit,
}: {
  config: Partial<AIActionConfig>;
  onChange: (updates: Partial<AIActionConfig>) => void;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Channel</label>
        <select
          value={(config as { channel?: string }).channel || 'sms'}
          onChange={(e) => onChange({ channel: e.target.value } as Partial<AIActionConfig>)}
          disabled={!canEdit}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
        >
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Response Style</label>
        <select
          value={(config as { responseStyle?: string }).responseStyle || 'normal'}
          onChange={(e) => onChange({ responseStyle: e.target.value } as Partial<AIActionConfig>)}
          disabled={!canEdit}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
        >
          {RESPONSE_STYLES.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
      </div>

      <ToggleOption
        label="Allow Questions"
        description="AI can ask clarifying questions"
        checked={(config as { allowQuestions?: boolean }).allowQuestions ?? true}
        onChange={(v) => onChange({ allowQuestions: v } as Partial<AIActionConfig>)}
        disabled={!canEdit}
      />

      <ToggleOption
        label="Include Booking CTA"
        description="Add calendar booking link when appropriate"
        checked={(config as { includeBookingCTA?: boolean }).includeBookingCTA ?? false}
        onChange={(v) => onChange({ includeBookingCTA: v } as Partial<AIActionConfig>)}
        disabled={!canEdit}
      />
    </div>
  );
}

function EmailDraftSettings({
  config,
  onChange,
  canEdit,
}: {
  config: Partial<AIActionConfig>;
  onChange: (updates: Partial<AIActionConfig>) => void;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <ToggleOption
        label="Use Template Wrapper"
        description="Wrap content in email template"
        checked={(config as { useTemplateWrapper?: boolean }).useTemplateWrapper ?? false}
        onChange={(v) => onChange({ useTemplateWrapper: v } as Partial<AIActionConfig>)}
        disabled={!canEdit}
      />

      <ToggleOption
        label="Include Signature"
        description="Add email signature"
        checked={(config as { includeSignature?: boolean }).includeSignature ?? true}
        onChange={(v) => onChange({ includeSignature: v } as Partial<AIActionConfig>)}
        disabled={!canEdit}
      />

      <ToggleOption
        label="Generate Preheader"
        description="Create email preview text"
        checked={(config as { generatePreheader?: boolean }).generatePreheader ?? true}
        onChange={(v) => onChange({ generatePreheader: v } as Partial<AIActionConfig>)}
        disabled={!canEdit}
      />
    </div>
  );
}

function FollowUpSettings({
  config,
  onChange,
  canEdit,
}: {
  config: Partial<AIActionConfig>;
  onChange: (updates: Partial<AIActionConfig>) => void;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Channel</label>
        <select
          value={(config as { channel?: string }).channel || 'sms'}
          onChange={(e) => onChange({ channel: e.target.value } as Partial<AIActionConfig>)}
          disabled={!canEdit}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
        >
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Sequence Mode</label>
        <select
          value={(config as { sequenceMode?: string }).sequenceMode || 'single'}
          onChange={(e) => onChange({ sequenceMode: e.target.value } as Partial<AIActionConfig>)}
          disabled={!canEdit}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
        >
          <option value="single">Single message</option>
          <option value="multi_step">Multi-step sequence</option>
        </select>
      </div>

      {(config as { sequenceMode?: string }).sequenceMode === 'multi_step' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Max Steps</label>
          <input
            type="number"
            min="2"
            max="5"
            value={(config as { maxSequenceSteps?: number }).maxSequenceSteps || 3}
            onChange={(e) =>
              onChange({ maxSequenceSteps: parseInt(e.target.value) || 3 } as Partial<AIActionConfig>)
            }
            disabled={!canEdit}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
          />
        </div>
      )}
    </div>
  );
}

function QualificationSettings({
  config,
  onChange,
  canEdit,
}: {
  config: Partial<AIActionConfig>;
  onChange: (updates: Partial<AIActionConfig>) => void;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Confidence Threshold
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={((config as { confidenceThreshold?: number }).confidenceThreshold || 0.7) * 100}
          onChange={(e) =>
            onChange({ confidenceThreshold: parseInt(e.target.value) / 100 } as Partial<AIActionConfig>)
          }
          disabled={!canEdit}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>0%</span>
          <span>
            {Math.round(((config as { confidenceThreshold?: number }).confidenceThreshold || 0.7) * 100)}%
          </span>
          <span>100%</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Manual Review Threshold
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={((config as { manualReviewThreshold?: number }).manualReviewThreshold || 0.5) * 100}
          onChange={(e) =>
            onChange({ manualReviewThreshold: parseInt(e.target.value) / 100 } as Partial<AIActionConfig>)
          }
          disabled={!canEdit}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>0%</span>
          <span>
            {Math.round(
              ((config as { manualReviewThreshold?: number }).manualReviewThreshold || 0.5) * 100
            )}
            %
          </span>
          <span>100%</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Below this threshold, leads route to manual_review branch
        </p>
      </div>

      <ToggleOption
        label="Auto-Tag Results"
        description="Add qualification label as contact tag"
        checked={(config as { autoTagResults?: boolean }).autoTagResults ?? true}
        onChange={(v) => onChange({ autoTagResults: v } as Partial<AIActionConfig>)}
        disabled={!canEdit}
      />

      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="text-xs font-medium text-slate-300 mb-2">Output Branches</div>
        <div className="flex flex-wrap gap-1">
          {['hot', 'warm', 'cold', 'disqualified', 'manual_review'].map((branch) => (
            <span
              key={branch}
              className="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300"
            >
              {branch}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingAssistSettings({
  config,
  onChange,
  canEdit,
}: {
  config: Partial<AIActionConfig>;
  onChange: (updates: Partial<AIActionConfig>) => void;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Suggested Slots</label>
        <input
          type="number"
          min="1"
          max="5"
          value={(config as { suggestedSlotCount?: number }).suggestedSlotCount || 3}
          onChange={(e) =>
            onChange({ suggestedSlotCount: parseInt(e.target.value) || 3 } as Partial<AIActionConfig>)
          }
          disabled={!canEdit}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
        />
        <p className="text-xs text-slate-500 mt-1">Number of time slots to suggest</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Booking Link Type</label>
        <select
          value={(config as { bookingLinkType?: string }).bookingLinkType || 'widget'}
          onChange={(e) => onChange({ bookingLinkType: e.target.value } as Partial<AIActionConfig>)}
          disabled={!canEdit}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
        >
          <option value="widget">Booking widget</option>
          <option value="direct">Direct link</option>
        </select>
      </div>

      <ToggleOption
        label="Auto-Book Enabled"
        description="Allow AI to book without confirmation"
        checked={(config as { autoBookEnabled?: boolean }).autoBookEnabled ?? false}
        onChange={(v) => onChange({ autoBookEnabled: v } as Partial<AIActionConfig>)}
        disabled={!canEdit}
      />

      {(config as { autoBookEnabled?: boolean }).autoBookEnabled && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200">
            Auto-booking will create appointments without contact confirmation.
          </p>
        </div>
      )}
    </div>
  );
}

function DecisionStepSettings({
  config,
  onChange,
  canEdit,
}: {
  config: Partial<AIActionConfig>;
  onChange: (updates: Partial<AIActionConfig>) => void;
  canEdit: boolean;
}) {
  const options = (config as { decisionOptions?: string[] }).decisionOptions || [];

  const addOption = () => {
    if (options.length >= 10) return;
    onChange({ decisionOptions: [...options, ''] } as Partial<AIActionConfig>);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onChange({ decisionOptions: newOptions } as Partial<AIActionConfig>);
  };

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    onChange({ decisionOptions: newOptions } as Partial<AIActionConfig>);
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-slate-300">Decision Options</label>
          <span className="text-xs text-slate-500">{options.length}/10</span>
        </div>
        <div className="space-y-2">
          {options.map((opt, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                disabled={!canEdit}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
              />
              <button
                onClick={() => removeOption(index)}
                disabled={!canEdit}
                className="px-2 py-2 rounded-lg bg-slate-800 border border-slate-700 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
          {options.length < 10 && (
            <button
              onClick={addOption}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg border border-dashed border-slate-600 text-slate-400 text-sm hover:border-slate-500 disabled:opacity-50"
            >
              + Add option
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Low Confidence Branch
        </label>
        <input
          type="text"
          value={(config as { lowConfidenceBranch?: string }).lowConfidenceBranch || 'manual_review'}
          onChange={(e) => onChange({ lowConfidenceBranch: e.target.value } as Partial<AIActionConfig>)}
          disabled={!canEdit}
          placeholder="manual_review"
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
        />
        <p className="text-xs text-slate-500 mt-1">
          Route here when AI confidence is below 50%
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Default Branch</label>
        <select
          value={(config as { defaultBranch?: string }).defaultBranch || ''}
          onChange={(e) => onChange({ defaultBranch: e.target.value } as Partial<AIActionConfig>)}
          disabled={!canEdit}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
        >
          <option value="">None (stop if no match)</option>
          {options
            .filter((o) => o.trim())
            .map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}

function calculateTokenEstimate(context: AIActionInputContext): number {
  let tokens = 100;

  if (context.includeLatestMessage) {
    tokens += context.threadWindowSize * 50;
  }
  if (context.includeContactProfile) {
    tokens += 100;
  }
  if (context.includeOpportunityContext) {
    tokens += 75;
  }
  if (context.includeAppointmentContext) {
    tokens += 60;
  }
  if (context.includeRecentTimeline) {
    tokens += 150;
  }
  if (context.includeCustomFields) {
    tokens += 100;
  }
  if (context.includePreviousAIOutputs) {
    tokens += 100;
  }

  return tokens;
}
