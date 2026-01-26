import { supabase } from '../lib/supabase';
import type {
  WorkflowAIRun,
  AIWorkflowActionType,
  AIWorkflowRunStatus,
  AIActionConfig,
  AIActionInputContext,
  AIQualificationOutput,
  AIDecisionOutput,
  AIBookingOutput,
  Contact,
  Conversation,
  Message,
  Opportunity,
  Appointment,
} from '../types';

export interface AIContextAssemblyInput {
  contact: Contact;
  conversation?: Conversation | null;
  messages?: Message[];
  opportunity?: Opportunity | null;
  appointments?: Appointment[];
  customFieldValues?: Record<string, unknown>;
  previousAIOutputs?: Record<string, unknown>;
}

export interface AssembledAIContext {
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    jobTitle: string | null;
    source: string | null;
    tags: string[];
    leadScore: number | null;
  };
  conversation?: {
    id: string;
    channel: string;
    status: string;
    messageCount: number;
    lastMessageAt: string | null;
  };
  messageThread?: Array<{
    role: 'contact' | 'agent' | 'system';
    content: string;
    timestamp: string;
    channel: string;
  }>;
  opportunity?: {
    id: string;
    name: string;
    value: number;
    stage: string;
    pipeline: string;
    expectedCloseDate: string | null;
  };
  appointments?: Array<{
    id: string;
    title: string;
    startTime: string;
    status: string;
    type: string;
  }>;
  customFields?: Record<string, unknown>;
  previousOutputs?: Record<string, unknown>;
  tokenEstimate: number;
}

export function assembleAIContext(
  input: AIContextAssemblyInput,
  config: AIActionInputContext
): AssembledAIContext {
  const context: AssembledAIContext = {
    contact: {
      id: input.contact.id,
      name: `${input.contact.first_name} ${input.contact.last_name}`.trim(),
      email: input.contact.email,
      phone: input.contact.phone,
      company: input.contact.company,
      jobTitle: input.contact.job_title,
      source: input.contact.source,
      tags: input.contact.tags?.map(t => t.name) || [],
      leadScore: input.contact.lead_score ?? null,
    },
    tokenEstimate: 0,
  };

  let tokenCount = 100;

  if (config.includeLatestMessage && input.messages?.length) {
    const windowSize = config.threadWindowSize || 10;
    const recentMessages = input.messages.slice(0, windowSize);

    context.messageThread = recentMessages.map(msg => ({
      role: msg.direction === 'inbound' ? 'contact' : 'agent',
      content: msg.content,
      timestamp: msg.created_at,
      channel: msg.channel,
    }));

    tokenCount += recentMessages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }

  if (config.includeContactProfile && input.conversation) {
    context.conversation = {
      id: input.conversation.id,
      channel: input.conversation.channel,
      status: input.conversation.status,
      messageCount: input.conversation.message_count || 0,
      lastMessageAt: input.conversation.last_message_at,
    };
    tokenCount += 50;
  }

  if (config.includeOpportunityContext && input.opportunity) {
    context.opportunity = {
      id: input.opportunity.id,
      name: input.opportunity.name,
      value: input.opportunity.value,
      stage: input.opportunity.stage?.name || '',
      pipeline: input.opportunity.pipeline?.name || '',
      expectedCloseDate: input.opportunity.expected_close_date,
    };
    tokenCount += 75;
  }

  if (config.includeAppointmentContext && input.appointments?.length) {
    context.appointments = input.appointments.slice(0, 5).map(apt => ({
      id: apt.id,
      title: apt.title,
      startTime: apt.start_time,
      status: apt.status,
      type: apt.appointment_type?.name || '',
    }));
    tokenCount += input.appointments.length * 30;
  }

  if (config.includeCustomFields && input.customFieldValues) {
    context.customFields = input.customFieldValues;
    tokenCount += Object.keys(input.customFieldValues).length * 20;
  }

  if (config.includePreviousAIOutputs && input.previousAIOutputs) {
    context.previousOutputs = input.previousAIOutputs;
    tokenCount += 100;
  }

  context.tokenEstimate = tokenCount;
  return context;
}

