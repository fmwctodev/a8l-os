import { supabase } from '../lib/supabase';
import type {
  ConversationRule,
  ConversationRuleLog,
  ConversationRuleFilters,
  RuleTriggerType,
  RuleCondition,
  RuleAction,
} from '../types';

export async function getConversationRules(
  orgId: string,
  filters: ConversationRuleFilters = {}
): Promise<ConversationRule[]> {
  let query = supabase
    .from('conversation_rules')
    .select('*')
    .eq('organization_id', orgId)
    .order('priority')
    .order('created_at', { ascending: false });

  if (filters.triggerType) {
    query = query.eq('trigger_type', filters.triggerType);
  }

  if (filters.isEnabled !== undefined) {
    query = query.eq('is_enabled', filters.isEnabled);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rules = data as ConversationRule[];

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    rules = rules.filter(r => r.name.toLowerCase().includes(searchLower));
  }

  return rules;
}

export async function getEnabledRules(
  orgId: string,
  triggerType?: RuleTriggerType
): Promise<ConversationRule[]> {
  let query = supabase
    .from('conversation_rules')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_enabled', true)
    .order('priority');

  if (triggerType) {
    query = query.eq('trigger_type', triggerType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as ConversationRule[];
}

export async function getConversationRuleById(
  id: string
): Promise<ConversationRule | null> {
  const { data, error } = await supabase
    .from('conversation_rules')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as ConversationRule | null;
}

export interface CreateConversationRuleInput {
  organization_id: string;
  name: string;
  trigger_type: RuleTriggerType;
  conditions?: RuleCondition[];
  actions: RuleAction[];
  priority?: number;
  cooldown_minutes?: number;
  max_triggers_per_day?: number;
  continue_evaluation?: boolean;
}

export async function createConversationRule(
  input: CreateConversationRuleInput
): Promise<ConversationRule> {
  const { data, error } = await supabase
    .from('conversation_rules')
    .insert({
      organization_id: input.organization_id,
      name: input.name,
      trigger_type: input.trigger_type,
      conditions: input.conditions || [],
      actions: input.actions,
      priority: input.priority ?? 100,
      cooldown_minutes: input.cooldown_minutes ?? 0,
      max_triggers_per_day: input.max_triggers_per_day ?? 0,
      continue_evaluation: input.continue_evaluation ?? false,
      is_enabled: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ConversationRule;
}

export interface UpdateConversationRuleInput {
  name?: string;
  trigger_type?: RuleTriggerType;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  priority?: number;
  cooldown_minutes?: number;
  max_triggers_per_day?: number;
  continue_evaluation?: boolean;
  is_enabled?: boolean;
}

export async function updateConversationRule(
  id: string,
  input: UpdateConversationRuleInput
): Promise<ConversationRule> {
  const { data, error } = await supabase
    .from('conversation_rules')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ConversationRule;
}

export async function deleteConversationRule(id: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_rules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleRuleStatus(
  id: string,
  isEnabled: boolean
): Promise<ConversationRule> {
  return updateConversationRule(id, { is_enabled: isEnabled });
}

export async function duplicateRule(id: string): Promise<ConversationRule> {
  const original = await getConversationRuleById(id);
  if (!original) throw new Error('Rule not found');

  return createConversationRule({
    organization_id: original.organization_id,
    name: `${original.name} (Copy)`,
    trigger_type: original.trigger_type,
    conditions: original.conditions,
    actions: original.actions,
    priority: original.priority + 1,
    cooldown_minutes: original.cooldown_minutes,
    max_triggers_per_day: original.max_triggers_per_day,
    continue_evaluation: original.continue_evaluation,
  });
}

export async function updateRulePriorities(
  rules: { id: string; priority: number }[]
): Promise<void> {
  const updates = rules.map(r =>
    supabase
      .from('conversation_rules')
      .update({ priority: r.priority, updated_at: new Date().toISOString() })
      .eq('id', r.id)
  );

  await Promise.all(updates);
}

export async function getRuleLogs(
  ruleId: string,
  filters: { success?: boolean; startDate?: string; endDate?: string } = {},
  page = 1,
  pageSize = 50
): Promise<{ data: ConversationRuleLog[]; count: number }> {
  let query = supabase
    .from('conversation_rule_logs')
    .select(`
      *,
      rule:conversation_rules!rule_id (
        id, name
      ),
      conversation:conversations!conversation_id (
        id,
        contact:contacts!contact_id (
          id, first_name, last_name
        )
      )
    `, { count: 'exact' })
    .eq('rule_id', ruleId)
    .order('trigger_time', { ascending: false });

  if (filters.success !== undefined) {
    query = query.eq('success', filters.success);
  }

  if (filters.startDate) {
    query = query.gte('trigger_time', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('trigger_time', filters.endDate);
  }

  const offset = (page - 1) * pageSize;
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: data as ConversationRuleLog[], count: count || 0 };
}

export async function createRuleLog(
  ruleId: string,
  conversationId: string,
  actionResults: ConversationRuleLog['action_results'],
  success: boolean,
  errorMessage?: string
): Promise<ConversationRuleLog> {
  const { data, error } = await supabase
    .from('conversation_rule_logs')
    .insert({
      rule_id: ruleId,
      conversation_id: conversationId,
      trigger_time: new Date().toISOString(),
      action_results: actionResults,
      success,
      error_message: errorMessage,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ConversationRuleLog;
}

export async function getTriggerCountToday(
  ruleId: string,
  conversationId: string
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('conversation_rule_logs')
    .select('*', { count: 'exact', head: true })
    .eq('rule_id', ruleId)
    .eq('conversation_id', conversationId)
    .gte('trigger_time', today.toISOString());

  if (error) throw error;
  return count || 0;
}

export async function canTriggerRule(
  rule: ConversationRule,
  conversationId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (rule.cooldown_minutes > 0 && rule.last_triggered_at) {
    const cooldownEnd = new Date(rule.last_triggered_at);
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + rule.cooldown_minutes);
    if (new Date() < cooldownEnd) {
      return { allowed: false, reason: 'Rule is in cooldown period' };
    }
  }

  if (rule.max_triggers_per_day > 0) {
    const todayCount = await getTriggerCountToday(rule.id, conversationId);
    if (todayCount >= rule.max_triggers_per_day) {
      return { allowed: false, reason: 'Daily trigger limit reached' };
    }
  }

  return { allowed: true };
}

export function getTriggerTypeLabel(type: RuleTriggerType): string {
  const labels: Record<RuleTriggerType, string> = {
    incoming_message: 'When a message is received',
    new_conversation: 'When a conversation is created',
    conversation_reopened: 'When a closed conversation receives a message',
    no_reply_timeout: 'When no reply is sent within time limit',
    channel_message: 'When a message arrives on specific channel',
  };
  return labels[type];
}

export function getActionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    assign_user: 'Assign to User',
    assign_roundrobin: 'Round-Robin Assignment',
    add_tag: 'Add Tag',
    remove_tag: 'Remove Tag',
    close_conversation: 'Close Conversation',
    send_snippet: 'Send Snippet',
    generate_ai_draft: 'Generate AI Draft',
    notify_user: 'Notify User',
    create_task: 'Create Task',
  };
  return labels[type] || type;
}
