import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { extractUserContext, requireAuth } from "../_shared/auth.ts";
import type { UserContext } from "../_shared/types.ts";
import { validateITSRequest, validateActionPayload, stripUnknownKeys } from "../_shared/its-validator.ts";
import { applyConfirmationOverrides } from "../_shared/its-confirmation-rules.ts";
import { validatePermissions } from "../_shared/its-permissions.ts";
import { validateIntegrationState } from "../_shared/its-integration-check.ts";
import { buildITSSystemPrompt } from "../_shared/its-system-prompt.ts";
import { resolveRefreshToken, refreshAccessToken } from "../_shared/google-oauth-helpers.ts";

interface PageContext {
  current_path: string;
  current_module: string | null;
  current_record_id: string | null;
}

interface ITSAction {
  action_id: string;
  type: string;
  module: string;
  payload: Record<string, unknown>;
  depends_on: string | null;
}

interface ITSRequest {
  intent: string;
  confidence: number;
  requires_confirmation: boolean;
  confirmation_reason: string | null;
  actions: ITSAction[];
  response_to_user: string;
}

interface ITSActionResult {
  action_id: string;
  status: "success" | "failed" | "skipped" | "awaiting_confirmation";
  resource_id: string | null;
  error: string | null;
}

interface LLMConfig {
  provider: "anthropic" | "openai";
  model: string;
  apiKey: string;
  baseUrl?: string;
}

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const userCtx = await extractUserContext(req, supabase);
    const user = requireAuth(userCtx);

    const { data: userData } = await supabase
      .from("users")
      .select("id, email, organization_id, name")
      .eq("id", user.id)
      .maybeSingle();
    if (!userData) return errorResponse("NOT_FOUND", "User not found", 404);

    const body = await req.json();
    const { thread_id, content, context, action, execution_request_id, approved, action_ids } = body as {
      thread_id: string;
      content?: string;
      context?: PageContext;
      action?: string;
      execution_request_id?: string;
      approved?: boolean;
      action_ids?: string[];
    };

    if (action === "confirm") {
      return handleConfirmation(supabase, user, userData, thread_id, execution_request_id!, approved!, action_ids);
    }

    const { data: profile } = await supabase
      .from("assistant_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: memories } = await supabase
      .from("assistant_user_memory")
      .select("memory_key, memory_value, category")
      .eq("user_id", user.id);

    const { data: prevMessages } = await supabase
      .from("assistant_messages")
      .select("role, content, message_type")
      .eq("thread_id", thread_id)
      .order("created_at", { ascending: true })
      .limit(40);

    const llmConfig = await resolveLLMConfig(supabase, userData.organization_id);

    const systemPrompt = buildITSSystemPrompt(
      { fullName: userData.name || userData.email, email: userData.email },
      profile,
      memories || [],
      context || null
    );

    const conversationHistory = (prevMessages || []).map(
      (m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })
    );
    conversationHistory.push({ role: "user", content: content || "" });

    const llmResponse = await callLLM(llmConfig, systemPrompt, conversationHistory);

    if (llmResponse.error) {
      return jsonResponse({
        response: `I encountered an issue: ${llmResponse.error}`,
        its_request: null,
        execution_result: null,
        tool_calls: [],
        confirmations_pending: [],
        drafts: [],
        model_used: llmConfig.model,
      });
    }

    const parsed = parseITSFromLLM(llmResponse.text);

    if (!parsed) {
      return jsonResponse({
        response: llmResponse.text || "I'm not sure how to help with that.",
        its_request: null,
        execution_result: null,
        tool_calls: [],
        confirmations_pending: [],
        drafts: [],
        model_used: llmConfig.model,
      });
    }

    const validation = validateITSRequest(parsed);
    if (!validation.valid || !validation.request) {
      return jsonResponse({
        response: `I generated an invalid action plan. Errors: ${(validation.errors || []).join("; ")}. Let me try a different approach -- could you rephrase your request?`,
        its_request: null,
        execution_result: null,
        tool_calls: [],
        confirmations_pending: [],
        drafts: [],
        model_used: llmConfig.model,
      });
    }

    let itsRequest = validation.request;

    const payloadErrors: string[] = [];
    itsRequest.actions = itsRequest.actions.map((a) => {
      const cleaned = stripUnknownKeys(a);
      const pv = validateActionPayload(cleaned);
      if (!pv.valid) payloadErrors.push(...pv.errors);
      return cleaned;
    });

    if (payloadErrors.length > 0) {
      return jsonResponse({
        response: `Some action payloads are invalid: ${payloadErrors.join("; ")}. Could you provide more details?`,
        its_request: itsRequest,
        execution_result: null,
        tool_calls: [],
        confirmations_pending: [],
        drafts: [],
        model_used: llmConfig.model,
      });
    }

    if (itsRequest.actions.length === 0) {
      return jsonResponse({
        response: itsRequest.response_to_user,
        its_request: itsRequest,
        execution_result: null,
        tool_calls: [],
        confirmations_pending: [],
        drafts: [],
        model_used: llmConfig.model,
      });
    }

    const permResult = validatePermissions(itsRequest.actions, user);
    if (permResult.denied.length > 0 && permResult.allowed.length === 0) {
      return jsonResponse({
        response: `I don't have permission to perform those actions: ${permResult.denied.map((d) => d.reason).join("; ")}`,
        its_request: itsRequest,
        execution_result: {
          execution_id: crypto.randomUUID(),
          status: "failed",
          results: permResult.denied.map((d) => ({
            action_id: d.action_id,
            status: "failed",
            resource_id: null,
            error: d.reason,
          })),
        },
        tool_calls: [],
        confirmations_pending: [],
        drafts: [],
        model_used: llmConfig.model,
      });
    }
    itsRequest.actions = permResult.allowed;

    const intResult = await validateIntegrationState(itsRequest.actions, {
      userId: user.id,
      orgId: user.orgId,
      supabase,
    });

    const integrationErrors = intResult.invalid.map((inv) => ({
      action_id: inv.action_id,
      status: "failed" as const,
      resource_id: null,
      error: inv.reason,
    }));
    itsRequest.actions = intResult.valid;

    if (itsRequest.actions.length === 0) {
      return jsonResponse({
        response: intResult.invalid.map((i) => i.reason).join(". "),
        its_request: itsRequest,
        execution_result: {
          execution_id: crypto.randomUUID(),
          status: "failed",
          results: integrationErrors,
        },
        tool_calls: [],
        confirmations_pending: [],
        drafts: [],
        model_used: llmConfig.model,
      });
    }

    itsRequest = await applyConfirmationOverrides(itsRequest, {
      userId: user.id,
      orgId: user.orgId,
      supabase,
      confirmAllWrites: profile?.confirm_all_writes ?? true,
    });

    const execRequestId = crypto.randomUUID();

    if (itsRequest.requires_confirmation) {
      await supabase.from("assistant_execution_requests").insert({
        id: execRequestId,
        user_id: user.id,
        org_id: user.orgId,
        thread_id,
        intent: itsRequest.intent,
        confidence: itsRequest.confidence,
        requires_confirmation: true,
        confirmation_reason: itsRequest.confirmation_reason,
        actions: itsRequest.actions,
        response_to_user: itsRequest.response_to_user,
        execution_status: "awaiting_confirmation",
        results: [],
        model_used: llmConfig.model,
        raw_llm_output: parsed,
      });

      for (const act of itsRequest.actions) {
        await supabase.from("assistant_action_logs").insert({
          user_id: user.id,
          org_id: user.orgId,
          thread_id,
          request_id: execRequestId,
          execution_request_id: execRequestId,
          action_id: act.action_id,
          action_type: act.type,
          target_module: act.module,
          input_summary: describeAction(act),
          execution_status: "queued",
          tool_calls: [act],
          depends_on: act.depends_on,
          confirmed_by_user: null,
        });
      }

      return jsonResponse({
        response: itsRequest.response_to_user,
        its_request: itsRequest,
        execution_result: {
          execution_id: execRequestId,
          status: "awaiting_confirmation",
          results: itsRequest.actions.map((a) => ({
            action_id: a.action_id,
            status: "awaiting_confirmation",
            resource_id: null,
            error: null,
          })),
        },
        tool_calls: [],
        confirmations_pending: itsRequest.actions.map((a) => ({
          id: a.action_id,
          action_type: a.type,
          description: describeAction(a),
          details: a.payload,
          status: "pending",
        })),
        drafts: extractDrafts(itsRequest.actions),
        model_used: llmConfig.model,
      });
    }

    const executionResult = await executeActionPlan(
      supabase, user, userData, thread_id, execRequestId, itsRequest, llmConfig.model, parsed
    );

    const allResults = [...executionResult.results, ...integrationErrors];
    const overallStatus = allResults.every((r) => r.status === "success")
      ? "success"
      : allResults.every((r) => r.status === "failed")
        ? "failed"
        : "partial";

    return jsonResponse({
      response: itsRequest.response_to_user,
      its_request: itsRequest,
      execution_result: {
        execution_id: execRequestId,
        status: overallStatus,
        results: allResults,
      },
      tool_calls: allResults.map((r) => {
        const act = itsRequest.actions.find((a) => a.action_id === r.action_id);
        return {
          id: r.action_id,
          tool_name: act?.type || "unknown",
          input: act?.payload || {},
          output: r.resource_id ? { id: r.resource_id } : (r.error ? { error: r.error } : {}),
          status: r.status === "success" ? "success" : "error",
          duration_ms: 0,
        };
      }),
      confirmations_pending: [],
      drafts: extractDrafts(itsRequest.actions),
      model_used: llmConfig.model,
    });
  } catch (err) {
    console.error("[assistant-chat] Error:", err);
    return errorResponse(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Internal error",
      500
    );
  }
});

