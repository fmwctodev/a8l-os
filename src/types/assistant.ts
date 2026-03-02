import type { ITSRequest, ITSExecutionResult, ITSAction, ITSActionResult } from './its';

export type AssistantMessageRole = 'user' | 'assistant' | 'system';
export type AssistantMessageType = 'text' | 'tool_result' | 'action_confirmation' | 'draft_preview' | 'meeting_summary' | 'error' | 'voice_transcript' | 'execution_plan' | 'execution_result';
export type MemoryCategory = 'scheduling' | 'communication' | 'preferences' | 'contacts' | 'rules' | 'general';
export type ClaraMemoryType = 'preference' | 'communication_style' | 'decision' | 'contact_context' | 'recurring_pattern' | 'strategic_context' | 'behavior_pattern';
export type ActionExecutionStatus = 'success' | 'failed' | 'running' | 'queued' | 'canceled';
export type AssistantPanelTab = 'chat' | 'voice' | 'activity' | 'settings';

export interface AssistantProfile {
  id: string;
  user_id: string;
  org_id: string;
  enabled: boolean;
  voice_enabled: boolean;
  elevenlabs_voice_id: string | null;
  elevenlabs_voice_name: string | null;
  speech_rate: number;
  output_volume: number;
  auto_speak_chat: boolean;
  confirm_all_writes: boolean;
  system_prompt_override: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantThread {
  id: string;
  user_id: string;
  org_id: string;
  title: string | null;
  context_module: string | null;
  context_record_id: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface AssistantMessage {
  id: string;
  thread_id: string;
  role: AssistantMessageRole;
  content: string;
  message_type: AssistantMessageType;
  tool_calls: ClaraToolCall[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AssistantUserMemory {
  id: string;
  user_id: string;
  org_id: string;
  memory_key: string;
  memory_value: unknown;
  category: MemoryCategory;
  created_at: string;
  updated_at: string;
}

export interface ClaraMemory {
  id: string;
  organization_id: string;
  user_id: string;
  memory_type: ClaraMemoryType;
  title: string | null;
  content: string;
  importance_score: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantActionLog {
  id: string;
  user_id: string;
  org_id: string;
  thread_id: string | null;
  action_type: string;
  target_module: string;
  target_record_id: string | null;
  input_summary: string | null;
  output_summary: string | null;
  execution_status: ActionExecutionStatus;
  execution_time_ms: number | null;
  error_message: string | null;
  tool_calls: ClaraToolCall[];
  confirmed_by_user: boolean | null;
  execution_request_id: string | null;
  action_id: string | null;
  depends_on: string | null;
  created_at: string;
}

export interface AssistantMeetingSummary {
  id: string;
  user_id: string;
  org_id: string;
  meeting_transcription_id: string;
  summary: string;
  key_decisions: string[];
  action_items: Record<string, unknown>[];
  attendee_sentiments: Record<string, unknown> | null;
  opportunity_signals: Record<string, unknown> | null;
  created_at: string;
}

export interface ClaraToolCall {
  id: string;
  tool_name: string;
  input: Record<string, unknown>;
  output: unknown;
  status: 'success' | 'error';
  duration_ms: number;
}

export interface ClaraActionConfirmation {
  id: string;
  action_type: string;
  description: string;
  details: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ClaraPageContext {
  current_path: string;
  current_module: string | null;
  current_record_id: string | null;
}

export interface ClaraChatResponse {
  response: string;
  tool_calls: ClaraToolCall[];
  confirmations_pending: ClaraActionConfirmation[];
  drafts: ClaraDraft[];
  model_used: string;
  its_request?: ITSRequest;
  execution_result?: ITSExecutionResult;
  execution_request_id?: string;
  permission_denied?: { action_id: string; action_type: string; reason: string }[];
  integration_errors?: { action_id: string; action_type: string; reason: string }[];
}

export interface ClaraDraft {
  id: string;
  type: 'email' | 'sms';
  to: string;
  subject?: string;
  body: string;
  confirmation_id: string;
}

export interface ClaraVoiceResponse {
  transcription: string;
  response: string;
  tool_calls: ClaraToolCall[];
  confirmations_pending: ClaraActionConfirmation[];
  drafts: ClaraDraft[];
}

export type { ITSRequest, ITSExecutionResult, ITSAction, ITSActionResult };
