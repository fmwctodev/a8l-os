import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  agent_id: string;
  contact_id: string;
  conversation_id?: string;
  instructions?: string;
  triggered_by: "user" | "automation";
  trigger_source_id?: string;
  user_id?: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

interface ContactData {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  source: string | null;
  status: string;
  owner_name: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
}

interface MessageData {
  channel: string;
  direction: string;
  body: string;
  sent_at: string;
}

interface MemoryData {
  memory_summary: string | null;
  key_facts: Record<string, string>;
  conversation_summary: string | null;
  last_decision: string | null;
  confidence_level: string | null;
  lead_stage: string | null;
}

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  get_contact: {
    name: "get_contact",
    description: "Retrieve full contact information including custom fields, tags, and owner details",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  get_timeline: {
    name: "get_timeline",
    description: "Get recent timeline events for the contact including notes, status changes, and activities",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of events to return (default 20)" },
      },
      required: [],
    },
  },
  get_conversation_history: {
    name: "get_conversation_history",
    description: "Get recent messages from conversations with the contact",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of messages to return (default 20)" },
      },
      required: [],
    },
  },
  get_appointment_history: {
    name: "get_appointment_history",
    description: "Get past and upcoming appointments for the contact",
    input_schema: {
      type: "object",
      properties: {
        include_past: { type: "boolean", description: "Include past appointments (default true)" },
        limit: { type: "number", description: "Maximum number of appointments to return (default 10)" },
      },
      required: [],
    },
  },
  add_note: {
    name: "add_note",
    description: "Add a note to the contact record",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The note content" },
      },
      required: ["content"],
    },
  },
  update_field: {
    name: "update_field",
    description: "Update a standard or custom field on the contact",
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string", description: "Field name to update" },
        value: { type: "string", description: "New value for the field" },
      },
      required: ["field", "value"],
    },
  },
  add_tag: {
    name: "add_tag",
    description: "Add a tag to the contact",
    input_schema: {
      type: "object",
      properties: {
        tag_name: { type: "string", description: "Tag name to add" },
      },
      required: ["tag_name"],
    },
  },
  remove_tag: {
    name: "remove_tag",
    description: "Remove a tag from the contact",
    input_schema: {
      type: "object",
      properties: {
        tag_name: { type: "string", description: "Tag name to remove" },
      },
      required: ["tag_name"],
    },
  },
  assign_owner: {
    name: "assign_owner",
    description: "Assign a new owner to the contact. You must know the user ID.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "User ID to assign as owner" },
      },
      required: ["user_id"],
    },
  },
  create_appointment: {
    name: "create_appointment",
    description: "Create a new appointment for the contact",
    input_schema: {
      type: "object",
      properties: {
        appointment_type_id: { type: "string", description: "Appointment type ID" },
        start_at: { type: "string", description: "Start time in ISO format" },
        notes: { type: "string", description: "Optional appointment notes" },
      },
      required: ["appointment_type_id", "start_at"],
    },
  },
  send_sms: {
    name: "send_sms",
    description: "Prepare an SMS message draft for user approval. The message will NOT be sent automatically.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "SMS message body" },
      },
      required: ["message"],
    },
  },
  send_email: {
    name: "send_email",
    description: "Prepare an email draft for user approval. The email will NOT be sent automatically.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body" },
      },
      required: ["subject", "body"],
    },
  },
};