async function handleConfirmation(
  supabase: SupabaseClient,
  user: UserContext,
  userData: { id: string; organization_id: string; email: string; name: string },
  threadId: string,
  executionRequestId: string,
  approved: boolean,
  actionIds?: string[]
) {
  const { data: execReq } = await supabase
    .from("assistant_execution_requests")
    .select("*")
    .eq("id", executionRequestId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!execReq) {
    return errorResponse("NOT_FOUND", "Execution request not found", 404);
  }

  if (execReq.execution_status !== "awaiting_confirmation") {
    return errorResponse("INVALID_STATE", "Request is not awaiting confirmation", 400);
  }

  if (!approved) {
    await supabase
      .from("assistant_execution_requests")
      .update({ execution_status: "failed", completed_at: new Date().toISOString() })
      .eq("id", executionRequestId);

    await supabase
      .from("assistant_action_logs")
      .update({ execution_status: "canceled", confirmed_by_user: false })
      .eq("execution_request_id", executionRequestId);

    return jsonResponse({
      response: "Actions canceled.",
      its_request: null,
      execution_result: {
        execution_id: executionRequestId,
        status: "failed",
        results: (execReq.actions as ITSAction[]).map((a) => ({
          action_id: a.action_id,
          status: "skipped",
          resource_id: null,
          error: "Rejected by user",
        })),
      },
      tool_calls: [],
      confirmations_pending: [],
      drafts: [],
      model_used: "system",
    });
  }

  let actions = execReq.actions as ITSAction[];
  if (actionIds && actionIds.length > 0) {
    const approvedSet = new Set(actionIds);
    actions = actions.filter((a) => approvedSet.has(a.action_id));
  }

  const itsRequest: ITSRequest = {
    intent: execReq.intent,
    confidence: execReq.confidence,
    requires_confirmation: false,
    confirmation_reason: null,
    actions,
    response_to_user: execReq.response_to_user,
  };

  const result = await executeActionPlan(
    supabase, user, userData, threadId, executionRequestId, itsRequest, execReq.model_used, null
  );

  return jsonResponse({
    response: "Actions approved and executed.",
    its_request: itsRequest,
    execution_result: {
      execution_id: executionRequestId,
      status: result.results.every((r) => r.status === "success") ? "success" : "partial",
      results: result.results,
    },
    tool_calls: [],
    confirmations_pending: [],
    drafts: [],
    model_used: execReq.model_used,
  });
}

