import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * workflow-ai-generator
 *
 * Given a natural-language description of a workflow, asks Anthropic to
 * generate a valid WorkflowDefinition (nodes + edges + viewport + settings)
 * that the builder can drop straight onto the canvas.
 *
 * Request body:
 *   {
 *     prompt: string,            // user's plain-English description
 *     orgId: string,             // for tenant scoping (audit + future tool calls)
 *     name?: string,             // workflow name to seed
 *     existingDefinition?: any,  // optional — if generating a delta on top of an existing draft
 *   }
 *
 * Response:
 *   { definition: WorkflowDefinition, suggested_name?: string, model: string }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-5-sonnet-20241022";

const SYSTEM_PROMPT = `You are an expert workflow architect for the Autom8ion Lab CRM.
You convert plain-English descriptions of marketing/sales/ops automations into a strict JSON workflow definition that the Autom8ion canvas can render.

OUTPUT CONTRACT — return ONLY a JSON object, no commentary, with this shape:
{
  "definition": {
    "nodes": [
      { "id": string, "type": "trigger" | "action" | "condition" | "delay" | "goal" | "end",
        "position": { "x": number, "y": number },
        "data": { "label": string, "nodeType": "trigger"|"action"|"condition"|"delay"|"goal"|"end", "nodeData": object } }
    ],
    "edges": [
      { "id": string, "source": string, "target": string, "sourceHandle"?: string, "type"?: "default" }
    ],
    "viewport": { "x": 0, "y": 0, "zoom": 1 },
    "settings": { "enrollmentRules": { "allow_re_enrollment": "after_completion", "stop_existing_on_re_entry": false, "max_concurrent_enrollments": 1 }, "waitTimeoutDays": 30, "loggingVerbosity": "standard", "failureNotificationUserIds": [] }
  },
  "suggested_name": string
}

REQUIREMENTS:
- Every workflow MUST start with exactly one trigger node and end with at least one end node.
- Every non-trigger node MUST have an incoming edge; every non-end node MUST have an outgoing edge.
- Condition nodes use sourceHandle: "true" and "false" on outgoing edges.
- Use existing trigger types: contact_created, contact_tag_changed, form_submitted, survey_submitted, appointment_booked, opportunity_status_changed, opportunity_stage_changed, missed_call, inbound_call, call_completed, birthday_reminder, custom_date_reminder, trigger_link_clicked, messaging_error, social_inbox_message, invoice_paid, invoice_voided, contract_signed, scheduled, webhook_received.
- Use existing action types: send_email (needs subject + body), send_sms (needs body), add_tag, remove_tag, update_contact_field, assign_contact_owner, create_task, create_opportunity, send_review_request, ai_prompt, send_proposal, notify_user, webhook, delay, if_else, go_to, split_test.
- For each action, populate node.data.nodeData.config with sensible defaults for the required fields.
- Lay out nodes vertically: x=400, y=80*nodeIndex+100. Increment x by 250 for branches.
- Use uuid-style ids: "trigger-1", "action-1", "delay-1", "condition-1", "end-1" etc.
- If the user's description is ambiguous, make reasonable defaults; do NOT ask for clarification.
- Keep workflows concise — prefer 4-10 nodes, only go larger when the request explicitly demands it.

You MUST emit valid JSON. No markdown fences. No prose before or after.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "Server is not configured for AI workflow generation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const prompt = (body.prompt || "").toString().trim();
    const orgId = (body.orgId || "").toString().trim();
    const seedName = (body.name || "").toString().trim();
    const existingDefinition = body.existingDefinition || null;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "orgId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userMessage = existingDefinition
      ? `Existing workflow definition:\n${JSON.stringify(existingDefinition).slice(0, 4000)}\n\nModify this workflow to satisfy:\n${prompt}\n\nReturn the COMPLETE new definition, not a delta.${seedName ? `\n\nWorkflow name to use: ${seedName}` : ""}`
      : `Build a workflow that does this:\n${prompt}${seedName ? `\n\nWorkflow name to use: ${seedName}` : ""}`;

    const aiResp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!aiResp.ok) {
      const errBody = await aiResp.text();
      console.error("Anthropic error:", aiResp.status, errBody);
      return new Response(
        JSON.stringify({ error: `AI service error: ${aiResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResp.json();
    const text = (aiData.content?.[0]?.text || "").trim();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "AI returned an empty response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strip any markdown fences just in case
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let parsed: { definition?: unknown; suggested_name?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("JSON parse failed; raw text:", cleaned.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI returned invalid JSON", raw: cleaned.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!parsed.definition) {
      return new Response(
        JSON.stringify({ error: "AI response missing 'definition' field" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Audit log: record that an AI generation happened (best-effort, non-blocking)
    try {
      await supabase.from("workflow_execution_logs").insert({
        org_id: orgId,
        enrollment_id: null,
        node_id: "ai_generator",
        event_type: "ai_workflow_generated",
        payload: {
          prompt: prompt.slice(0, 1000),
          model: MODEL,
          suggested_name: parsed.suggested_name || null,
          existing_definition_provided: !!existingDefinition,
          tokens_in: aiData.usage?.input_tokens || null,
          tokens_out: aiData.usage?.output_tokens || null,
        },
      });
    } catch {
      // table requires enrollment_id NOT NULL on some schemas — silently skip
    }

    return new Response(
      JSON.stringify({
        definition: parsed.definition,
        suggested_name: parsed.suggested_name || seedName || null,
        model: MODEL,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("workflow-ai-generator error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