export function calculateContextTokens(context: AssembledAIContext): number {
  return context.tokenEstimate;
}

export function renderAIPrompt(
  systemPrompt: string,
  context: AssembledAIContext,
  actionType: AIWorkflowActionType,
  additionalInstructions?: string
): string {
  let prompt = systemPrompt;

  prompt += '\n\n## Contact Information\n';
  prompt += `Name: ${context.contact.name}\n`;
  if (context.contact.email) prompt += `Email: ${context.contact.email}\n`;
  if (context.contact.phone) prompt += `Phone: ${context.contact.phone}\n`;
  if (context.contact.company) prompt += `Company: ${context.contact.company}\n`;
  if (context.contact.jobTitle) prompt += `Job Title: ${context.contact.jobTitle}\n`;
  if (context.contact.tags.length) prompt += `Tags: ${context.contact.tags.join(', ')}\n`;
  if (context.contact.leadScore !== null) prompt += `Lead Score: ${context.contact.leadScore}\n`;

  if (context.messageThread?.length) {
    prompt += '\n## Recent Conversation\n';
    for (const msg of context.messageThread) {
      const role = msg.role === 'contact' ? context.contact.name : 'Agent';
      prompt += `[${msg.timestamp}] ${role}: ${msg.content}\n`;
    }
  }

  if (context.opportunity) {
    prompt += '\n## Opportunity Details\n';
    prompt += `Name: ${context.opportunity.name}\n`;
    prompt += `Value: $${context.opportunity.value.toLocaleString()}\n`;
    prompt += `Stage: ${context.opportunity.stage}\n`;
    prompt += `Pipeline: ${context.opportunity.pipeline}\n`;
  }

  if (context.appointments?.length) {
    prompt += '\n## Upcoming Appointments\n';
    for (const apt of context.appointments) {
      prompt += `- ${apt.title} at ${apt.startTime} (${apt.status})\n`;
    }
  }

  if (context.customFields && Object.keys(context.customFields).length) {
    prompt += '\n## Custom Fields\n';
    for (const [key, value] of Object.entries(context.customFields)) {
      prompt += `${key}: ${value}\n`;
    }
  }

  if (additionalInstructions) {
    prompt += `\n## Additional Instructions\n${additionalInstructions}\n`;
  }

  prompt += getActionTypeInstructions(actionType);

  return prompt;
}

function getActionTypeInstructions(actionType: AIWorkflowActionType): string {
  switch (actionType) {
    case 'ai_conversation_reply':
      return '\n## Task\nGenerate a helpful, professional reply to continue this conversation.';

    case 'ai_email_draft':
      return '\n## Task\nDraft a professional email based on the context provided. Include a clear subject line.';

    case 'ai_follow_up_message':
      return '\n## Task\nGenerate an appropriate follow-up message based on the interaction history.';

    case 'ai_lead_qualification':
      return `\n## Task\nAnalyze the conversation and contact information to qualify this lead.
Return a JSON object with:
- qualification_label: "hot" | "warm" | "cold" | "disqualified"
- confidence: number between 0 and 1
- reasons: array of strings explaining the qualification
- recommended_next_action: string
- key_details_extracted: object with budget, timeline, need, objections`;

    case 'ai_booking_assist':
      return '\n## Task\nHelp the contact book an appointment by suggesting available times and providing booking assistance.';

    case 'ai_decision_step':
      return '\n## Task\nAnalyze the context and make a routing decision from the available options.';

    default:
      return '';
  }
}