async function executeActionPlan(
  supabase: SupabaseClient,
  user: UserContext,
  userData: { id: string; organization_id: string; email: string; name: string },
  threadId: string,
  execRequestId: string,
  itsRequest: ITSRequest,
  modelUsed: string,
  rawLlmOutput: unknown
): Promise<{ results: ITSActionResult[] }> {
  const sorted = topologicalSort(itsRequest.actions);
  const results: ITSActionResult[] = [];
  const resourceMap = new Map<string, string>();

  await supabase.from("assistant_execution_requests").upsert({
    id: execRequestId,
    user_id: user.id,
    org_id: user.orgId,
    thread_id: threadId,
    intent: itsRequest.intent,
    confidence: itsRequest.confidence,
    requires_confirmation: false,
    confirmation_reason: null,
    actions: itsRequest.actions,
    response_to_user: itsRequest.response_to_user,
    execution_status: "executing",
    results: [],
    model_used: modelUsed,
    raw_llm_output: rawLlmOutput,
  }, { onConflict: "id" });

  for (const act of sorted) {
    if (act.depends_on) {
      const parentResult = results.find((r) => r.action_id === act.depends_on);
      if (parentResult && parentResult.status === "failed") {
        results.push({
          action_id: act.action_id,
          status: "skipped",
          resource_id: null,
          error: `Skipped because dependency ${act.depends_on} failed`,
        });
        continue;
      }
    }

    const resolvedAction = resolveDependencyIds(act, resourceMap);
    const startTime = Date.now();
    let result: ITSActionResult;

    try {
      result = await executeITSAction(supabase, user, userData, resolvedAction);
    } catch (e) {
      result = {
        action_id: act.action_id,
        status: "failed",
        resource_id: null,
        error: e instanceof Error ? e.message : "Execution failed",
      };
    }

    const duration = Date.now() - startTime;

    if (result.resource_id) {
      resourceMap.set(act.action_id, result.resource_id);
    }

    results.push(result);

    await supabase.from("assistant_action_logs").insert({
      user_id: user.id,
      org_id: user.orgId,
      thread_id: threadId,
      request_id: execRequestId,
      execution_request_id: execRequestId,
      action_id: act.action_id,
      action_type: act.type,
      target_module: act.module,
      target_id: result.resource_id || null,
      input_summary: describeAction(act),
      output_summary: result.resource_id
        ? `Created ${result.resource_id}`
        : result.error || "Completed",
      execution_status: result.status === "success" ? "success" : "failed",
      execution_time_ms: duration,
      error_message: result.error,
      tool_calls: [{ ...act, output: result }],
      depends_on: act.depends_on,
      confirmed_by_user: true,
    });
  }

  const overallStatus = results.every((r) => r.status === "success")
    ? "success"
    : results.every((r) => r.status === "failed" || r.status === "skipped")
      ? "failed"
      : "partial";

  await supabase
    .from("assistant_execution_requests")
    .update({
      execution_status: overallStatus,
      results,
      completed_at: new Date().toISOString(),
    })
    .eq("id", execRequestId);

  return { results };
}

