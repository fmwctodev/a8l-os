import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RuleCondition {
  id: string;
  field: string;
  operator: string;
  value: string | number | boolean | null;
}

interface RuleAction {
  id: string;
  action_type: string;
  config: Record<string, unknown>;
}

interface ConversationRule {
  id: string;
  organization_id: string;
  name: string;
  trigger_type: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  cooldown_minutes: number;
  max_triggers_per_day: number;
  continue_evaluation: boolean;
  is_enabled: boolean;
  last_triggered_at: string | null;
}

interface ActionResult {
  action_type: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

interface Message {
  id: string;
  organization_id: string;
  conversation_id: string;
  contact_id: string;
  channel: string;
  direction: string;
  body: string;
}

interface ExecutionContext {
  message: Message;
  conversation: Record<string, unknown>;
  contact: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { message_id, trigger_type } = await req.json();

    if (!message_id) {
      throw new Error("message_id is required");
    }

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", message_id)
      .single();

    if (messageError || !message) {
      throw new Error("Message not found");
    }

    if (message.direction !== "inbound") {
      return new Response(
        JSON.stringify({ success: true, message: "Skipped - not an inbound message" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", message.conversation_id)
      .single();

    const { data: contact } = await supabase
      .from("contacts")
      .select("*, tags:contact_tags(tag:tags(*))")
      .eq("id", message.contact_id)
      .single();

    const context: ExecutionContext = {
      message: message as Message,
      conversation: conversation || {},
      contact: contact || {},
    };

    const determinedTriggerType = trigger_type || determineTriggerType(context);

    const { data: rules } = await supabase
      .from("conversation_rules")
      .select("*")
      .eq("organization_id", message.organization_id)
      .eq("is_enabled", true)
      .order("priority");

    const results = {
      rulesEvaluated: 0,
      rulesTriggered: 0,
      actionResults: [] as { ruleId: string; ruleName: string; results: ActionResult[] }[],
    };

    for (const rule of (rules as ConversationRule[]) || []) {
      results.rulesEvaluated++;

      if (!matchesTriggerType(rule.trigger_type, determinedTriggerType)) {
        continue;
      }

      const canTrigger = await checkRuleLimits(supabase, rule, message.conversation_id);
      if (!canTrigger.allowed) {
        continue;
      }

      if (rule.conditions.length > 0) {
        const conditionsMatch = evaluateConditions(rule.conditions, context);
        if (!conditionsMatch) {
          continue;
        }
      }

      const actionResults: ActionResult[] = [];
      let allActionsSucceeded = true;

      for (const action of rule.actions) {
        const result = await executeAction(supabase, action, context);
        actionResults.push(result);
        if (!result.success) {
          allActionsSucceeded = false;
        }
      }

      await supabase
        .from("conversation_rule_logs")
        .insert({
          rule_id: rule.id,
          conversation_id: message.conversation_id,
          trigger_time: new Date().toISOString(),
          action_results: actionResults,
          success: allActionsSucceeded,
          error_message: allActionsSucceeded ? null : "One or more actions failed",
        });

      await supabase
        .from("conversation_rules")
        .update({ last_triggered_at: new Date().toISOString() })
        .eq("id", rule.id);

      results.rulesTriggered++;
      results.actionResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        results: actionResults,
      });

      if (!rule.continue_evaluation) {
        break;
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function determineTriggerType(context: ExecutionContext): string {
  const conv = context.conversation as { status?: string };
  if (conv.status === "closed") {
    return "conversation_reopened";
  }
  return "incoming_message";
}

function matchesTriggerType(ruleTrigger: string, actualTrigger: string): boolean {
  if (ruleTrigger === actualTrigger) return true;
  if (ruleTrigger === "incoming_message" && actualTrigger === "conversation_reopened") return true;
  if (ruleTrigger === "channel_message") return true;
  return false;
}

async function checkRuleLimits(
  supabase: ReturnType<typeof createClient>,
  rule: ConversationRule,
  conversationId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (rule.cooldown_minutes > 0 && rule.last_triggered_at) {
    const cooldownEnd = new Date(rule.last_triggered_at);
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + rule.cooldown_minutes);
    if (new Date() < cooldownEnd) {
      return { allowed: false, reason: "Rule is in cooldown period" };
    }
  }

  if (rule.max_triggers_per_day > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("conversation_rule_logs")
      .select("*", { count: "exact", head: true })
      .eq("rule_id", rule.id)
      .eq("conversation_id", conversationId)
      .gte("trigger_time", today.toISOString());

    if ((count || 0) >= rule.max_triggers_per_day) {
      return { allowed: false, reason: "Daily trigger limit reached" };
    }
  }

  return { allowed: true };
}

function evaluateConditions(conditions: RuleCondition[], context: ExecutionContext): boolean {
  for (const condition of conditions) {
    const fieldValue = getFieldValue(condition.field, context);
    const matches = evaluateCondition(condition.operator, fieldValue, condition.value);
    if (!matches) return false;
  }
  return true;
}

function getFieldValue(field: string, context: ExecutionContext): unknown {
  const parts = field.split(".");
  const [entity, ...path] = parts;

  let obj: unknown;
  switch (entity) {
    case "message":
      obj = context.message;
      break;
    case "conversation":
      obj = context.conversation;
      break;
    case "contact":
      obj = context.contact;
      break;
    default:
      return undefined;
  }

  for (const key of path) {
    if (obj === null || obj === undefined) return undefined;
    obj = (obj as Record<string, unknown>)[key];
  }

  return obj;
}

function evaluateCondition(operator: string, fieldValue: unknown, conditionValue: unknown): boolean {
  const strFieldValue = String(fieldValue ?? "").toLowerCase();
  const strConditionValue = String(conditionValue ?? "").toLowerCase();

  switch (operator) {
    case "equals":
      return strFieldValue === strConditionValue;
    case "not_equals":
      return strFieldValue !== strConditionValue;
    case "contains":
      return strFieldValue.includes(strConditionValue);
    case "not_contains":
      return !strFieldValue.includes(strConditionValue);
    case "is_empty":
      return fieldValue === null || fieldValue === undefined || fieldValue === "";
    case "is_not_empty":
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";
    case "greater_than":
      return Number(fieldValue) > Number(conditionValue);
    case "less_than":
      return Number(fieldValue) < Number(conditionValue);
    default:
      return false;
  }
}

async function executeAction(
  supabase: ReturnType<typeof createClient>,
  action: RuleAction,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    switch (action.action_type) {
      case "assign_user":
        return await assignUser(supabase, action.config, context);
      case "assign_roundrobin":
        return await assignRoundRobin(supabase, action.config, context);
      case "add_tag":
        return await addTag(supabase, action.config, context);
      case "remove_tag":
        return await removeTag(supabase, action.config, context);
      case "close_conversation":
        return await closeConversation(supabase, context);
      case "send_snippet":
        return await sendSnippet(supabase, action.config, context);
      case "generate_ai_draft":
        return await generateAIDraft(supabase, action.config, context);
      case "notify_user":
        return await notifyUser(supabase, action.config, context);
      case "create_task":
        return await createTask(supabase, action.config, context);
      default:
        return { action_type: action.action_type, success: false, error: "Unknown action type" };
    }
  } catch (error) {
    return {
      action_type: action.action_type,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function assignUser(
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<ActionResult> {
  const userId = config.user_id as string;
  if (!userId) {
    return { action_type: "assign_user", success: false, error: "No user_id specified" };
  }

  const { error } = await supabase
    .from("conversations")
    .update({ assigned_user_id: userId, updated_at: new Date().toISOString() })
    .eq("id", context.message.conversation_id);

  if (error) throw error;
  return { action_type: "assign_user", success: true, result: { assigned_to: userId } };
}

async function assignRoundRobin(
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<ActionResult> {
  const departmentId = config.department_id as string;

  let query = supabase
    .from("users")
    .select("id")
    .eq("organization_id", context.message.organization_id)
    .eq("status", "active");

  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

  const { data: users } = await query;
  if (!users || users.length === 0) {
    return { action_type: "assign_roundrobin", success: false, error: "No eligible users found" };
  }

  const randomIndex = Math.floor(Math.random() * users.length);
  const selectedUser = users[randomIndex];

  const { error } = await supabase
    .from("conversations")
    .update({ assigned_user_id: selectedUser.id, updated_at: new Date().toISOString() })
    .eq("id", context.message.conversation_id);

  if (error) throw error;
  return { action_type: "assign_roundrobin", success: true, result: { assigned_to: selectedUser.id } };
}

async function addTag(
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<ActionResult> {
  const tagIds = (config.tag_ids as string[]) || [];
  if (tagIds.length === 0) {
    return { action_type: "add_tag", success: false, error: "No tags specified" };
  }

  const inserts = tagIds.map((tagId) => ({
    contact_id: context.message.contact_id,
    tag_id: tagId,
  }));

  const { error } = await supabase.from("contact_tags").upsert(inserts, { onConflict: "contact_id,tag_id" });

  if (error) throw error;
  return { action_type: "add_tag", success: true, result: { tags_added: tagIds.length } };
}

async function removeTag(
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<ActionResult> {
  const tagIds = (config.tag_ids as string[]) || [];
  if (tagIds.length === 0) {
    return { action_type: "remove_tag", success: false, error: "No tags specified" };
  }

  const { error } = await supabase
    .from("contact_tags")
    .delete()
    .eq("contact_id", context.message.contact_id)
    .in("tag_id", tagIds);

  if (error) throw error;
  return { action_type: "remove_tag", success: true, result: { tags_removed: tagIds.length } };
}

async function closeConversation(
  supabase: ReturnType<typeof createClient>,
  context: ExecutionContext
): Promise<ActionResult> {
  const { error } = await supabase
    .from("conversations")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", context.message.conversation_id);

  if (error) throw error;
  return { action_type: "close_conversation", success: true };
}

async function sendSnippet(
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<ActionResult> {
  const snippetId = config.snippet_id as string;
  if (!snippetId) {
    return { action_type: "send_snippet", success: false, error: "No snippet_id specified" };
  }

  const { data: snippet } = await supabase.from("snippets").select("*").eq("id", snippetId).single();

  if (!snippet) {
    return { action_type: "send_snippet", success: false, error: "Snippet not found" };
  }

  let content = snippet.content;
  const contact = context.contact as Record<string, unknown>;
  content = content.replace(/\{\{contact\.first_name\}\}/gi, (contact.first_name as string) || "");
  content = content.replace(/\{\{contact\.last_name\}\}/gi, (contact.last_name as string) || "");
  content = content.replace(/\{\{contact\.email\}\}/gi, (contact.email as string) || "");
  content = content.replace(/\{\{contact\.phone\}\}/gi, (contact.phone as string) || "");
  content = content.replace(/\{\{contact\.company\}\}/gi, (contact.company as string) || "");
  content = content.replace(/\{\{[^}]+\}\}/g, "");

  const { error } = await supabase.from("messages").insert({
    organization_id: context.message.organization_id,
    conversation_id: context.message.conversation_id,
    contact_id: context.message.contact_id,
    channel: context.message.channel,
    direction: "outbound",
    body: content,
    status: "pending",
  });

  if (error) throw error;
  return { action_type: "send_snippet", success: true, result: { snippet_name: snippet.name } };
}

async function generateAIDraft(
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<ActionResult> {
  const agentId = config.agent_id as string;

  const { error } = await supabase.from("ai_drafts").insert({
    organization_id: context.message.organization_id,
    conversation_id: context.message.conversation_id,
    contact_id: context.message.contact_id,
    agent_id: agentId || null,
    draft_content: "[AI draft generation pending...]",
    draft_channel: context.message.channel,
    status: "pending",
    trigger_type: "auto",
    triggered_by_rule_id: config.rule_id as string || null,
    context_message_id: context.message.id,
    version: 1,
  });

  if (error) throw error;
  return { action_type: "generate_ai_draft", success: true };
}

async function notifyUser(
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<ActionResult> {
  const userId = config.user_id as string;
  const notificationMessage = (config.message as string) || "New conversation requires attention";

  if (!userId) {
    return { action_type: "notify_user", success: false, error: "No user_id specified" };
  }

  const { error } = await supabase.from("inbox_events").insert({
    organization_id: context.message.organization_id,
    conversation_id: context.message.conversation_id,
    event_type: "note_added",
    payload: {
      type: "rule_notification",
      message: notificationMessage,
      target_user_id: userId,
    },
    actor_user_id: null,
  });

  if (error) throw error;
  return { action_type: "notify_user", success: true, result: { notified_user: userId } };
}

async function createTask(
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<ActionResult> {
  const title = (config.title as string) || "Follow up on conversation";
  const assigneeId = config.assignee_id as string;
  const dueDays = (config.due_days as number) || 1;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const { error } = await supabase.from("contact_tasks").insert({
    contact_id: context.message.contact_id,
    assigned_to_user_id: assigneeId || null,
    created_by_user_id: assigneeId || null,
    title,
    description: `Auto-created by conversation rule`,
    due_date: dueDate.toISOString(),
    priority: "medium",
    status: "pending",
  });

  if (error) throw error;
  return { action_type: "create_task", success: true, result: { task_title: title } };
}
