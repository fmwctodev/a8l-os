import { supabase } from '../lib/supabase';
import type {
  AIDraft,
  AIDraftStatus,
  AIDraftTriggerType,
  MessageChannel,
  AIDraftSource,
  AIWorkflowActionType,
} from '../types';

export async function getAIDraftsByConversation(
  conversationId: string
): Promise<AIDraft[]> {
  const { data, error } = await supabase
    .from('ai_drafts')
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      ),
      triggered_by_rule:conversation_rules!triggered_by_rule_id (
        id, name
      ),
      approved_by_user:users!approved_by (
        id, name, email, avatar_url
      )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as AIDraft[];
}

export async function getPendingDraft(
  conversationId: string
): Promise<AIDraft | null> {
  const { data, error } = await supabase
    .from('ai_drafts')
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      ),
      triggered_by_rule:conversation_rules!triggered_by_rule_id (
        id, name
      )
    `)
    .eq('conversation_id', conversationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as AIDraft | null;
}

export async function getAIDraftById(id: string): Promise<AIDraft | null> {
  const { data, error } = await supabase
    .from('ai_drafts')
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      ),
      triggered_by_rule:conversation_rules!triggered_by_rule_id (
        id, name
      ),
      approved_by_user:users!approved_by (
        id, name, email, avatar_url
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as AIDraft | null;
}

export interface CreateAIDraftInput {
  organization_id: string;
  conversation_id: string;
  contact_id: string;
  agent_id?: string | null;
  draft_content: string;
  draft_channel: MessageChannel;
  draft_subject?: string | null;
  trigger_type: AIDraftTriggerType;
  triggered_by_rule_id?: string | null;
  context_message_id?: string | null;
}

export async function createAIDraft(input: CreateAIDraftInput): Promise<AIDraft> {
  await supersedePendingDrafts(input.conversation_id);

  const { data, error } = await supabase
    .from('ai_drafts')
    .insert({
      organization_id: input.organization_id,
      conversation_id: input.conversation_id,
      contact_id: input.contact_id,
      agent_id: input.agent_id,
      draft_content: input.draft_content,
      draft_channel: input.draft_channel,
      draft_subject: input.draft_subject,
      trigger_type: input.trigger_type,
      triggered_by_rule_id: input.triggered_by_rule_id,
      context_message_id: input.context_message_id,
      status: 'pending',
      version: 1,
    })
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      ),
      triggered_by_rule:conversation_rules!triggered_by_rule_id (
        id, name
      )
    `)
    .single();

  if (error) throw error;
  return data as AIDraft;
}

export async function updateAIDraft(
  id: string,
  updates: Partial<Pick<AIDraft, 'draft_content' | 'draft_subject'>>
): Promise<AIDraft> {
  const { data, error } = await supabase
    .from('ai_drafts')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      )
    `)
    .single();

  if (error) throw error;
  return data as AIDraft;
}

export async function approveAIDraft(
  id: string,
  userId: string
): Promise<AIDraft> {
  const { data, error } = await supabase
    .from('ai_drafts')
    .update({
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      )
    `)
    .single();

  if (error) throw error;
  return data as AIDraft;
}

export async function rejectAIDraft(
  id: string,
  reason?: string
): Promise<AIDraft> {
  const { data, error } = await supabase
    .from('ai_drafts')
    .update({
      status: 'rejected',
      rejection_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      )
    `)
    .single();

  if (error) throw error;
  return data as AIDraft;
}

export async function supersedePendingDrafts(
  conversationId: string
): Promise<void> {
  const { error } = await supabase
    .from('ai_drafts')
    .update({
      status: 'superseded',
      updated_at: new Date().toISOString(),
    })
    .eq('conversation_id', conversationId)
    .eq('status', 'pending');

  if (error) throw error;
}

export async function regenerateAIDraft(
  draftId: string,
  newContent: string,
  newContextMessageId?: string
): Promise<AIDraft> {
  const existingDraft = await getAIDraftById(draftId);
  if (!existingDraft) throw new Error('Draft not found');

  await supersedePendingDrafts(existingDraft.conversation_id);

  const { data, error } = await supabase
    .from('ai_drafts')
    .insert({
      organization_id: existingDraft.organization_id,
      conversation_id: existingDraft.conversation_id,
      contact_id: existingDraft.contact_id,
      agent_id: existingDraft.agent_id,
      draft_content: newContent,
      draft_channel: existingDraft.draft_channel,
      draft_subject: existingDraft.draft_subject,
      trigger_type: existingDraft.trigger_type,
      triggered_by_rule_id: existingDraft.triggered_by_rule_id,
      context_message_id: newContextMessageId || existingDraft.context_message_id,
      status: 'pending',
      version: existingDraft.version + 1,
    })
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      ),
      triggered_by_rule:conversation_rules!triggered_by_rule_id (
        id, name
      )
    `)
    .single();

  if (error) throw error;
  return data as AIDraft;
}