async function executeITSAction(
  supabase: SupabaseClient,
  user: UserContext,
  userData: { id: string; organization_id: string; email: string; name: string },
  action: ITSAction
): Promise<ITSActionResult> {
  const p = action.payload;

  switch (action.type) {
    case "create_contact": {
      const { data: dept } = await supabase
        .from("departments")
        .select("id")
        .eq("org_id", user.orgId)
        .limit(1)
        .maybeSingle();

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          organization_id: user.orgId,
          department_id: dept?.id || user.departmentId,
          first_name: p.first_name,
          last_name: p.last_name || "",
          email: p.email || null,
          phone: p.phone || null,
          company: p.company || null,
          created_by_user_id: user.id,
          owner_id: user.id,
          source: "clara_assistant",
        })
        .select("id")
        .single();
      if (error) return fail(action, error.message);
      return ok(action, data.id);
    }

    case "update_contact": {
      const updates = p.updates as Record<string, unknown>;
      const { error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", p.contact_id as string)
        .eq("organization_id", user.orgId);
      if (error) return fail(action, error.message);
      return ok(action, p.contact_id as string);
    }

    case "create_opportunity": {
      const { data, error } = await supabase
        .from("opportunities")
        .insert({
          org_id: user.orgId,
          contact_id: p.contact_id,
          pipeline_id: p.pipeline_id,
          stage_id: p.stage_id,
          value_amount: p.value_amount || 0,
          close_date: p.close_date || null,
          source: p.source || "clara_assistant",
          created_by: user.id,
          assigned_user_id: user.id,
        })
        .select("id")
        .single();
      if (error) return fail(action, error.message);
      return ok(action, data.id);
    }

    case "move_opportunity": {
      const { error } = await supabase
        .from("opportunities")
        .update({
          stage_id: p.new_stage_id,
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", p.opportunity_id as string)
        .eq("org_id", user.orgId);
      if (error) return fail(action, error.message);
      return ok(action, p.opportunity_id as string);
    }

    case "create_project": {
      const { data: projPipeline } = await supabase
        .from("pipelines")
        .select("id")
        .eq("org_id", user.orgId)
        .limit(1)
        .maybeSingle();

      let stageId: string | null = null;
      if (projPipeline) {
        const { data: stage } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("pipeline_id", projPipeline.id)
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle();
        stageId = stage?.id || null;
      }

      const { data: dept } = await supabase
        .from("departments")
        .select("id")
        .eq("org_id", user.orgId)
        .limit(1)
        .maybeSingle();

      let contactId: string | null = null;
      if (p.opportunity_id) {
        const { data: opp } = await supabase
          .from("opportunities")
          .select("contact_id")
          .eq("id", p.opportunity_id as string)
          .maybeSingle();
        contactId = opp?.contact_id || null;
      }

      const { data, error } = await supabase
        .from("projects")
        .insert({
          org_id: user.orgId,
          contact_id: contactId || user.id,
          opportunity_id: p.opportunity_id || null,
          pipeline_id: projPipeline?.id,
          stage_id: stageId,
          department_id: dept?.id || user.departmentId,
          name: p.name,
          description: p.description || null,
          budget_amount: p.budget_amount || 0,
          start_date: p.start_date || null,
          target_end_date: p.target_end_date || null,
          created_by: user.id,
          assigned_user_id: user.id,
        })
        .select("id")
        .single();
      if (error) return fail(action, error.message);
      return ok(action, data.id);
    }

    case "create_task": {
      const { data: calendar } = await supabase
        .from("calendars")
        .select("id")
        .eq("org_id", user.orgId)
        .limit(1)
        .maybeSingle();

      if (!calendar) return fail(action, "No calendar found. Please create a calendar first.");

      const dueDate = p.due_date
        ? new Date(p.due_date as string).toISOString()
        : new Date(Date.now() + 86400000).toISOString();

      const { data, error } = await supabase
        .from("calendar_tasks")
        .insert({
          org_id: user.orgId,
          calendar_id: calendar.id,
          user_id: user.id,
          title: p.title,
          description: p.description || null,
          due_at_utc: dueDate,
          priority: p.priority || "medium",
          status: "pending",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) return fail(action, error.message);
      return ok(action, data.id);
    }

    case "draft_email": {
      return {
        action_id: action.action_id,
        status: "success",
        resource_id: `draft-${action.action_id}`,
        error: null,
      };
    }

    case "send_email": {
      const token = await resolveGmailAccessToken(supabase, user.id, user.orgId);
      if (!token) return fail(action, "Gmail not connected. Please connect Gmail in Settings > Integrations.");

      const to = (p.to as string[]) || [];
      const cc = (p.cc as string[]) || [];
      const subject = (p.subject as string) || "";
      const body = (p.body as string) || "";

      const raw = createRawEmail(userData.email, to, cc, subject, body);

      const gmailBody: Record<string, unknown> = { raw };
      if (p.reply_to_message_id) {
        gmailBody.threadId = p.reply_to_message_id;
      }

      const gmailRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(gmailBody),
        }
      );

      if (!gmailRes.ok) {
        const errText = await gmailRes.text();
        return fail(action, `Gmail send failed: ${errText}`);
      }

      const sent = await gmailRes.json();
      return ok(action, sent.id);
    }

    case "send_sms": {
      return {
        action_id: action.action_id,
        status: "success",
        resource_id: null,
        error: null,
      };
    }

    case "create_event": {
      const token = await resolveCalendarAccessToken(supabase, user.id, user.orgId);
      if (!token) return fail(action, "Google Calendar not connected. Please connect in Settings > Calendars.");

      const eventBody: Record<string, unknown> = {
        summary: p.title,
        description: p.description || "",
        start: { dateTime: p.start_time, timeZone: "UTC" },
        end: { dateTime: p.end_time, timeZone: "UTC" },
      };
      if (p.location) eventBody.location = p.location;
      if (p.attendees && Array.isArray(p.attendees)) {
        eventBody.attendees = (p.attendees as string[]).map((e) => ({ email: e }));
      }

      const calRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        }
      );

      if (!calRes.ok) {
        const errText = await calRes.text();
        return fail(action, `Calendar event creation failed: ${errText}`);
      }

      const event = await calRes.json();
      return ok(action, event.id);
    }

    case "update_event": {
      const token = await resolveCalendarAccessToken(supabase, user.id, user.orgId);
      if (!token) return fail(action, "Google Calendar not connected.");

      const updates = p.updates as Record<string, unknown>;
      const patchBody: Record<string, unknown> = {};
      if (updates.title) patchBody.summary = updates.title;
      if (updates.description) patchBody.description = updates.description;
      if (updates.start_time) patchBody.start = { dateTime: updates.start_time, timeZone: "UTC" };
      if (updates.end_time) patchBody.end = { dateTime: updates.end_time, timeZone: "UTC" };
      if (updates.location) patchBody.location = updates.location;

      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${p.event_id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patchBody),
        }
      );

      if (!calRes.ok) return fail(action, "Calendar event update failed");
      return ok(action, p.event_id as string);
    }

    case "cancel_event": {
      const token = await resolveCalendarAccessToken(supabase, user.id, user.orgId);
      if (!token) return fail(action, "Google Calendar not connected.");

      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${p.event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!calRes.ok && calRes.status !== 410) {
        return fail(action, "Calendar event cancellation failed");
      }
      return ok(action, p.event_id as string);
    }

    case "create_proposal_draft": {
      const { data, error } = await supabase
        .from("proposals")
        .insert({
          org_id: user.orgId,
          contact_id: p.contact_id,
          opportunity_id: p.opportunity_id || null,
          title: p.title,
          status: "draft",
          summary: p.scope_summary || null,
          total_value: p.total_estimate || 0,
          created_by: user.id,
          assigned_user_id: user.id,
        })
        .select("id")
        .single();
      if (error) return fail(action, error.message);

      const pricingItems = p.pricing_items as { name: string; description?: string; quantity: number; unit_price: number }[] || [];
      if (pricingItems.length > 0) {
        await supabase.from("proposal_line_items").insert(
          pricingItems.map((item, i) => ({
            org_id: user.orgId,
            proposal_id: data.id,
            name: item.name,
            description: item.description || "",
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            sort_order: i,
          }))
        );
      }

      return ok(action, data.id);
    }

    case "create_invoice_draft": {
      const items = p.items as { description: string; quantity: number; unit_price: number }[] || [];
      const subtotal = items.reduce((s, i) => s + (i.quantity || 1) * (i.unit_price || 0), 0);

      const { data, error } = await supabase
        .from("invoices")
        .insert({
          org_id: user.orgId,
          contact_id: p.contact_id,
          status: "draft",
          subtotal,
          total: subtotal,
          due_date: p.due_date || null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) return fail(action, error.message);

      if (items.length > 0) {
        await supabase.from("invoice_line_items").insert(
          items.map((item, i) => ({
            org_id: user.orgId,
            invoice_id: data.id,
            description: item.description,
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            total_price: (item.quantity || 1) * (item.unit_price || 0),
            sort_order: i,
          }))
        );
      }

      return ok(action, data.id);
    }

    case "query_analytics": {
      const metric = p.metric as string;
      const dateRange = p.date_range as { from: string; to: string } | undefined;
      const fromDate = dateRange?.from || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const toDate = dateRange?.to || new Date().toISOString().split("T")[0];

      if (metric.includes("pipeline") || metric.includes("opportunity")) {
        const { data } = await supabase
          .from("opportunities")
          .select("status, value_amount")
          .eq("org_id", user.orgId)
          .gte("created_at", fromDate)
          .lte("created_at", toDate);
        const opps = data || [];
        return {
          action_id: action.action_id,
          status: "success",
          resource_id: null,
          error: null,
        };
      } else if (metric.includes("contact")) {
        await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", user.orgId)
          .gte("created_at", fromDate)
          .lte("created_at", toDate);
      } else if (metric.includes("invoice") || metric.includes("payment") || metric.includes("revenue")) {
        await supabase
          .from("invoices")
          .select("status, total")
          .eq("org_id", user.orgId)
          .gte("created_at", fromDate)
          .lte("created_at", toDate);
      }

      return {
        action_id: action.action_id,
        status: "success",
        resource_id: null,
        error: null,
      };
    }

    case "remember": {
      const { error } = await supabase.from("assistant_user_memory").upsert(
        {
          user_id: user.id,
          org_id: user.orgId,
          memory_key: p.key as string,
          memory_value: p.value,
          category: (p.category as string) || "general",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,memory_key" }
      );
      if (error) return fail(action, error.message);
      return ok(action, null);
    }

    default:
      return fail(action, `Unknown action type: ${action.type}`);
  }
}

