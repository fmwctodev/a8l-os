export type AIWorkflowActionType =
  | 'ai_conversation_reply'
  | 'ai_email_draft'
  | 'ai_follow_up_message'
  | 'ai_lead_qualification'
  | 'ai_booking_assist'
  | 'ai_decision_step';

export type AIWorkflowRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'pending_approval';

export type AIDraftSource = 'manual' | 'conversation_rule' | 'workflow';

export type AIOutcomeType =
  | 'reply_received'
  | 'booking_made'
  | 'deal_won'
  | 'invoice_paid'
  | 'positive_sentiment'
  | 'negative_sentiment'
  | 'unsubscribe'
  | 'complaint'
  | 'no_response';

export type AIOutputMode = 'generate_draft' | 'auto_send' | 'generate_and_branch';

export type AIFallbackBehavior = 'send_template' | 'notify_staff' | 'stop_workflow' | 'route_to_human';

export type AIResponseStyle = 'concise' | 'normal' | 'detailed';

export type AIQualificationLabel = 'hot' | 'warm' | 'cold' | 'disqualified';

export type GuardrailType =
  | 'blocked_claims'
  | 'profanity_filter'
  | 'pii_redaction'
  | 'quiet_hours'
  | 'max_length'
  | 'domain_blocklist'
  | 'custom_regex';

export interface AIActionInputContext {
  includeLatestMessage: boolean;
  threadWindowSize: number;
  includeContactProfile: boolean;
  includeOpportunityContext: boolean;
  includeAppointmentContext: boolean;
  includeRecentTimeline: boolean;
  includeCustomFields: boolean;
  includePreviousAIOutputs: boolean;
}

export interface AIActionGuardrailConfig {
  requireApproval: boolean;
  blockSensitiveClaims: boolean;
  blockedClaimsList?: string[];
  profanityFilter: boolean;
  piiRedaction: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTimezone?: string;
  maxMessageLength?: number;
  disallowedDomains?: string[];
}

export interface AIActionRetryConfig {
  retryCount: number;
  retryDelayMs: number;
  fallbackBehavior: AIFallbackBehavior;
  fallbackTemplateId?: string;
}

export interface AIActionBaseConfig {
  agentId: string;
  agentName?: string;
  useAgentMemory: boolean;
  useGlobalKnowledge: boolean;
  useBrandboard: boolean;
  inputContext: AIActionInputContext;
  outputMode: AIOutputMode;
  guardrails: AIActionGuardrailConfig;
  retry: AIActionRetryConfig;
}

export interface AIConversationReplyConfig extends AIActionBaseConfig {
  channel: 'sms' | 'email';
  responseStyle: AIResponseStyle;
  allowQuestions: boolean;
  includeBookingCTA: boolean;
  bookingCalendarId?: string;
  includeAttachments: boolean;
}

export interface AIEmailDraftConfig extends AIActionBaseConfig {
  useTemplateWrapper: boolean;
  templateId?: string;
  includeSignature: boolean;
  generatePreheader: boolean;
}

export interface AIFollowUpMessageConfig extends AIActionBaseConfig {
  channel: 'sms' | 'email';
  sequenceMode: 'single' | 'multi_step';
  maxSequenceSteps: number;
}

export interface AILeadQualificationConfig extends AIActionBaseConfig {
  confidenceThreshold: number;
  writeToFields: Record<string, string>;
  autoTagResults: boolean;
  manualReviewThreshold: number;
}

export interface AIBookingAssistConfig extends AIActionBaseConfig {
  calendarId: string;
  appointmentTypeId?: string;
  suggestedSlotCount: number;
  autoBookEnabled: boolean;
  bookingLinkType: 'direct' | 'widget';
}

export interface AIDecisionStepConfig extends AIActionBaseConfig {
  decisionOptions: string[];
  lowConfidenceBranch: string;
  defaultBranch: string;
}

export type AIActionConfig =
  | AIConversationReplyConfig
  | AIEmailDraftConfig
  | AIFollowUpMessageConfig
  | AILeadQualificationConfig
  | AIBookingAssistConfig
  | AIDecisionStepConfig;

export interface AIQualificationOutput {
  qualification_label: AIQualificationLabel;
  confidence: number;
  reasons: string[];
  recommended_next_action: string;
  key_details_extracted: {
    budget?: string;
    timeline?: string;
    need?: string;
    objections?: string[];
  };
}

export interface AIDecisionOutput {
  decision: string;
  confidence: number;
  explanation: string;
  extracted_data: Record<string, unknown>;
}

export interface AIBookingOutput {
  suggested_times: Array<{
    start: string;
    end: string;
    formatted: string;
  }>;
  booking_cta_url: string;
  availability_summary: string;
}

