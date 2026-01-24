import { supabase } from '../lib/supabase';
import type { AISafetyPrompts, UpdateAISafetyPromptsInput } from '../types';

export async function getSafetyPrompts(orgId: string): Promise<AISafetyPrompts | null> {
  const { data, error } = await supabase
    .from('ai_safety_prompts')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createSafetyPrompts(
  orgId: string,
  input?: Partial<UpdateAISafetyPromptsInput>
): Promise<AISafetyPrompts> {
  const { data, error } = await supabase
    .from('ai_safety_prompts')
    .insert({
      org_id: orgId,
      restricted_topics: input?.restricted_topics ?? '',
      disallowed_outputs: input?.disallowed_outputs ?? '',
      escalation_triggers: input?.escalation_triggers ?? '',
      is_active: input?.is_active ?? true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateSafetyPrompts(
  orgId: string,
  input: UpdateAISafetyPromptsInput
): Promise<AISafetyPrompts> {
  const existing = await getSafetyPrompts(orgId);

  if (!existing) {
    return createSafetyPrompts(orgId, input);
  }

  const updates: Record<string, unknown> = {};

  if (input.restricted_topics !== undefined) {
    updates.restricted_topics = input.restricted_topics;
  }
  if (input.disallowed_outputs !== undefined) {
    updates.disallowed_outputs = input.disallowed_outputs;
  }
  if (input.escalation_triggers !== undefined) {
    updates.escalation_triggers = input.escalation_triggers;
  }
  if (input.is_active !== undefined) {
    updates.is_active = input.is_active;
  }

  const { data, error } = await supabase
    .from('ai_safety_prompts')
    .update(updates)
    .eq('org_id', orgId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getOrCreateSafetyPrompts(orgId: string): Promise<AISafetyPrompts> {
  const existing = await getSafetyPrompts(orgId);
  if (existing) return existing;
  return createSafetyPrompts(orgId);
}

export async function buildSafetyInjection(orgId: string): Promise<string | null> {
  const safety = await getSafetyPrompts(orgId);

  if (!safety || !safety.is_active) {
    return null;
  }

  const sections: string[] = [];

  if (safety.restricted_topics.trim()) {
    sections.push(`RESTRICTED TOPICS (Do not discuss):\n${safety.restricted_topics.trim()}`);
  }

  if (safety.disallowed_outputs.trim()) {
    sections.push(`DISALLOWED OUTPUTS (Never generate):\n${safety.disallowed_outputs.trim()}`);
  }

  if (safety.escalation_triggers.trim()) {
    sections.push(`ESCALATION TRIGGERS (Hand off to human when detected):\n${safety.escalation_triggers.trim()}`);
  }

  if (sections.length === 0) {
    return null;
  }

  return `\n\n--- SAFETY RULES (ALWAYS ENFORCE) ---\n${sections.join('\n\n')}\n--- END SAFETY RULES ---`;
}