function ok(action: ITSAction, resourceId: string | null): ITSActionResult {
  return { action_id: action.action_id, status: "success", resource_id: resourceId, error: null };
}

function fail(action: ITSAction, error: string): ITSActionResult {
  return { action_id: action.action_id, status: "failed", resource_id: null, error };
}

function topologicalSort(actions: ITSAction[]): ITSAction[] {
  const map = new Map<string, ITSAction>();
  for (const a of actions) map.set(a.action_id, a);

  const visited = new Set<string>();
  const sorted: ITSAction[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const a = map.get(id);
    if (!a) return;
    if (a.depends_on && map.has(a.depends_on)) {
      visit(a.depends_on);
    }
    sorted.push(a);
  }

  for (const a of actions) visit(a.action_id);
  return sorted;
}

function resolveDependencyIds(action: ITSAction, resourceMap: Map<string, string>): ITSAction {
  if (!action.depends_on) return action;

  const parentResourceId = resourceMap.get(action.depends_on);
  if (!parentResourceId) return action;

  const payload = { ...action.payload };

  for (const field of ["contact_id", "opportunity_id", "project_id"]) {
    if (payload[field] === action.depends_on || payload[field] === `\${${action.depends_on}}`) {
      payload[field] = parentResourceId;
    }
  }

  return { ...action, payload };
}

