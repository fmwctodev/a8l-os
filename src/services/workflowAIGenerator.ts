import { supabase } from '../lib/supabase';
import { validateWorkflowDefinition } from './workflowEngine';
import type { WorkflowDefinition } from '../types';

export interface GenerateWorkflowResponse {
  definition: WorkflowDefinition;
  suggestedName?: string | null;
  model: string;
  validationErrors: string[];
}

/**
 * Calls the workflow-ai-generator edge function with a natural-language
 * prompt and (optionally) an existing draft definition. Returns the raw
 * AI-produced definition plus any validation errors so the UI can decide
 * whether to drop it on the canvas as-is or surface fixes first.
 */
export async function generateWorkflowFromPrompt(args: {
  prompt: string;
  orgId: string;
  name?: string;
  existingDefinition?: WorkflowDefinition | null;
}): Promise<GenerateWorkflowResponse> {
  const { data, error } = await supabase.functions.invoke('workflow-ai-generator', {
    body: {
      prompt: args.prompt,
      orgId: args.orgId,
      name: args.name,
      existingDefinition: args.existingDefinition || null,
    },
  });

  if (error) {
    throw new Error(error.message || 'AI workflow generator failed');
  }

  if (!data?.definition) {
    throw new Error(data?.error || 'AI did not return a definition');
  }

  const definition = data.definition as WorkflowDefinition;
  const validation = validateWorkflowDefinition(definition);

  return {
    definition,
    suggestedName: data.suggested_name || null,
    model: data.model,
    validationErrors: validation.valid ? [] : validation.errors,
  };
}