export async function createWorkflowAIRun(input: {
  org_id: string;
  workflow_id: string;
  enrollment_id: string;
  node_id: string;
  agent_id: string | null;
  contact_id: string;
  conversation_id?: string | null;
  ai_action_type: AIWorkflowActionType;
  platform_context: Record<string, unknown>;
  input_context: Record<string, unknown>;
}): Promise<WorkflowAIRun> {
  const { data, error } = await supabase
    .from('workflow_ai_runs')
    .insert({
      org_id: input.org_id,
      workflow_id: input.workflow_id,
      enrollment_id: input.enrollment_id,
      node_id: input.node_id,
      agent_id: input.agent_id,
      contact_id: input.contact_id,
      conversation_id: input.conversation_id,
      ai_action_type: input.ai_action_type,
      platform_context: input.platform_context,
      input_context: input.input_context,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowAIRun;
}

export async function updateWorkflowAIRun(
  id: string,
  updates: Partial<{
    status: AIWorkflowRunStatus;
    prompt_rendered: string;
    output_raw: string;
    output_structured: AIQualificationOutput | AIDecisionOutput | AIBookingOutput;
    error_message: string;
    tokens_used: number;
    latency_ms: number;
    model_used: string;
    temperature_used: number;
    guardrails_applied: string[];
    guardrails_blocked: boolean;
    guardrails_block_reason: string;
    started_at: string;
    completed_at: string;
  }>
): Promise<WorkflowAIRun> {
  const { data, error } = await supabase
    .from('workflow_ai_runs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowAIRun;
}

export async function getWorkflowAIRun(id: string): Promise<WorkflowAIRun | null> {
  const { data, error } = await supabase
    .from('workflow_ai_runs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as WorkflowAIRun | null;
}

export async function getWorkflowAIRunsByEnrollment(
  enrollmentId: string
): Promise<WorkflowAIRun[]> {
  const { data, error } = await supabase
    .from('workflow_ai_runs')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as WorkflowAIRun[];
}

export async function getWorkflowAIRunsByWorkflow(
  workflowId: string,
  options?: {
    status?: AIWorkflowRunStatus[];
    actionType?: AIWorkflowActionType;
    limit?: number;
    offset?: number;
  }
): Promise<WorkflowAIRun[]> {
  let query = supabase
    .from('workflow_ai_runs')
    .select('*')
    .eq('workflow_id', workflowId);

  if (options?.status?.length) {
    query = query.in('status', options.status);
  }
  if (options?.actionType) {
    query = query.eq('ai_action_type', options.actionType);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as WorkflowAIRun[];
}

export async function getAIRunsForContact(
  contactId: string,
  options?: {
    actionType?: AIWorkflowActionType;
    limit?: number;
  }
): Promise<WorkflowAIRun[]> {
  let query = supabase
    .from('workflow_ai_runs')
    .select('*')
    .eq('contact_id', contactId)
    .in('status', ['success', 'pending_approval']);

  if (options?.actionType) {
    query = query.eq('ai_action_type', options.actionType);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as WorkflowAIRun[];
}

export async function getPendingApprovalRuns(
  orgId: string,
  options?: {
    workflowId?: string;
    limit?: number;
  }
): Promise<WorkflowAIRun[]> {
  let query = supabase
    .from('workflow_ai_runs')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'pending_approval');

  if (options?.workflowId) {
    query = query.eq('workflow_id', options.workflowId);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as WorkflowAIRun[];
}

export async function getWorkflowAIStats(
  workflowId: string,
  dateRange?: { start: string; end: string }
): Promise<{
  total: number;
  success: number;
  failed: number;
  pendingApproval: number;
  avgLatencyMs: number;
  avgTokens: number;
  byActionType: Record<AIWorkflowActionType, number>;
}> {
  let query = supabase
    .from('workflow_ai_runs')
    .select('status, ai_action_type, latency_ms, tokens_used')
    .eq('workflow_id', workflowId);

  if (dateRange) {
    query = query
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);
  }

  const { data, error } = await query;

  if (error) throw error;

  const runs = data || [];
  const total = runs.length;
  const success = runs.filter(r => r.status === 'success').length;
  const failed = runs.filter(r => r.status === 'failed').length;
  const pendingApproval = runs.filter(r => r.status === 'pending_approval').length;

  const completedRuns = runs.filter(r => r.latency_ms != null);
  const avgLatencyMs = completedRuns.length
    ? completedRuns.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / completedRuns.length
    : 0;

  const avgTokens = runs.length
    ? runs.reduce((sum, r) => sum + (r.tokens_used || 0), 0) / runs.length
    : 0;

  const byActionType = runs.reduce((acc, r) => {
    acc[r.ai_action_type as AIWorkflowActionType] = (acc[r.ai_action_type as AIWorkflowActionType] || 0) + 1;
    return acc;
  }, {} as Record<AIWorkflowActionType, number>);

  return {
    total,
    success,
    failed,
    pendingApproval,
    avgLatencyMs: Math.round(avgLatencyMs),
    avgTokens: Math.round(avgTokens),
    byActionType,
  };
}

export function validateStructuredOutput(
  output: unknown,
  actionType: AIWorkflowActionType
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (actionType === 'ai_lead_qualification') {
    const o = output as AIQualificationOutput;
    if (!o.qualification_label || !['hot', 'warm', 'cold', 'disqualified'].includes(o.qualification_label)) {
      errors.push('Invalid or missing qualification_label');
    }
    if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 1) {
      errors.push('Invalid confidence score (must be 0-1)');
    }
    if (!Array.isArray(o.reasons)) {
      errors.push('Missing reasons array');
    }
  }

  if (actionType === 'ai_decision_step') {
    const o = output as AIDecisionOutput;
    if (typeof o.decision !== 'string' || !o.decision) {
      errors.push('Invalid or missing decision');
    }
    if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 1) {
      errors.push('Invalid confidence score (must be 0-1)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function parseStructuredOutput(
  rawOutput: string,
  actionType: AIWorkflowActionType
): AIQualificationOutput | AIDecisionOutput | AIBookingOutput | null {
  try {
    const jsonMatch = rawOutput.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawOutput;
    const parsed = JSON.parse(jsonStr.trim());

    const validation = validateStructuredOutput(parsed, actionType);
    if (!validation.valid) {
      console.error('Structured output validation failed:', validation.errors);
      return null;
    }

    return parsed;
  } catch (e) {
    console.error('Failed to parse structured output:', e);
    return null;
  }
}

export function isAIWorkflowAction(actionType: string): actionType is AIWorkflowActionType {
  return [
    'ai_conversation_reply',
    'ai_email_draft',
    'ai_follow_up_message',
    'ai_lead_qualification',
    'ai_booking_assist',
    'ai_decision_step',
  ].includes(actionType);
}

export function getAIActionBranches(
  actionType: AIWorkflowActionType,
  config: AIActionConfig
): string[] {
  if (actionType === 'ai_lead_qualification') {
    return ['hot', 'warm', 'cold', 'disqualified', 'manual_review'];
  }

  if (actionType === 'ai_decision_step' && 'decisionOptions' in config) {
    const branches = [...config.decisionOptions];
    if (config.lowConfidenceBranch && !branches.includes(config.lowConfidenceBranch)) {
      branches.push(config.lowConfidenceBranch);
    }
    return branches;
  }

  return [];
}

export function determineAIBranch(
  actionType: AIWorkflowActionType,
  output: AIQualificationOutput | AIDecisionOutput | AIBookingOutput | null,
  config: AIActionConfig
): string | null {
  if (!output) return null;

  if (actionType === 'ai_lead_qualification' && 'confidenceThreshold' in config) {
    const qualOutput = output as AIQualificationOutput;

    if (qualOutput.confidence < config.manualReviewThreshold) {
      return 'manual_review';
    }

    return qualOutput.qualification_label;
  }

  if (actionType === 'ai_decision_step' && 'decisionOptions' in config) {
    const decOutput = output as AIDecisionOutput;

    if (decOutput.confidence < 0.5 && config.lowConfidenceBranch) {
      return config.lowConfidenceBranch;
    }

    if (config.decisionOptions.includes(decOutput.decision)) {
      return decOutput.decision;
    }

    return config.defaultBranch || null;
  }

  return null;
}