function describeAction(action: ITSAction): string {
  const p = action.payload;
  switch (action.type) {
    case "create_contact":
      return `Create contact: ${p.first_name} ${p.last_name || ""}`.trim();
    case "update_contact":
      return `Update contact ${p.contact_id}`;
    case "create_opportunity":
      return `Create opportunity worth $${p.value_amount || 0}`;
    case "move_opportunity":
      return `Move opportunity ${p.opportunity_id} to stage ${p.new_stage_id}`;
    case "create_project":
      return `Create project: ${p.name}`;
    case "create_task":
      return `Create task: ${p.title}`;
    case "draft_email":
      return `Draft email to ${Array.isArray(p.to) ? (p.to as string[]).join(", ") : p.to}: "${p.subject}"`;
    case "send_email":
      return `Send email to ${Array.isArray(p.to) ? (p.to as string[]).join(", ") : p.to}: "${p.subject}"`;
    case "send_sms":
      return `Send SMS to contact ${p.contact_id}`;
    case "create_event":
      return `Create event: ${p.title} at ${p.start_time}`;
    case "update_event":
      return `Update event ${p.event_id}`;
    case "cancel_event":
      return `Cancel event ${p.event_id}`;
    case "create_proposal_draft":
      return `Create proposal: ${p.title}`;
    case "create_invoice_draft":
      return `Create invoice for contact ${p.contact_id}`;
    case "query_analytics":
      return `Query: ${p.metric}`;
    case "remember":
      return `Remember: ${p.key} = ${p.value}`;
    default:
      return action.type;
  }
}

