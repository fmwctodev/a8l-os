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
  query_data?: unknown;
}

const READ_ACTION_TYPES = new Set([
  "query_schedule",
  "query_contacts",
  "query_opportunities",
  "query_tasks",
  "query_projects",
  "query_proposals",
  "query_analytics",
]);

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

    const queryResults = allResults.filter((r) => r.query_data !== undefined && r.status === "success");
    let finalResponse = itsRequest.response_to_user;

    if (queryResults.length > 0) {
      const summarized = await summarizeQueryResults(
        llmConfig, queryResults, itsRequest, content || "", userData.name || userData.email
      );
      if (summarized) finalResponse = summarized;
    }

    return jsonResponse({
      response: finalResponse,
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
          output: r.query_data ? r.query_data : (r.resource_id ? { id: r.resource_id } : (r.error ? { error: r.error } : {})),
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

  let confirmResponse = "Actions approved and executed.";
  const confirmQueryResults = result.results.filter((r) => r.query_data !== undefined && r.status === "success");
  if (confirmQueryResults.length > 0) {
    try {
      const llmConfig = await resolveLLMConfig(supabase, user.orgId);
      const summarized = await summarizeQueryResults(
        llmConfig, confirmQueryResults, itsRequest, execReq.response_to_user || "", userData.name || userData.email
      );
      if (summarized) confirmResponse = summarized;
    } catch { /* fallback to default message */ }
  }

  return jsonResponse({
    response: confirmResponse,
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

    case "query_schedule": {
      const dateFrom = p.date_from as string;
      const dateTo = p.date_to as string;
      const startUtc = `${dateFrom}T00:00:00Z`;
      const endUtc = `${dateTo}T23:59:59Z`;

      const [crmEvents, tasks, appointments, googleEvents] = await Promise.all([
        supabase
          .from("calendar_events")
          .select("id, title, description, location, start_at_utc, end_at_utc, all_day, status")
          .eq("org_id", user.orgId)
          .gte("start_at_utc", startUtc)
          .lte("start_at_utc", endUtc)
          .neq("status", "cancelled")
          .order("start_at_utc", { ascending: true })
          .limit(50),
        supabase
          .from("calendar_tasks")
          .select("id, title, description, due_at_utc, priority, status")
          .eq("org_id", user.orgId)
          .eq("user_id", user.id)
          .gte("due_at_utc", startUtc)
          .lte("due_at_utc", endUtc)
          .order("due_at_utc", { ascending: true })
          .limit(50),
        supabase
          .from("appointments")
          .select("id, status, start_at_utc, end_at_utc, notes, location, google_meet_link")
          .eq("org_id", user.orgId)
          .eq("assigned_user_id", user.id)
          .gte("start_at_utc", startUtc)
          .lte("start_at_utc", endUtc)
          .neq("status", "cancelled")
          .order("start_at_utc", { ascending: true })
          .limit(50),
        supabase
          .from("google_calendar_events")
          .select("id, summary, description, location, start_time, end_time, all_day, status, attendees, hangout_link")
          .eq("user_id", user.id)
          .gte("start_time", startUtc)
          .lte("start_time", endUtc)
          .neq("status", "cancelled")
          .order("start_time", { ascending: true })
          .limit(50),
      ]);

      return {
        action_id: action.action_id,
        status: "success",
        resource_id: null,
        error: null,
        query_data: {
          date_from: dateFrom,
          date_to: dateTo,
          calendar_events: crmEvents.data || [],
          tasks: tasks.data || [],
          appointments: appointments.data || [],
          google_calendar_events: googleEvents.data || [],
        },
      };
    }

    case "query_contacts": {
      const search = (p.search as string).trim();
      const limit = (p.limit as number) || 10;

      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, company, status, owner_id, created_at")
        .eq("organization_id", user.orgId)
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) return fail(action, error.message);
      return {
        action_id: action.action_id,
        status: "success",
        resource_id: null,
        error: null,
        query_data: { contacts: data || [], search, total: (data || []).length },
      };
    }

    case "query_opportunities": {
      const status = (p.status as string) || "open";
      const limit = (p.limit as number) || 20;

      let query = supabase
        .from("opportunities")
        .select("id, contact_id, pipeline_id, stage_id, value_amount, close_date, status, source, created_at, stage_changed_at")
        .eq("org_id", user.orgId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status !== "all") query = query.eq("status", status);
      if (p.pipeline_id) query = query.eq("pipeline_id", p.pipeline_id as string);
      if (p.date_from) query = query.gte("created_at", `${p.date_from}T00:00:00Z`);
      if (p.date_to) query = query.lte("created_at", `${p.date_to}T23:59:59Z`);

      const { data, error } = await query;
      if (error) return fail(action, error.message);

      const totalValue = (data || []).reduce((s, o) => s + (o.value_amount || 0), 0);
      return {
        action_id: action.action_id,
        status: "success",
        resource_id: null,
        error: null,
        query_data: { opportunities: data || [], total: (data || []).length, total_value: totalValue },
      };
    }

    case "query_tasks": {
      const status = (p.status as string) || "pending";
      const limit = (p.limit as number) || 20;

      let query = supabase
        .from("calendar_tasks")
        .select("id, title, description, due_at_utc, priority, status, completed, completed_at")
        .eq("org_id", user.orgId)
        .eq("user_id", user.id)
        .order("due_at_utc", { ascending: true })
        .limit(limit);

      if (status !== "all") query = query.eq("status", status);
      if (p.priority) query = query.eq("priority", p.priority as string);
      if (p.date_from) query = query.gte("due_at_utc", `${p.date_from}T00:00:00Z`);
      if (p.date_to) query = query.lte("due_at_utc", `${p.date_to}T23:59:59Z`);

      const { data, error } = await query;
      if (error) return fail(action, error.message);
      return {
        action_id: action.action_id,
        status: "success",
        resource_id: null,
        error: null,
        query_data: { tasks: data || [], total: (data || []).length },
      };
    }

    case "query_projects": {
      const status = (p.status as string) || "active";
      const limit = (p.limit as number) || 20;

      let query = supabase
        .from("projects")
        .select("id, name, description, status, budget_amount, start_date, target_end_date, actual_end_date, created_at")
        .eq("org_id", user.orgId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status !== "all") query = query.eq("status", status);
      if (p.search) {
        query = query.ilike("name", `%${p.search}%`);
      }

      const { data, error } = await query;
      if (error) return fail(action, error.message);
      return {
        action_id: action.action_id,
        status: "success",
        resource_id: null,
        error: null,
        query_data: { projects: data || [], total: (data || []).length },
      };
    }

    case "query_proposals": {
      const status = (p.status as string) || "all";
      const limit = (p.limit as number) || 20;

      let query = supabase
        .from("proposals")
        .select("id, title, status, total_value, contact_id, opportunity_id, created_at, sent_at, viewed_at, accepted_at")
        .eq("org_id", user.orgId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status !== "all") query = query.eq("status", status);
      if (p.search) {
        query = query.ilike("title", `%${p.search}%`);
      }

      const { data, error } = await query;
      if (error) return fail(action, error.message);
      return {
        action_id: action.action_id,
        status: "success",
        resource_id: null,
        error: null,
        query_data: { proposals: data || [], total: (data || []).length },
      };
    }

    case "query_analytics": {
      const metric = p.metric as string;
      const dateRange = p.date_range as { from: string; to: string } | undefined;
      const fromDate = dateRange?.from || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const toDate = dateRange?.to || new Date().toISOString().split("T")[0];

      let analyticsData: unknown = {};

      if (metric.includes("pipeline") || metric.includes("opportunity") || metric.includes("deal")) {
        const { data } = await supabase
          .from("opportunities")
          .select("status, value_amount")
          .eq("org_id", user.orgId)
          .gte("created_at", `${fromDate}T00:00:00Z`)
          .lte("created_at", `${toDate}T23:59:59Z`);
        const opps = data || [];
        const byStatus: Record<string, { count: number; value: number }> = {};
        for (const o of opps) {
          const s = o.status || "unknown";
          if (!byStatus[s]) byStatus[s] = { count: 0, value: 0 };
          byStatus[s].count++;
          byStatus[s].value += o.value_amount || 0;
        }
        analyticsData = { metric, date_range: { from: fromDate, to: toDate }, total_count: opps.length, by_status: byStatus };
      } else if (metric.includes("contact")) {
        const { count } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", user.orgId)
          .gte("created_at", `${fromDate}T00:00:00Z`)
          .lte("created_at", `${toDate}T23:59:59Z`);
        analyticsData = { metric, date_range: { from: fromDate, to: toDate }, total_count: count || 0 };
      } else {
        analyticsData = { metric, date_range: { from: fromDate, to: toDate }, message: "Metric type not recognized. Available: pipeline, opportunity, deal, contact." };
      }

      return {
        action_id: action.action_id,
        status: "success",
        resource_id: null,
        error: null,
        query_data: analyticsData,
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
    case "query_schedule":
      return `Query schedule: ${p.date_from} to ${p.date_to}`;
    case "query_contacts":
      return `Search contacts: "${p.search}"`;
    case "query_opportunities":
      return `Query opportunities (${p.status || "open"})`;
    case "query_tasks":
      return `Query tasks (${p.status || "pending"})`;
    case "query_projects":
      return `Query projects (${p.status || "active"})`;
    case "query_proposals":
      return `Query proposals (${p.status || "all"})`;
    case "query_analytics":
      return `Query analytics: ${p.metric}`;
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

async function summarizeQueryResults(
  config: LLMConfig,
  queryResults: ITSActionResult[],
  itsRequest: ITSRequest,
  userMessage: string,
  userName: string
): Promise<string | null> {
  const dataBlocks = queryResults.map((r) => {
    const action = itsRequest.actions.find((a) => a.action_id === r.action_id);
    return `[${action?.type || "query"}] ${JSON.stringify(r.query_data)}`;
  });

  const summaryPrompt = `You are Clara, a personal AI assistant for ${userName}. The user asked: "${userMessage}"

You executed query actions and received the following data:

${dataBlocks.join("\n\n")}

Summarize this data in a natural, conversational response. Be concise and helpful. Format times in a readable way (e.g., "2:00 PM" not ISO timestamps). If there are no results, say so clearly. Group related items logically. Use markdown bullet points or numbered lists for multiple items. Include details like attendees, locations, and meeting links when available. Do NOT output JSON. Do NOT wrap your response in code fences. Just respond naturally as Clara using markdown formatting.`;

  const result = await callLLM(config, summaryPrompt, [
    { role: "user", content: "Please summarize the query results." },
  ], false);

  if (result.error || !result.text) {
    return buildTemplateFallback(queryResults, itsRequest);
  }

  let text = result.text.trim();

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      const keys = ["response_to_user", "response", "summary", "message", "text", "answer"];
      for (const k of keys) {
        if (typeof parsed[k] === "string" && parsed[k].length > 0) return parsed[k];
      }
    } catch { /* not valid JSON */ }
    return buildTemplateFallback(queryResults, itsRequest);
  }

  return text;
}

function formatUtcTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
  } catch {
    return iso;
  }
}

function formatUtcDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  } catch {
    return iso;
  }
}