export interface WorkflowAIRun {
  id: string;
  org_id: string;
  workflow_id: string;
  enrollment_id: string;
  node_id: string;
  agent_id: string | null;
  contact_id: string;
  conversation_id: string | null;
  ai_action_type: AIWorkflowActionType;
  platform_context: Record<string, unknown>;
  input_context: Record<string, unknown>;
  prompt_rendered: string | null;
  output_raw: string | null;
  output_structured: AIQualificationOutput | AIDecisionOutput | AIBookingOutput | null;
  status: AIWorkflowRunStatus;
  error_message: string | null;
  tokens_used: number;
  latency_ms: number | null;
  model_used: string | null;
  temperature_used: number | null;
  guardrails_applied: string[];
  guardrails_blocked: boolean;
  guardrails_block_reason: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface AIWorkflowLearningSignal {
  id: string;
  org_id: string;
  workflow_id: string;
  node_id: string;
  agent_id: string | null;
  workflow_ai_run_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  channel: string | null;
  ai_action_type: AIWorkflowActionType;
  outcome_type: AIOutcomeType;
  outcome_value: number | null;
  sentiment_score: number | null;
  time_to_outcome_ms: number | null;
  metadata: Record<string, unknown>;
  captured_at: string;
  created_at: string;
}

export interface AIActionGuardrail {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  guardrail_type: GuardrailType;
  config: Record<string, unknown>;
  applies_to_channels: string[];
  applies_to_action_types: AIWorkflowActionType[];
  is_active: boolean;
  priority: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIActionPerformanceStats {
  total_runs: number;
  success_rate: number;
  avg_latency_ms: number;
  avg_tokens: number;
  outcomes: Record<AIOutcomeType, number>;
  reply_rate: number;
  booking_rate: number;
  conversion_rate: number;
}

export interface AINodePerformance {
  node_id: string;
  workflow_id: string;
  total_runs: number;
  success_count: number;
  failure_count: number;
  pending_approval_count: number;
  success_rate: number;
  avg_latency_ms: number;
  outcomes: Record<AIOutcomeType, number>;
}

export const DEFAULT_AI_INPUT_CONTEXT: AIActionInputContext = {
  includeLatestMessage: true,
  threadWindowSize: 10,
  includeContactProfile: true,
  includeOpportunityContext: false,
  includeAppointmentContext: false,
  includeRecentTimeline: true,
  includeCustomFields: true,
  includePreviousAIOutputs: true,
};

export const DEFAULT_AI_GUARDRAILS: AIActionGuardrailConfig = {
  requireApproval: true,
  blockSensitiveClaims: true,
  profanityFilter: true,
  piiRedaction: true,
  quietHoursEnabled: false,
};

export const DEFAULT_AI_RETRY: AIActionRetryConfig = {
  retryCount: 2,
  retryDelayMs: 5000,
  fallbackBehavior: 'notify_staff',
};

export function createDefaultAIActionConfig(actionType: AIWorkflowActionType): AIActionConfig {
  const base: AIActionBaseConfig = {
    agentId: '',
    useAgentMemory: true,
    useGlobalKnowledge: true,
    useBrandboard: true,
    inputContext: { ...DEFAULT_AI_INPUT_CONTEXT },
    outputMode: 'generate_draft',
    guardrails: { ...DEFAULT_AI_GUARDRAILS },
    retry: { ...DEFAULT_AI_RETRY },
  };

  switch (actionType) {
    case 'ai_conversation_reply':
      return {
        ...base,
        channel: 'sms',
        responseStyle: 'normal',
        allowQuestions: true,
        includeBookingCTA: false,
        includeAttachments: false,
      } as AIConversationReplyConfig;

    case 'ai_email_draft':
      return {
        ...base,
        useTemplateWrapper: false,
        includeSignature: true,
        generatePreheader: true,
      } as AIEmailDraftConfig;

    case 'ai_follow_up_message':
      return {
        ...base,
        channel: 'sms',
        sequenceMode: 'single',
        maxSequenceSteps: 3,
      } as AIFollowUpMessageConfig;

    case 'ai_lead_qualification':
      return {
        ...base,
        outputMode: 'generate_and_branch',
        confidenceThreshold: 0.7,
        writeToFields: {},
        autoTagResults: true,
        manualReviewThreshold: 0.5,
      } as AILeadQualificationConfig;

    case 'ai_booking_assist':
      return {
        ...base,
        calendarId: '',
        suggestedSlotCount: 3,
        autoBookEnabled: false,
        bookingLinkType: 'widget',
      } as AIBookingAssistConfig;

    case 'ai_decision_step':
      return {
        ...base,
        outputMode: 'generate_and_branch',
        decisionOptions: [],
        lowConfidenceBranch: 'manual_review',
        defaultBranch: '',
      } as AIDecisionStepConfig;

    default:
      return base as AIActionConfig;
  }
}

export const AI_ACTION_LABELS: Record<AIWorkflowActionType, string> = {
  ai_conversation_reply: 'AI Conversation Reply',
  ai_email_draft: 'AI Email Draft',
  ai_follow_up_message: 'AI Follow-up Message',
  ai_lead_qualification: 'AI Lead Qualification',
  ai_booking_assist: 'AI Booking Assistant',
  ai_decision_step: 'AI Decision Step',
};

export const AI_ACTION_DESCRIPTIONS: Record<AIWorkflowActionType, string> = {
  ai_conversation_reply: 'Generate a contextual reply to the current conversation',
  ai_email_draft: 'Create a professional email draft with AI assistance',
  ai_follow_up_message: 'Generate a follow-up message based on interaction history',
  ai_lead_qualification: 'Analyze and qualify leads based on conversation context',
  ai_booking_assist: 'Help contacts book appointments with suggested times',
  ai_decision_step: 'Make intelligent routing decisions based on context',
};

export const QUALIFICATION_BRANCHES = ['hot', 'warm', 'cold', 'disqualified', 'manual_review'] as const;
export type QualificationBranch = typeof QUALIFICATION_BRANCHES[number];

export const MAX_DECISION_OPTIONS = 10;
