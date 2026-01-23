import { supabase } from '../lib/supabase';
import type {
  AIAgentSettingsDefaults,
  UpdateAIAgentSettingsDefaultsInput,
  AIAgentToolName,
} from '../types';

export async function getDefaults(orgId: string): Promise<AIAgentSettingsDefaults | null> {
  const { data, error } = await supabase
    .from('ai_agent_settings_defaults')
    .select(`
      *,
      default_model:llm_models(
        *,
        provider:llm_providers(*)
      )
    `)
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createDefaults(
  orgId: string,
  input?: Partial<UpdateAIAgentSettingsDefaultsInput>
): Promise<AIAgentSettingsDefaults> {
  const defaults: AIAgentToolName[] = [
    'get_contact',
    'get_timeline',
    'get_conversation_history',
    'get_appointment_history',
    'add_note',
  ];

  const { data, error } = await supabase
    .from('ai_agent_settings_defaults')
    .insert({
      org_id: orgId,
      default_model_id: input?.default_model_id || null,
      default_allowed_tools: input?.default_allowed_tools || defaults,
      require_human_approval_default: input?.require_human_approval_default ?? true,
      max_outbound_per_run_default: input?.max_outbound_per_run_default ?? 5,
    })
    .select(`
      *,
      default_model:llm_models(
        *,
        provider:llm_providers(*)
      )
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateDefaults(
  orgId: string,
  input: UpdateAIAgentSettingsDefaultsInput
): Promise<AIAgentSettingsDefaults> {
  const existing = await getDefaults(orgId);

  if (!existing) {
    return createDefaults(orgId, input);
  }

  const updates: Record<string, unknown> = {};

  if (input.default_model_id !== undefined) {
    updates.default_model_id = input.default_model_id;
  }
  if (input.default_allowed_tools !== undefined) {
    updates.default_allowed_tools = input.default_allowed_tools;
  }
  if (input.require_human_approval_default !== undefined) {
    updates.require_human_approval_default = input.require_human_approval_default;
  }
  if (input.max_outbound_per_run_default !== undefined) {
    updates.max_outbound_per_run_default = input.max_outbound_per_run_default;
  }

  const { data, error } = await supabase
    .from('ai_agent_settings_defaults')
    .update(updates)
    .eq('org_id', orgId)
    .select(`
      *,
      default_model:llm_models(
        *,
        provider:llm_providers(*)
      )
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function getOrCreateDefaults(orgId: string): Promise<AIAgentSettingsDefaults> {
  const existing = await getDefaults(orgId);
  if (existing) return existing;
  return createDefaults(orgId);
}

export interface NewAgentDefaults {
  allowed_tools: AIAgentToolName[];
  require_human_approval: boolean;
  max_outbound_per_run: number;
  model_id: string | null;
}

export async function applyDefaultsToNewAgent(orgId: string): Promise<NewAgentDefaults> {
  const defaults = await getOrCreateDefaults(orgId);

  return {
    allowed_tools: defaults.default_allowed_tools,
    require_human_approval: defaults.require_human_approval_default,
    max_outbound_per_run: defaults.max_outbound_per_run_default,
    model_id: defaults.default_model_id,
  };
}