export async function deleteAIDraft(id: string): Promise<void> {
  const { error } = await supabase
    .from('ai_drafts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getPendingDraftsCount(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('ai_drafts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'pending');

  if (error) throw error;
  return count || 0;
}

export interface CreateWorkflowDraftInput {
  organization_id: string;
  conversation_id: string;
  contact_id: string;
  agent_id?: string | null;
  draft_content: string;
  draft_channel: MessageChannel;
  draft_subject?: string | null;
  workflow_id: string;
  enrollment_id: string;
  workflow_ai_run_id: string;
  action_type: AIWorkflowActionType;
  context_message_id?: string | null;
}

export async function createWorkflowDraft(
  input: CreateWorkflowDraftInput
): Promise<AIDraft> {
  await supersedePendingDrafts(input.conversation_id);

  const { data, error } = await supabase
    .from('ai_drafts')
    .insert({
      organization_id: input.organization_id,
      conversation_id: input.conversation_id,
      contact_id: input.contact_id,
      agent_id: input.agent_id,
      draft_content: input.draft_content,
      draft_channel: input.draft_channel,
      draft_subject: input.draft_subject,
      trigger_type: 'auto',
      context_message_id: input.context_message_id,
      status: 'pending',
      version: 1,
      workflow_id: input.workflow_id,
      enrollment_id: input.enrollment_id,
      workflow_ai_run_id: input.workflow_ai_run_id,
      source_type: 'workflow',
      action_type: input.action_type,
    })
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      )
    `)
    .single();

  if (error) throw error;
  return data as AIDraft;
}

export async function getPendingWorkflowDrafts(
  orgId: string,
  options?: {
    workflowId?: string;
    limit?: number;
  }
): Promise<AIDraft[]> {
  let query = supabase
    .from('ai_drafts')
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      ),
      approved_by_user:users!approved_by (
        id, name, email, avatar_url
      )
    `)
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .eq('source_type', 'workflow');

  if (options?.workflowId) {
    query = query.eq('workflow_id', options.workflowId);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as AIDraft[];
}

export async function getPendingDraftsBySource(
  orgId: string,
  source: AIDraftSource
): Promise<AIDraft[]> {
  const { data, error } = await supabase
    .from('ai_drafts')
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      ),
      triggered_by_rule:conversation_rules!triggered_by_rule_id (
        id, name
      ),
      approved_by_user:users!approved_by (
        id, name, email, avatar_url
      )
    `)
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .eq('source_type', source)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as AIDraft[];
}

export async function getPendingDraftsCountBySource(
  orgId: string,
  source: AIDraftSource
): Promise<number> {
  const { count, error } = await supabase
    .from('ai_drafts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .eq('source_type', source);

  if (error) throw error;
  return count || 0;
}

export async function getWorkflowDraftCounts(orgId: string): Promise<{
  total: number;
  byWorkflow: Record<string, number>;
}> {
  const { data, error } = await supabase
    .from('ai_drafts')
    .select('workflow_id')
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .eq('source_type', 'workflow');

  if (error) throw error;

  const counts = (data || []).reduce((acc, draft) => {
    if (draft.workflow_id) {
      acc[draft.workflow_id] = (acc[draft.workflow_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return {
    total: data?.length || 0,
    byWorkflow: counts,
  };
}

export async function getAllPendingDraftsWithContext(
  orgId: string,
  options?: {
    source?: AIDraftSource;
    limit?: number;
  }
): Promise<Array<AIDraft & {
  contact: { id: string; first_name: string; last_name: string; email: string | null };
  conversation: { id: string; channel: string; status: string } | null;
}>> {
  let query = supabase
    .from('ai_drafts')
    .select(`
      *,
      agent:ai_agents!agent_id (
        id, name, agent_type
      ),
      contact:contacts!contact_id (
        id, first_name, last_name, email
      ),
      conversation:conversations!conversation_id (
        id, channel, status
      )
    `)
    .eq('organization_id', orgId)
    .eq('status', 'pending');

  if (options?.source) {
    query = query.eq('source_type', options.source);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Array<AIDraft & {
    contact: { id: string; first_name: string; last_name: string; email: string | null };
    conversation: { id: string; channel: string; status: string } | null;
  }>;
}
