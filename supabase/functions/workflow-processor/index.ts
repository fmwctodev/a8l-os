import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface TriggerConfig {
  logic?: "and" | "or";
  rules?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
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

    const results = {
      eventsProcessed: 0,
      enrollmentsCreated: 0,
      jobsProcessed: 0,
      errors: [] as string[],
    };

    const { data: events } = await supabase
      .from("event_outbox")
      .select("*")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(50);

    for (const event of events || []) {
      try {
        const { data: triggers } = await supabase
          .from("workflow_triggers")
          .select(`
            *,
            workflow:workflows(id, org_id, status, published_definition)
          `)
          .eq("trigger_type", event.event_type)
          .eq("is_active", true)
          .eq("org_id", event.org_id);

        for (const trigger of triggers || []) {
          if (trigger.workflow?.status !== "published") continue;

          const config = trigger.trigger_config as TriggerConfig;
          if (config.rules && config.rules.length > 0) {
            const matches = evaluateTriggerConditions(config, event.payload);
            if (!matches) continue;
          }

          const contactId = event.contact_id;
          if (!contactId) continue;

          const { data: existingEnrollment } = await supabase
            .from("workflow_enrollments")
            .select("id")
            .eq("workflow_id", trigger.workflow_id)
            .eq("contact_id", contactId)
            .eq("status", "active")
            .maybeSingle();

          if (existingEnrollment) continue;

          const { data: latestVersion } = await supabase
            .from("workflow_versions")
            .select("id")
            .eq("workflow_id", trigger.workflow_id)
            .order("version_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!latestVersion) continue;

          const definition = trigger.workflow.published_definition as WorkflowDefinition;
          const triggerNode = definition.nodes.find((n) => n.type === "trigger");
          const firstEdge = triggerNode
            ? definition.edges.find((e) => e.source === triggerNode.id)
            : null;
          const firstNodeId = firstEdge?.target || null;

          const { data: enrollment } = await supabase
            .from("workflow_enrollments")
            .insert({
              org_id: event.org_id,
              workflow_id: trigger.workflow_id,
              version_id: latestVersion.id,
              contact_id: contactId,
              status: "active",
              current_node_id: firstNodeId,
              context_data: { trigger_event: event.payload },
            })
            .select()
            .single();

          if (enrollment && firstNodeId) {
            await supabase.from("workflow_jobs").insert({
              org_id: event.org_id,
              enrollment_id: enrollment.id,
              node_id: firstNodeId,
              run_at: new Date().toISOString(),
              status: "pending",
              execution_key: `${enrollment.id}-${firstNodeId}-${Date.now()}`,
            });
          }

          results.enrollmentsCreated++;
        }

        await supabase
          .from("event_outbox")
          .update({ processed_at: new Date().toISOString() })
          .eq("id", event.id);

        results.eventsProcessed++;
      } catch (err) {
        results.errors.push(`Event ${event.id}: ${err.message}`);
      }
    }

    const { data: jobs } = await supabase
      .from("workflow_jobs")
      .select(`
        *,
        enrollment:workflow_enrollments(
          *,
          workflow:workflows(published_definition),
          version:workflow_versions(definition),
          contact:contacts(*)
        )
      `)
      .eq("status", "pending")
      .lte("run_at", new Date().toISOString())
      .order("run_at", { ascending: true })
      .limit(20);

    for (const job of jobs || []) {
      try {
        await supabase
          .from("workflow_jobs")
          .update({ status: "running", attempts: job.attempts + 1 })
          .eq("id", job.id);

        const enrollment = job.enrollment;
        if (!enrollment || enrollment.status !== "active") {
          await supabase
            .from("workflow_jobs")
            .update({ status: "done" })
            .eq("id", job.id);
          continue;
        }

        const definition = (enrollment.version?.definition ||
          enrollment.workflow?.published_definition) as WorkflowDefinition;
        const node = definition.nodes.find((n) => n.id === job.node_id);

        if (!node) {
          await supabase
            .from("workflow_jobs")
            .update({ status: "failed", last_error: "Node not found" })
            .eq("id", job.id);
          continue;
        }

        const startTime = Date.now();

        await supabase.from("workflow_execution_logs").insert({
          org_id: job.org_id,
          enrollment_id: enrollment.id,
          node_id: job.node_id,
          event_type: "node_started",
          payload: { node_type: node.type },
        });

        let nextNodeId: string | null = null;

        switch (node.type) {
          case "condition": {
            const result = evaluateCondition(node.data, enrollment.contact, enrollment.context_data);
            const edge = definition.edges.find(
              (e) => e.source === node.id && e.sourceHandle === (result ? "true" : "false")
            );
            nextNodeId = edge?.target || null;
            break;
          }

          case "delay": {
            const runAt = calculateDelayRunAt(node.data);
            if (runAt > new Date()) {
              await supabase
                .from("workflow_jobs")
                .update({
                  status: "pending",
                  run_at: runAt.toISOString(),
                })
                .eq("id", job.id);
              results.jobsProcessed++;
              continue;
            }
            const edge = definition.edges.find((e) => e.source === node.id);
            nextNodeId = edge?.target || null;
            break;
          }

          case "action": {
            const actionResult = await executeAction(supabase, node.data, enrollment, job.org_id);

            if (actionResult && actionResult.branch) {
              const branchEdge = definition.edges.find(
                (e) => e.source === node.id && e.sourceHandle === actionResult.branch
              );
              nextNodeId = branchEdge?.target || null;

              if (!nextNodeId) {
                const defaultEdge = definition.edges.find(
                  (e) => e.source === node.id && (!e.sourceHandle || e.sourceHandle === "default")
                );
                nextNodeId = defaultEdge?.target || null;
              }

              if (actionResult.status === "pending_approval") {
                await supabase
                  .from("workflow_jobs")
                  .update({ status: "pending", last_error: "Waiting for AI draft approval" })
                  .eq("id", job.id);

                await supabase
                  .from("workflow_enrollments")
                  .update({
                    context_data: {
                      ...(enrollment.context_data as Record<string, unknown>),
                      waiting_for_approval: true,
                      pending_node_id: node.id,
                      pending_next_node_id: nextNodeId,
                    },
                  })
                  .eq("id", enrollment.id);

                results.jobsProcessed++;
                continue;
              }
            } else {
              const edge = definition.edges.find((e) => e.source === node.id);
              nextNodeId = edge?.target || null;
            }
            break;
          }

          case "end": {
            await supabase
              .from("workflow_enrollments")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                current_node_id: null,
              })
              .eq("id", enrollment.id);

            await supabase
              .from("workflow_jobs")
              .update({ status: "done" })
              .eq("id", job.id);

            await supabase.from("workflow_execution_logs").insert({
              org_id: job.org_id,
              enrollment_id: enrollment.id,
              node_id: job.node_id,
              event_type: "node_completed",
              payload: { node_type: "end" },
              duration_ms: Date.now() - startTime,
            });

            results.jobsProcessed++;
            continue;
          }
        }

        await supabase.from("workflow_execution_logs").insert({
          org_id: job.org_id,
          enrollment_id: enrollment.id,
          node_id: job.node_id,
          event_type: "node_completed",
          payload: { node_type: node.type, next_node: nextNodeId },
          duration_ms: Date.now() - startTime,
        });

        await supabase
          .from("workflow_jobs")
          .update({ status: "done" })
          .eq("id", job.id);

        if (nextNodeId) {
          await supabase
            .from("workflow_enrollments")
            .update({ current_node_id: nextNodeId })
            .eq("id", enrollment.id);

          await supabase.from("workflow_jobs").insert({
            org_id: job.org_id,
            enrollment_id: enrollment.id,
            node_id: nextNodeId,
            run_at: new Date().toISOString(),
            status: "pending",
            execution_key: `${enrollment.id}-${nextNodeId}-${Date.now()}`,
          });
        } else {
          await supabase
            .from("workflow_enrollments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              current_node_id: null,
            })
            .eq("id", enrollment.id);
        }

        results.jobsProcessed++;
      } catch (err) {
        results.errors.push(`Job ${job.id}: ${err.message}`);

        await supabase
          .from("workflow_jobs")
          .update({
            status: job.attempts >= 3 ? "failed" : "pending",
            last_error: err.message,
            run_at: new Date(Date.now() + Math.pow(2, job.attempts) * 60000).toISOString(),
          })
          .eq("id", job.id);

        if (job.attempts >= 3) {
          await supabase
            .from("workflow_enrollments")
            .update({ status: "errored" })
            .eq("id", job.enrollment_id);
        }
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Workflow processor error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function evaluateTriggerConditions(
  config: TriggerConfig,
  payload: Record<string, unknown>
): boolean {
  if (!config.rules || config.rules.length === 0) return true;

  const results = config.rules.map((rule) => {
    const value = payload[rule.field];
    switch (rule.operator) {
      case "equals":
        return value === rule.value;
      case "not_equals":
        return value !== rule.value;
      case "contains":
        return String(value).includes(String(rule.value));
      case "is_empty":
        return value === null || value === undefined || value === "";
      case "is_not_empty":
        return value !== null && value !== undefined && value !== "";
      default:
        return true;
    }
  });

  return config.logic === "or" ? results.some((r) => r) : results.every((r) => r);
}

function evaluateCondition(
  data: Record<string, unknown>,
  contact: Record<string, unknown>,
  contextData: Record<string, unknown>
): boolean {
  const conditions = data.conditions as TriggerConfig;
  if (!conditions?.rules || conditions.rules.length === 0) return true;

  const results = conditions.rules.map((rule) => {
    let value: unknown;
    if (rule.field.startsWith("contact.")) {
      value = contact[rule.field.replace("contact.", "")];
    } else if (rule.field.startsWith("context.")) {
      value = contextData[rule.field.replace("context.", "")];
    } else {
      value = contact[rule.field];
    }

    switch (rule.operator) {
      case "equals":
        return String(value).toLowerCase() === String(rule.value).toLowerCase();
      case "not_equals":
        return String(value).toLowerCase() !== String(rule.value).toLowerCase();
      case "contains":
        return String(value).toLowerCase().includes(String(rule.value).toLowerCase());
      case "is_empty":
        return value === null || value === undefined || value === "";
      case "is_not_empty":
        return value !== null && value !== undefined && value !== "";
      case "greater_than":
        return Number(value) > Number(rule.value);
      case "less_than":
        return Number(value) < Number(rule.value);
      default:
        return true;
    }
  });

  return conditions.logic === "or" ? results.some((r) => r) : results.every((r) => r);
}

function calculateDelayRunAt(data: Record<string, unknown>): Date {
  const now = new Date();

  switch (data.delayType) {
    case "wait_duration": {
      const duration = data.duration as { value: number; unit: string } | undefined;
      if (!duration) return now;

      const ms = now.getTime();
      switch (duration.unit) {
        case "minutes":
          return new Date(ms + duration.value * 60 * 1000);
        case "hours":
          return new Date(ms + duration.value * 60 * 60 * 1000);
        case "days":
          return new Date(ms + duration.value * 24 * 60 * 60 * 1000);
        default:
          return new Date(ms + duration.value * 60 * 1000);
      }
    }

    case "wait_until_datetime": {
      const datetime = data.datetime as string | undefined;
      if (!datetime) return now;
      return new Date(datetime);
    }

    case "wait_until_weekday_time": {
      const weekday = data.weekday as number | undefined;
      const time = data.time as string | undefined;
      if (weekday === undefined || !time) return now;

      const [hours, minutes] = time.split(":").map(Number);
      const result = new Date(now);
      result.setHours(hours, minutes, 0, 0);

      const currentWeekday = now.getDay();
      let daysToAdd = weekday - currentWeekday;
      if (daysToAdd < 0 || (daysToAdd === 0 && result <= now)) {
        daysToAdd += 7;
      }
      result.setDate(result.getDate() + daysToAdd);
      return result;
    }

    default:
      return now;
  }
}

async function executeAction(
  supabase: ReturnType<typeof createClient>,
  data: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string
): Promise<void> {
  const actionType = data.actionType as string;
  const config = data.config as Record<string, unknown>;
  const contact = enrollment.contact as Record<string, unknown>;
  const contactId = contact.id as string;

  switch (actionType) {
    case "add_tag": {
      const tagId = config.tagId as string;
      await supabase.from("contact_tags").upsert(
        { contact_id: contactId, tag_id: tagId },
        { onConflict: "contact_id,tag_id" }
      );

      await supabase.from("contact_timeline").insert({
        contact_id: contactId,
        event_type: "tag_added",
        event_data: { tag_id: tagId, source: "workflow" },
      });
      break;
    }

    case "remove_tag": {
      const tagId = config.tagId as string;
      await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", contactId)
        .eq("tag_id", tagId);

      await supabase.from("contact_timeline").insert({
        contact_id: contactId,
        event_type: "tag_removed",
        event_data: { tag_id: tagId, source: "workflow" },
      });
      break;
    }

    case "update_field": {
      const field = config.field as string;
      const value = resolveMergeFields(config.value as string, contact);
      await supabase
        .from("contacts")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", contactId);
      break;
    }

    case "assign_owner": {
      const userId = config.userId as string;
      await supabase
        .from("contacts")
        .update({ owner_id: userId, updated_at: new Date().toISOString() })
        .eq("id", contactId);
      break;
    }

    case "move_department": {
      const departmentId = config.departmentId as string;
      await supabase
        .from("contacts")
        .update({ department_id: departmentId, updated_at: new Date().toISOString() })
        .eq("id", contactId);
      break;
    }

    case "create_note": {
      const content = resolveMergeFields(config.content as string, contact);
      await supabase.from("contact_notes").insert({
        contact_id: contactId,
        content,
        is_pinned: false,
      });
      break;
    }

    case "send_sms": {
      const body = resolveMergeFields(config.body as string, contact);
      await sendSms(supabase, orgId, contactId, contact.phone as string, body);
      break;
    }

    case "send_email": {
      const subject = resolveMergeFields(config.subject as string, contact);
      const emailBody = resolveMergeFields(config.body as string, contact);
      await sendEmail(supabase, orgId, contactId, contact.email as string, subject, emailBody);
      break;
    }

    case "webhook_post": {
      const url = config.url as string;
      const headers = (config.headers as Record<string, string>) || {};
      const payload = {
        contact,
        enrollment_id: enrollment.id,
        workflow_id: (enrollment as Record<string, unknown>).workflow_id,
        ...((config.payload as Record<string, unknown>) || {}),
      };

      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
      });
      break;
    }

    case "invoke_ai_agent": {
      const agentId = config.agentId as string;
      const instructions = resolveMergeFields(
        (config.instructions as string) || "",
        contact
      );
      const outputVariable = (config.outputVariable as string) || "ai_agent_result";

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      const agentResponse = await fetch(
        `${supabaseUrl}/functions/v1/ai-agent-executor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            org_id: orgId,
            agent_id: agentId,
            contact_id: contactId,
            instructions,
            source: "workflow",
            enrollment_id: enrollment.id,
          }),
        }
      );

      const agentResult = await agentResponse.json();

      const contextData = (enrollment.context_data as Record<string, unknown>) || {};
      contextData[outputVariable] = {
        run_id: agentResult.run_id,
        status: agentResult.status,
        final_response: agentResult.final_response,
        drafts: agentResult.drafts,
        tool_calls: agentResult.tool_calls,
      };

      await supabase
        .from("workflow_enrollments")
        .update({ context_data: contextData })
        .eq("id", enrollment.id);
      break;
    }

    case "ai_conversation_reply":
    case "ai_email_draft":
    case "ai_follow_up_message":
    case "ai_lead_qualification":
    case "ai_booking_assist":
    case "ai_decision_step": {
      const result = await executeAIWorkflowAction(
        supabase,
        actionType,
        config,
        enrollment,
        orgId,
        contactId
      );

      const contextData = (enrollment.context_data as Record<string, unknown>) || {};
      if (!contextData.ai_outputs) {
        contextData.ai_outputs = {};
      }
      (contextData.ai_outputs as Record<string, unknown>)[data.nodeId || actionType] = result;

      await supabase
        .from("workflow_enrollments")
        .update({ context_data: contextData })
        .eq("id", enrollment.id);

      return result;
    }
  }
}

interface AIActionResult {
  success: boolean;
  status: string;
  branch?: string;
  output_raw?: string;
  output_structured?: Record<string, unknown>;
  draft_id?: string;
}

async function executeAIWorkflowAction(
  supabase: ReturnType<typeof createClient>,
  actionType: string,
  config: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string,
  contactId: string
): Promise<AIActionResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", contactId)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const response = await fetch(
    `${supabaseUrl}/functions/v1/workflow-ai-action-executor`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        workflow_id: enrollment.workflow_id,
        enrollment_id: enrollment.id,
        node_id: config.nodeId || actionType,
        action_type: actionType,
        action_config: config,
        contact_id: contactId,
        conversation_id: conversation?.id,
        org_id: orgId,
        context_data: enrollment.context_data,
      }),
    }
  );

  const result = await response.json();

  return {
    success: result.success,
    status: result.status,
    branch: result.branch,
    output_raw: result.output_raw,
    output_structured: result.output_structured,
    draft_id: result.draft_id,
  };
}

function resolveMergeFields(template: string, contact: Record<string, unknown>): string {
  const replacements: Record<string, string> = {
    "{{contact.first_name}}": (contact.first_name as string) || "",
    "{{contact.last_name}}": (contact.last_name as string) || "",
    "{{contact.email}}": (contact.email as string) || "",
    "{{contact.phone}}": (contact.phone as string) || "",
    "{{contact.company}}": (contact.company as string) || "",
    "{{contact.full_name}}": `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

async function sendSms(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  toPhone: string,
  body: string
): Promise<void> {
  if (!toPhone) return;

  const { data: config } = await supabase
    .from("channel_configurations")
    .select("config")
    .eq("organization_id", orgId)
    .eq("channel_type", "twilio")
    .eq("is_active", true)
    .maybeSingle();

  if (!config?.config) return;

  const twilioConfig = config.config as {
    account_sid: string;
    auth_token: string;
    phone_numbers: string[];
  };

  const fromNumber = twilioConfig.phone_numbers[0];
  if (!fromNumber) return;

  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = existingConv?.id;

  if (!conversationId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("department_id")
      .eq("id", contactId)
      .single();

    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        organization_id: orgId,
        contact_id: contactId,
        department_id: contact?.department_id,
        status: "open",
        unread_count: 0,
      })
      .select()
      .single();

    conversationId = newConv?.id;
  }

  const { data: message } = await supabase
    .from("messages")
    .insert({
      organization_id: orgId,
      conversation_id: conversationId,
      contact_id: contactId,
      channel: "sms",
      direction: "outbound",
      body,
      metadata: { from_number: fromNumber, to_number: toPhone, source: "workflow" },
      status: "pending",
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.account_sid}/Messages.json`;
  const auth = btoa(`${twilioConfig.account_sid}:${twilioConfig.auth_token}`);

  const response = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: fromNumber,
      To: toPhone,
      Body: body,
    }),
  });

  const result = await response.json();

  if (response.ok) {
    await supabase
      .from("messages")
      .update({ status: "sent", external_id: result.sid })
      .eq("id", message.id);
  } else {
    await supabase
      .from("messages")
      .update({ status: "failed", metadata: { ...message.metadata, error: result.message } })
      .eq("id", message.id);
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
}

async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<void> {
  if (!toEmail) return;

  const { data: tokenData } = await supabase
    .from("gmail_oauth_tokens")
    .select("*")
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();

  if (!tokenData) return;

  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = existingConv?.id;

  if (!conversationId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("department_id")
      .eq("id", contactId)
      .single();

    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        organization_id: orgId,
        contact_id: contactId,
        department_id: contact?.department_id,
        status: "open",
        unread_count: 0,
      })
      .select()
      .single();

    conversationId = newConv?.id;
  }

  await supabase.from("messages").insert({
    organization_id: orgId,
    conversation_id: conversationId,
    contact_id: contactId,
    channel: "email",
    direction: "outbound",
    body,
    subject,
    metadata: { from_email: tokenData.email, to_email: toEmail, source: "workflow" },
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
}