const MAX_TOOL_CALLS = 10;
const MAX_COMMUNICATION_DRAFTS = 5;
const EXECUTION_TIMEOUT_MS = 30000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!anthropicApiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY environment variable");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload: RequestPayload = await req.json();
    const { agent_id, contact_id, conversation_id, instructions, triggered_by, trigger_source_id, user_id } = payload;

    if (!agent_id || !contact_id || !triggered_by) {
      throw new Error("Missing required fields: agent_id, contact_id, triggered_by");
    }

    const { data: agent, error: agentError } = await supabase
      .from("ai_agents")
      .select("*")
      .eq("id", agent_id)
      .maybeSingle();

    if (agentError) throw agentError;
    if (!agent) throw new Error("Agent not found");
    if (!agent.enabled) throw new Error("Agent is disabled");

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select(`
        *,
        owner:users!owner_id(id, name),
        department:departments!department_id(id, name),
        tags:contact_tags(tag:tags(*)),
        custom_field_values(*, custom_field:custom_fields(*))
      `)
      .eq("id", contact_id)
      .maybeSingle();

    if (contactError) throw contactError;
    if (!contact) throw new Error("Contact not found");

    const contactData: ContactData = {
      id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      job_title: contact.job_title,
      source: contact.source,
      status: contact.status,
      owner_name: contact.owner?.name || null,
      tags: contact.tags?.map((t: { tag: { name: string } }) => t.tag.name) || [],
      custom_fields: {},
    };

    contact.custom_field_values?.forEach((cfv: { custom_field: { field_key: string }; value: unknown }) => {
      if (cfv.custom_field) {
        contactData.custom_fields[cfv.custom_field.field_key] = cfv.value;
      }
    });

    let conversationHistory: MessageData[] = [];
    if (conversation_id) {
      const { data: messages } = await supabase
        .from("messages")
        .select("channel, direction, body, sent_at")
        .eq("conversation_id", conversation_id)
        .order("sent_at", { ascending: false })
        .limit(20);

      conversationHistory = (messages || []).reverse();
    }

    const { data: memory } = await supabase
      .from("ai_agent_memory")
      .select("*")
      .eq("agent_id", agent_id)
      .eq("contact_id", contact_id)
      .maybeSingle();

    const memoryData: MemoryData = memory || {
      memory_summary: null,
      key_facts: {},
      conversation_summary: null,
      last_decision: null,
      confidence_level: null,
      lead_stage: null,
    };

    const inputPrompt = buildInputPrompt(agent, contactData, conversationHistory, memoryData, instructions);

    const { data: run, error: runError } = await supabase
      .from("ai_agent_runs")
      .insert({
        org_id: agent.org_id,
        agent_id,
        contact_id,
        conversation_id: conversation_id || null,
        triggered_by,
        trigger_source_id: trigger_source_id || null,
        status: "running",
        input_prompt: inputPrompt,
      })
      .select()
      .single();

    if (runError) throw runError;

    const allowedTools = (agent.allowed_tools as string[]) || [];
    const tools = allowedTools
      .filter((t) => TOOL_DEFINITIONS[t])
      .map((t) => TOOL_DEFINITIONS[t]);

    let toolCallsCount = 0;
    let communicationDraftsCount = 0;
    let draftMessage: string | null = null;
    let draftChannel: string | null = null;
    let draftSubject: string | null = null;
    const actionsSummary: string[] = [];
    const toolResults: Array<{ name: string; result: unknown }> = [];
    let llmMessages: Array<{ role: string; content: unknown }> = [
      { role: "user", content: inputPrompt },
    ];

    const executeToolCall = async (
      toolName: string,
      toolInput: Record<string, unknown>
    ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
      const toolStartTime = Date.now();

      try {
        let result: { success: boolean; data?: unknown; error?: string };

        switch (toolName) {
          case "get_contact": {
            result = { success: true, data: contactData };
            break;
          }

          case "get_timeline": {
            const limit = (toolInput.limit as number) || 20;
            const { data: events } = await supabase
              .from("contact_timeline")
              .select("*, user:users!user_id(name)")
              .eq("contact_id", contact_id)
              .order("created_at", { ascending: false })
              .limit(limit);

            result = {
              success: true,
              data: events?.map((e) => ({
                event_type: e.event_type,
                event_data: e.event_data,
                created_at: e.created_at,
                user_name: e.user?.name,
              })),
            };
            break;
          }

          case "get_conversation_history": {
            const limit = (toolInput.limit as number) || 20;
            const { data: messages } = await supabase
              .from("messages")
              .select("channel, direction, body, sent_at, status")
              .eq("contact_id", contact_id)
              .order("sent_at", { ascending: false })
              .limit(limit);

            result = { success: true, data: (messages || []).reverse() };
            break;
          }

          case "get_appointment_history": {
            const includePast = toolInput.include_past !== false;
            const limit = (toolInput.limit as number) || 10;

            let query = supabase
              .from("appointments")
              .select("*, appointment_type:appointment_types(name), assigned_user:users!assigned_user_id(name)")
              .eq("contact_id", contact_id)
              .order("start_at_utc", { ascending: false })
              .limit(limit);

            if (!includePast) {
              query = query.gte("start_at_utc", new Date().toISOString());
            }

            const { data: appointments } = await query;

            result = {
              success: true,
              data: appointments?.map((a) => ({
                type_name: a.appointment_type?.name,
                status: a.status,
                start_at: a.start_at_utc,
                end_at: a.end_at_utc,
                assigned_user: a.assigned_user?.name,
              })),
            };
            break;
          }

          case "add_note": {
            const content = toolInput.content as string;
            await supabase.from("contact_notes").insert({
              contact_id,
              user_id: user_id || null,
              content,
              is_pinned: false,
            });

            await supabase.from("contact_timeline").insert({
              contact_id,
              user_id: user_id || null,
              event_type: "note_added",
              event_data: { content: content.substring(0, 100), source: "ai_agent", agent_name: agent.name },
            });

            actionsSummary.push(`Added note: "${content.substring(0, 50)}..."`);
            result = { success: true, data: { added: true } };
            break;
          }

          case "update_field": {
            const field = toolInput.field as string;
            const value = toolInput.value as string;

            const standardFields = [
              "first_name", "last_name", "email", "phone", "company", "job_title",
              "address_line1", "address_line2", "city", "state", "postal_code", "country", "source",
            ];

            if (standardFields.includes(field)) {
              await supabase
                .from("contacts")
                .update({ [field]: value })
                .eq("id", contact_id);
            } else {
              const { data: customField } = await supabase
                .from("custom_fields")
                .select("id")
                .eq("field_key", field)
                .maybeSingle();

              if (!customField) {
                result = { success: false, error: `Field "${field}" not found` };
                break;
              }

              await supabase.from("contact_custom_field_values").upsert(
                { contact_id, custom_field_id: customField.id, value },
                { onConflict: "contact_id,custom_field_id" }
              );
            }

            await supabase.from("contact_timeline").insert({
              contact_id,
              event_type: "field_updated",
              event_data: { field, new_value: value, source: "ai_agent", agent_name: agent.name },
            });

            actionsSummary.push(`Updated ${field} to "${value}"`);
            result = { success: true, data: { field, value } };
            break;
          }

          case "add_tag": {
            const tagName = toolInput.tag_name as string;
            const { data: existingTag } = await supabase
              .from("tags")
              .select("id")
              .eq("organization_id", agent.org_id)
              .eq("name", tagName)
              .maybeSingle();

            let tagId: string;
            if (existingTag) {
              tagId = existingTag.id;
            } else {
              const { data: newTag } = await supabase
                .from("tags")
                .insert({ organization_id: agent.org_id, name: tagName, color: "#6B7280" })
                .select()
                .single();
              tagId = newTag.id;
            }

            await supabase
              .from("contact_tags")
              .upsert({ contact_id, tag_id: tagId }, { onConflict: "contact_id,tag_id" });

            await supabase.from("contact_timeline").insert({
              contact_id,
              event_type: "tag_added",
              event_data: { tag_name: tagName, source: "ai_agent", agent_name: agent.name },
            });

            actionsSummary.push(`Added tag "${tagName}"`);
            result = { success: true, data: { tag_name: tagName } };
            break;
          }

          case "remove_tag": {
            const tagName = toolInput.tag_name as string;
            const { data: tag } = await supabase
              .from("tags")
              .select("id")
              .eq("organization_id", agent.org_id)
              .eq("name", tagName)
              .maybeSingle();

            if (!tag) {
              result = { success: false, error: `Tag "${tagName}" not found` };
              break;
            }

            await supabase.from("contact_tags").delete().eq("contact_id", contact_id).eq("tag_id", tag.id);

            await supabase.from("contact_timeline").insert({
              contact_id,
              event_type: "tag_removed",
              event_data: { tag_name: tagName, source: "ai_agent", agent_name: agent.name },
            });

            actionsSummary.push(`Removed tag "${tagName}"`);
            result = { success: true, data: { tag_name: tagName } };
            break;
          }

          case "assign_owner": {
            const newOwnerId = toolInput.user_id as string;
            const { data: newOwner } = await supabase
              .from("users")
              .select("id, name")
              .eq("id", newOwnerId)
              .maybeSingle();

            if (!newOwner) {
              result = { success: false, error: "User not found" };
              break;
            }

            await supabase.from("contacts").update({ owner_id: newOwnerId }).eq("id", contact_id);

            await supabase.from("contact_timeline").insert({
              contact_id,
              event_type: "owner_changed",
              event_data: { new_owner_id: newOwnerId, new_owner_name: newOwner.name, source: "ai_agent", agent_name: agent.name },
            });

            actionsSummary.push(`Assigned owner to ${newOwner.name}`);
            result = { success: true, data: { user_id: newOwnerId, user_name: newOwner.name } };
            break;
          }

          case "create_appointment": {
            const appointmentTypeId = toolInput.appointment_type_id as string;
            const startAt = toolInput.start_at as string;
            const notes = toolInput.notes as string | undefined;

            const { data: appointmentType } = await supabase
              .from("appointment_types")
              .select("*, calendar:calendars!calendar_id(*)")
              .eq("id", appointmentTypeId)
              .maybeSingle();

            if (!appointmentType) {
              result = { success: false, error: "Appointment type not found" };
              break;
            }

            const startDate = new Date(startAt);
            const endDate = new Date(startDate.getTime() + appointmentType.duration_minutes * 60000);

            const { data: appointment } = await supabase
              .from("appointments")
              .insert({
                org_id: agent.org_id,
                calendar_id: appointmentType.calendar_id,
                appointment_type_id: appointmentTypeId,
                contact_id,
                status: "scheduled",
                start_at_utc: startDate.toISOString(),
                end_at_utc: endDate.toISOString(),
                visitor_timezone: "UTC",
                answers: {},
                source: "manual",
                reschedule_token: crypto.randomUUID(),
                cancel_token: crypto.randomUUID(),
                notes: notes || null,
                history: [{ action: "created", timestamp: new Date().toISOString() }],
              })
              .select()
              .single();

            await supabase.from("contact_timeline").insert({
              contact_id,
              event_type: "appointment_booked",
              event_data: {
                appointment_id: appointment.id,
                type_name: appointmentType.name,
                start_at: startAt,
                source: "ai_agent",
                agent_name: agent.name,
              },
            });

            actionsSummary.push(`Created appointment: ${appointmentType.name} at ${startAt}`);
            result = { success: true, data: { appointment_id: appointment.id } };
            break;
          }

          case "send_sms": {
            if (communicationDraftsCount >= MAX_COMMUNICATION_DRAFTS) {
              result = { success: false, error: "Maximum communication drafts reached" };
              break;
            }

            if (!contactData.phone) {
              result = { success: false, error: "Contact does not have a phone number" };
              break;
            }

            const message = toolInput.message as string;
            draftMessage = message;
            draftChannel = "sms";
            communicationDraftsCount++;

            actionsSummary.push(`Prepared SMS draft: "${message.substring(0, 50)}..."`);
            result = {
              success: true,
              data: {
                status: "draft_created",
                message: "SMS draft created. User approval required before sending.",
                draft_message: message,
              },
            };
            break;
          }

          case "send_email": {
            if (communicationDraftsCount >= MAX_COMMUNICATION_DRAFTS) {
              result = { success: false, error: "Maximum communication drafts reached" };
              break;
            }

            if (!contactData.email) {
              result = { success: false, error: "Contact does not have an email address" };
              break;
            }

            const subject = toolInput.subject as string;
            const body = toolInput.body as string;
            draftMessage = body;
            draftSubject = subject;
            draftChannel = "email";
            communicationDraftsCount++;

            actionsSummary.push(`Prepared email draft: "${subject}"`);
            result = {
              success: true,
              data: {
                status: "draft_created",
                message: "Email draft created. User approval required before sending.",
                draft_subject: subject,
                draft_message: body,
              },
            };
            break;
          }

          default:
            result = { success: false, error: `Unknown tool: ${toolName}` };
        }

        await supabase.from("ai_agent_tool_calls").insert({
          org_id: agent.org_id,
          agent_run_id: run.id,
          tool_name: toolName,
          input_payload: toolInput,
          output_payload: result.data || null,
          status: result.success ? "success" : "failed",
          error_message: result.error || null,
          duration_ms: Date.now() - toolStartTime,
        });

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";

        await supabase.from("ai_agent_tool_calls").insert({
          org_id: agent.org_id,
          agent_run_id: run.id,
          tool_name: toolName,
          input_payload: toolInput,
          status: "failed",
          error_message: errorMessage,
          duration_ms: Date.now() - toolStartTime,
        });

        return { success: false, error: errorMessage };
      }
    };

    let continueProcessing = true;
    let outputSummary = "";

    while (continueProcessing && toolCallsCount < MAX_TOOL_CALLS) {
      if (Date.now() - startTime > EXECUTION_TIMEOUT_MS) {
        throw new Error("Execution timeout exceeded");
      }

      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: agent.max_tokens || 1024,
          temperature: agent.temperature || 0.7,
          system: agent.system_prompt,
          tools: tools.length > 0 ? tools : undefined,
          messages: llmMessages,
        }),
      });

      if (!anthropicResponse.ok) {
        const errorBody = await anthropicResponse.text();
        throw new Error(`Anthropic API error: ${anthropicResponse.status} - ${errorBody}`);
      }

      const anthropicData = await anthropicResponse.json();
      const stopReason = anthropicData.stop_reason;
      const content = anthropicData.content;

      if (stopReason === "end_turn" || stopReason === "stop_sequence") {
        const textContent = content.find((c: { type: string }) => c.type === "text");
        outputSummary = textContent?.text || "";
        continueProcessing = false;
      } else if (stopReason === "tool_use") {
        const toolUseBlocks = content.filter((c: { type: string }) => c.type === "tool_use");

        llmMessages.push({ role: "assistant", content });

        const toolResultsContent: Array<{ type: string; tool_use_id: string; content: string }> = [];

        for (const toolUse of toolUseBlocks) {
          toolCallsCount++;
          const result = await executeToolCall(toolUse.name, toolUse.input as Record<string, unknown>);
          toolResults.push({ name: toolUse.name, result });

          toolResultsContent.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });

          if (!result.success) {
            continueProcessing = false;
            break;
          }
        }

        llmMessages.push({ role: "user", content: toolResultsContent });
      } else {
        continueProcessing = false;
      }
    }

    const newMemory: Partial<MemoryData> = {};

    if (outputSummary) {
      const summaryMatch = outputSummary.match(/MEMORY_UPDATE:(.*?)(?:END_MEMORY|$)/s);
      if (summaryMatch) {
        try {
          const memoryUpdate = JSON.parse(summaryMatch[1].trim());
          if (memoryUpdate.key_facts) {
            newMemory.key_facts = { ...memoryData.key_facts, ...memoryUpdate.key_facts };
          }
          if (memoryUpdate.lead_stage) newMemory.lead_stage = memoryUpdate.lead_stage;
          if (memoryUpdate.confidence_level) newMemory.confidence_level = memoryUpdate.confidence_level;
          if (memoryUpdate.conversation_summary) newMemory.conversation_summary = memoryUpdate.conversation_summary;
          if (memoryUpdate.last_decision) newMemory.last_decision = memoryUpdate.last_decision;
        } catch {
        }
      }

      if (Object.keys(newMemory).length > 0) {
        await supabase.from("ai_agent_memory").upsert(
          {
            org_id: agent.org_id,
            agent_id,
            contact_id,
            ...newMemory,
          },
          { onConflict: "agent_id,contact_id" }
        );
      }
    }

    await supabase
      .from("ai_agent_runs")
      .update({
        status: "success",
        output_summary: outputSummary || actionsSummary.join("; ") || "No actions taken",
        draft_message: draftMessage,
        draft_channel: draftChannel,
        draft_subject: draftSubject,
        tool_calls_count: toolCallsCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        output_summary: outputSummary || actionsSummary.join("; ") || "No actions taken",
        actions_taken: actionsSummary,
        draft_message: draftMessage,
        draft_channel: draftChannel,
        draft_subject: draftSubject,
        tool_calls_count: toolCallsCount,
        requires_approval: !!draftMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Agent executor error:", error);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const payload: RequestPayload = await req.clone().json();
        if (payload.agent_id && payload.contact_id) {
          await supabase
            .from("ai_agent_runs")
            .update({
              status: "failed",
              error_message: error instanceof Error ? error.message : "Unknown error",
              completed_at: new Date().toISOString(),
            })
            .eq("agent_id", payload.agent_id)
            .eq("contact_id", payload.contact_id)
            .eq("status", "running");
        }
      } catch {
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildInputPrompt(
  agent: { name: string },
  contact: ContactData,
  conversationHistory: MessageData[],
  memory: MemoryData,
  instructions?: string
): string {
  let prompt = `You are the AI Agent "${agent.name}" analyzing a contact and their interactions.

## Contact Information
- Name: ${contact.first_name} ${contact.last_name}
- Email: ${contact.email || "Not provided"}
- Phone: ${contact.phone || "Not provided"}
- Company: ${contact.company || "Not provided"}
- Job Title: ${contact.job_title || "Not provided"}
- Source: ${contact.source || "Unknown"}
- Status: ${contact.status}
- Owner: ${contact.owner_name || "Unassigned"}
- Tags: ${contact.tags.length > 0 ? contact.tags.join(", ") : "None"}
`;

  if (Object.keys(contact.custom_fields).length > 0) {
    prompt += `\n## Custom Fields\n`;
    for (const [key, value] of Object.entries(contact.custom_fields)) {
      prompt += `- ${key}: ${value}\n`;
    }
  }

  if (memory.key_facts && Object.keys(memory.key_facts).length > 0) {
    prompt += `\n## Previous Knowledge (Memory)\n`;
    for (const [key, value] of Object.entries(memory.key_facts)) {
      prompt += `- ${key}: ${value}\n`;
    }
    if (memory.lead_stage) prompt += `- Lead Stage: ${memory.lead_stage}\n`;
    if (memory.confidence_level) prompt += `- Confidence: ${memory.confidence_level}\n`;
    if (memory.last_decision) prompt += `- Last Decision: ${memory.last_decision}\n`;
  }

  if (conversationHistory.length > 0) {
    prompt += `\n## Recent Conversation History\n`;
    conversationHistory.forEach((msg) => {
      const direction = msg.direction === "inbound" ? "Contact" : "Team";
      prompt += `[${msg.sent_at}] ${direction} (${msg.channel}): ${msg.body}\n`;
    });
  }

  if (instructions) {
    prompt += `\n## Additional Instructions\n${instructions}\n`;
  }

  prompt += `
## Guidelines
- Use the available tools to gather more information or take actions as needed.
- For any SMS or email communication, drafts will be created for user approval - they will NOT be sent automatically.
- If you learn new facts about this contact, include them in a MEMORY_UPDATE block at the end of your response.
- Be concise and action-oriented in your analysis.

If you want to store new information in memory, end your response with:
MEMORY_UPDATE:
{"key_facts": {"fact_name": "fact_value"}, "lead_stage": "stage", "confidence_level": "high/medium/low", "last_decision": "what you decided"}
END_MEMORY
`;

  return prompt;
}