function buildTemplateFallback(
  queryResults: ITSActionResult[],
  itsRequest: ITSRequest
): string {
  const lines: string[] = [];

  for (const r of queryResults) {
    const action = itsRequest.actions.find((a) => a.action_id === r.action_id);
    const qd = r.query_data as Record<string, unknown> | undefined;
    if (!qd) continue;

    const actionType = action?.type || "query";

    if (actionType === "query_schedule") {
      const events = (qd.calendar_events as unknown[]) || [];
      const appointments = (qd.appointments as unknown[]) || [];
      const googleEvents = (qd.google_calendar_events as unknown[]) || [];
      const tasks = (qd.tasks as unknown[]) || [];
      const total = events.length + appointments.length + googleEvents.length + tasks.length;

      if (total === 0) {
        lines.push("You have no events or tasks scheduled for that time period.");
        continue;
      }

      lines.push(`Here's what's on your schedule:\n`);

      for (const e of googleEvents as Record<string, unknown>[]) {
        const time = e.start_time ? formatUtcTime(e.start_time as string) : "";
        const endTime = e.end_time ? ` - ${formatUtcTime(e.end_time as string)}` : "";
        const title = (e.summary as string) || "Untitled";
        let detail = `- **${time}${endTime}** ${title}`;
        if (e.location) detail += `\n  - Location: ${e.location}`;
        if (e.attendees && Array.isArray(e.attendees)) {
          const names = (e.attendees as Record<string, unknown>[])
            .map((a) => a.email || a.displayName || "")
            .filter(Boolean)
            .join(", ");
          if (names) detail += `\n  - Attendees: ${names}`;
        }
        if (e.hangout_link) detail += `\n  - Meet: ${e.hangout_link}`;
        lines.push(detail);
      }

      for (const e of events as Record<string, unknown>[]) {
        const time = e.start_at_utc ? formatUtcTime(e.start_at_utc as string) : "";
        const endTime = e.end_at_utc ? ` - ${formatUtcTime(e.end_at_utc as string)}` : "";
        const title = (e.title as string) || "Untitled";
        let detail = `- **${time}${endTime}** ${title}`;
        if (e.location) detail += `\n  - Location: ${e.location}`;
        lines.push(detail);
      }

      for (const e of appointments as Record<string, unknown>[]) {
        const time = e.start_at_utc ? formatUtcTime(e.start_at_utc as string) : "";
        const endTime = e.end_at_utc ? ` - ${formatUtcTime(e.end_at_utc as string)}` : "";
        const title = (e.notes as string) || "Appointment";
        let detail = `- **${time}${endTime}** ${title}`;
        if (e.location) detail += `\n  - Location: ${e.location}`;
        if (e.google_meet_link) detail += `\n  - Meet: ${e.google_meet_link}`;
        lines.push(detail);
      }

      if (tasks.length > 0) {
        lines.push(`\n**Tasks due:**`);
        for (const t of tasks as Record<string, unknown>[]) {
          const title = (t.title as string) || "Untitled task";
          const priority = t.priority ? ` (${t.priority} priority)` : "";
          lines.push(`- ${title}${priority}`);
        }
      }
    } else if (actionType === "query_contacts") {
      const contacts = (qd.contacts as Record<string, unknown>[]) || [];
      if (contacts.length === 0) {
        lines.push("No contacts found matching your search.");
        continue;
      }
      lines.push(`Found **${contacts.length}** contact${contacts.length === 1 ? "" : "s"}:\n`);
      for (const c of contacts) {
        const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown";
        let detail = `- **${name}**`;
        if (c.email) detail += ` - ${c.email}`;
        if (c.phone) detail += ` - ${c.phone}`;
        if (c.company) detail += ` (${c.company})`;
        lines.push(detail);
      }
    } else if (actionType === "query_opportunities") {
      const opps = (qd.opportunities as Record<string, unknown>[]) || [];
      if (opps.length === 0) {
        lines.push("No opportunities found matching your criteria.");
        continue;
      }
      const totalValue = qd.total_value as number || 0;
      lines.push(`Found **${opps.length}** opportunit${opps.length === 1 ? "y" : "ies"}` +
        (totalValue > 0 ? ` with total value of **$${totalValue.toLocaleString()}**` : "") + `:\n`);
      for (const o of opps) {
        const val = o.value_amount ? `$${(o.value_amount as number).toLocaleString()}` : "No value";
        const status = (o.status as string) || "unknown";
        const closeDate = o.close_date ? ` - Close: ${formatUtcDate(o.close_date as string)}` : "";
        lines.push(`- ${val} (${status})${closeDate}`);
      }
    } else if (actionType === "query_tasks") {
      const tasks = (qd.tasks as Record<string, unknown>[]) || [];
      if (tasks.length === 0) {
        lines.push("No tasks found matching your criteria.");
        continue;
      }
      lines.push(`Found **${tasks.length}** task${tasks.length === 1 ? "" : "s"}:\n`);
      for (const t of tasks) {
        const title = (t.title as string) || "Untitled";
        const priority = t.priority ? ` [${t.priority}]` : "";
        const due = t.due_at_utc ? ` - Due: ${formatUtcDate(t.due_at_utc as string)} ${formatUtcTime(t.due_at_utc as string)}` : "";
        const status = t.status ? ` (${t.status})` : "";
        lines.push(`- **${title}**${priority}${due}${status}`);
      }
    } else if (actionType === "query_projects") {
      const projects = (qd.projects as Record<string, unknown>[]) || [];
      if (projects.length === 0) {
        lines.push("No projects found matching your criteria.");
        continue;
      }
      lines.push(`Found **${projects.length}** project${projects.length === 1 ? "" : "s"}:\n`);
      for (const p of projects) {
        const name = (p.name as string) || "Untitled";
        const status = (p.status as string) || "";
        lines.push(`- **${name}**${status ? ` (${status})` : ""}`);
      }
    } else {
      lines.push(`Query returned ${JSON.stringify(qd).length > 200 ? "results" : JSON.stringify(qd)}.`);
    }
  }

  return lines.join("\n") || "Query completed but returned no displayable results.";
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
  messages: { role: string; content: string }[],
  jsonMode = true
): Promise<LLMResult> {
  if (config.provider === "anthropic") {
    return callAnthropic(config, systemPrompt, messages);
  }
  return callOpenAI(config, systemPrompt, messages, jsonMode);
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
  messages: { role: string; content: string }[],
  jsonMode = true
): Promise<LLMResult> {
  const url = config.baseUrl
    ? `${config.baseUrl}/v1/chat/completions`
    : "https://api.openai.com/v1/chat/completions";

  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const body: Record<string, unknown> = {
    model: config.model,
    messages: openaiMessages,
    max_tokens: 4096,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { text: "", error: `OpenAI API error ${res.status}: ${errText}` };
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  return { text: msg?.content || "" };
}