function extractDrafts(actions: ITSAction[]): { id: string; type: string; to: string; subject?: string; body: string; confirmation_id: string }[] {
  return actions
    .filter((a) => a.type === "draft_email")
    .map((a) => ({
      id: a.action_id,
      type: "email",
      to: Array.isArray(a.payload.to) ? (a.payload.to as string[]).join(", ") : (a.payload.to as string),
      subject: a.payload.subject as string,
      body: a.payload.body as string,
      confirmation_id: a.action_id,
    }));
}

async function resolveGmailAccessToken(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<string | null> {
  const resolved = await resolveRefreshToken(supabase, userId, orgId);
  if (!resolved) return null;

  const refreshed = await refreshAccessToken(resolved.refreshToken);
  if (!refreshed) return null;

  return refreshed.access_token;
}

async function resolveCalendarAccessToken(
  supabase: SupabaseClient,
  userId: string,
  _orgId: string
): Promise<string | null> {
  const { data: calConn } = await supabase
    .from("google_calendar_connections")
    .select("access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .maybeSingle();

  if (!calConn) return null;

  if (calConn.token_expiry && new Date(calConn.token_expiry) > new Date()) {
    return calConn.access_token;
  }

  if (!calConn.refresh_token) return null;

  const refreshed = await refreshAccessToken(calConn.refresh_token);
  if (!refreshed) return null;

  await supabase
    .from("google_calendar_connections")
    .update({
      access_token: refreshed.access_token,
      token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return refreshed.access_token;
}

function createRawEmail(
  from: string,
  to: string[],
  cc: string[],
  subject: string,
  body: string
): string {
  const lines = [
    `From: ${from}`,
    `To: ${to.join(", ")}`,
  ];
  if (cc.length > 0) lines.push(`Cc: ${cc.join(", ")}`);
  lines.push(
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body
  );

  const msg = lines.join("\r\n");
  return btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function parseITSFromLLM(text: string): unknown | null {
  if (!text) return null;

  let cleaned = text.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return null;

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function resolveLLMConfig(
  supabase: SupabaseClient,
  orgId: string
): Promise<LLMConfig> {
  const { data: providers } = await supabase
    .from("llm_providers")
    .select("*")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .limit(10);

  if (providers && providers.length > 0) {
    for (const p of providers) {
      if (p.provider === "openai" && p.api_key_encrypted) {
        return {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: p.api_key_encrypted,
          baseUrl: p.base_url || undefined,
        };
      }
    }
    for (const p of providers) {
      if (p.provider === "anthropic" && p.api_key_encrypted) {
        return {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          apiKey: p.api_key_encrypted,
          baseUrl: p.base_url || undefined,
        };
      }
    }
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    return { provider: "openai", model: "gpt-4o-mini", apiKey: openaiKey };
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    return { provider: "anthropic", model: "claude-sonnet-4-20250514", apiKey: anthropicKey };
  }

  throw new Error("No LLM provider configured");
}

interface LLMResult {
  text: string;
  error?: string;
}

async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<LLMResult> {
  if (config.provider === "anthropic") {
    return callAnthropic(config, systemPrompt, messages);
  }
  return callOpenAI(config, systemPrompt, messages);
}

async function callAnthropic(
  config: LLMConfig,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<LLMResult> {
  const url = config.baseUrl
    ? `${config.baseUrl}/v1/messages`
    : "https://api.anthropic.com/v1/messages";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { text: "", error: `Anthropic API error ${res.status}: ${errText}` };
  }

  const data = await res.json();
  const textBlocks = (data.content || []).filter(
    (b: { type: string }) => b.type === "text"
  );
  return { text: textBlocks.map((b: { text: string }) => b.text).join("") };
}

async function callOpenAI(
  config: LLMConfig,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<LLMResult> {
  const url = config.baseUrl
    ? `${config.baseUrl}/v1/chat/completions`
    : "https://api.openai.com/v1/chat/completions";

  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: openaiMessages,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { text: "", error: `OpenAI API error ${res.status}: ${errText}` };
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  return { text: msg?.content || "" };
}
