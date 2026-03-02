import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type AIWorkflowActionType =
  | "ai_conversation_reply"
  | "ai_email_draft"
  | "ai_follow_up_message"
  | "ai_lead_qualification"
  | "ai_booking_assist"
  | "ai_decision_step";

type AIOutputMode = "generate_draft" | "auto_send" | "generate_and_branch";

interface AIActionConfig {
  agentId: string;
  useAgentMemory: boolean;
  useGlobalKnowledge: boolean;
  useBrandboard: boolean;
  inputContext: {
    includeLatestMessage: boolean;
    threadWindowSize: number;
    includeContactProfile: boolean;
    includeOpportunityContext: boolean;
    includeAppointmentContext: boolean;
    includeRecentTimeline: boolean;
    includeCustomFields: boolean;
    includePreviousAIOutputs: boolean;
  };
  outputMode: AIOutputMode;
  guardrails: {
    requireApproval: boolean;
    blockSensitiveClaims: boolean;
    profanityFilter: boolean;
    piiRedaction: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    maxMessageLength?: number;
    disallowedDomains?: string[];
  };
  retry: {
    retryCount: number;
    retryDelayMs: number;
    fallbackBehavior: string;
    fallbackTemplateId?: string;
  };
  channel?: string;
  responseStyle?: string;
  confidenceThreshold?: number;
  manualReviewThreshold?: number;
  decisionOptions?: string[];
  lowConfidenceBranch?: string;
  defaultBranch?: string;
  calendarId?: string;
  suggestedSlotCount?: number;
}

interface RequestPayload {
  workflow_id: string;
  enrollment_id: string;
  node_id: string;
  action_type: AIWorkflowActionType;
  action_config: AIActionConfig;
  contact_id: string;
  conversation_id?: string;
  org_id: string;
  context_data?: Record<string, unknown>;
}

interface ExecutionResult {
  success: boolean;
  status: "success" | "failed" | "pending_approval";
  output_raw?: string;
  output_structured?: Record<string, unknown>;
  branch?: string;
  draft_id?: string;
  error?: string;
  tokens_used?: number;
  latency_ms?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: RequestPayload = await req.json();
    const {
      workflow_id,
      enrollment_id,
      node_id,
      action_type,
      action_config,
      contact_id,
      conversation_id,
      org_id,
      context_data,
    } = payload;

    const { data: agent, error: agentError } = await supabase
      .from("ai_agents")
      .select("*")
      .eq("id", action_config.agentId)
      .single();

    if (agentError || !agent) {
      throw new Error(`Agent not found: ${action_config.agentId}`);
    }

    if (!agent.enabled) {
      throw new Error(`Agent is disabled: ${agent.name}`);
    }

    const { data: aiRun, error: runError } = await supabase
      .from("workflow_ai_runs")
      .insert({
        org_id,
        workflow_id,
        enrollment_id,
        node_id,
        agent_id: action_config.agentId,
        contact_id,
        conversation_id,
        ai_action_type: action_type,
        platform_context: { action_config },
        input_context: {},
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) throw runError;

    const context = await assembleContext(
      supabase,
      contact_id,
      conversation_id || null,
      action_config.inputContext,
      context_data
    );

    const prompt = buildPrompt(agent.system_prompt, context, action_type, action_config);

    await supabase
      .from("workflow_ai_runs")
      .update({ prompt_rendered: prompt, input_context: context })
      .eq("id", aiRun.id);

    let aiResponse: string;
    let tokensUsed = 0;

    if (openaiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5.2-chat-latest",
          max_tokens: agent.max_tokens || 1024,
          temperature: agent.temperature || 0.7,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const result = await response.json();
      aiResponse = result.choices?.[0]?.message?.content || "";
      tokensUsed = result.usage?.total_tokens || 0;
    } else {
      aiResponse = generateMockResponse(action_type, context);
      tokensUsed = 100;
    }

    const guardrailResult = applyGuardrails(aiResponse, action_config.guardrails);

    if (guardrailResult.blocked) {
      await supabase
        .from("workflow_ai_runs")
        .update({
          status: "failed",
          output_raw: aiResponse,
          error_message: guardrailResult.blockedReason,
          guardrails_blocked: true,
          guardrails_block_reason: guardrailResult.blockedReason,
          guardrails_applied: guardrailResult.appliedGuardrails,
          tokens_used: tokensUsed,
          latency_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
        })
        .eq("id", aiRun.id);

      return new Response(
        JSON.stringify({
          success: false,
          status: "failed",
          error: guardrailResult.blockedReason,
        } as ExecutionResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalContent = guardrailResult.modifiedContent || aiResponse;
    let structuredOutput: Record<string, unknown> | null = null;
    let branch: string | null = null;

    if (action_type === "ai_lead_qualification" || action_type === "ai_decision_step") {
      structuredOutput = parseStructuredOutput(finalContent, action_type);
      if (structuredOutput) {
        branch = determineBranch(action_type, structuredOutput, action_config);
      }
    }

    let finalStatus: "success" | "pending_approval" = "success";
    let draftId: string | undefined;

    if (action_config.outputMode === "generate_draft" || action_config.guardrails.requireApproval) {
      finalStatus = "pending_approval";

      const { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contact_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const conversationIdForDraft = conversation_id || conversation?.id;

      if (conversationIdForDraft) {
        const { data: draft, error: draftError } = await supabase
          .from("ai_drafts")
          .insert({
            organization_id: org_id,
            conversation_id: conversationIdForDraft,
            contact_id,
            agent_id: action_config.agentId,
            draft_content: finalContent,
            draft_channel: action_config.channel || "sms",
            draft_subject: action_type === "ai_email_draft" ? extractSubject(finalContent) : null,
            trigger_type: "auto",
            status: "pending",
            version: 1,
            workflow_id,
            enrollment_id,
            workflow_ai_run_id: aiRun.id,
            source_type: "workflow",
            action_type,
          })
          .select()
          .single();

        if (!draftError && draft) {
          draftId = draft.id;
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    await supabase
      .from("workflow_ai_runs")
      .update({
        status: finalStatus,
        output_raw: finalContent,
        output_structured: structuredOutput,
        tokens_used: tokensUsed,
        latency_ms: latencyMs,
        model_used: "gpt-5.2-chat-latest",
        temperature_used: agent.temperature || 0.7,
        guardrails_applied: guardrailResult.appliedGuardrails,
        completed_at: new Date().toISOString(),
      })
      .eq("id", aiRun.id);

    const result: ExecutionResult = {
      success: true,
      status: finalStatus,
      output_raw: finalContent,
      output_structured: structuredOutput || undefined,
      branch: branch || undefined,
      draft_id: draftId,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Workflow AI action execution error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        latency_ms: Date.now() - startTime,
      } as ExecutionResult),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function assembleContext(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  conversationId: string | null,
  config: AIActionConfig["inputContext"],
  existingContextData?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {};

  if (config.includeContactProfile) {
    const { data: contact } = await supabase
      .from("contacts")
      .select(`
        id, first_name, last_name, email, phone, company, job_title, source, status,
        lead_score, last_activity_at,
        tags:contact_tags(tag:tags(id, name))
      `)
      .eq("id", contactId)
      .single();

    if (contact) {
      context.contact = {
        id: contact.id,
        name: `${contact.first_name} ${contact.last_name}`.trim(),
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        jobTitle: contact.job_title,
        source: contact.source,
        status: contact.status,
        leadScore: contact.lead_score,
        lastActivityAt: contact.last_activity_at,
        tags: contact.tags?.map((t: { tag: { name: string } }) => t.tag?.name).filter(Boolean) || [],
      };
    }
  }

  if (config.includeLatestMessage && conversationId) {
    const { data: messages } = await supabase
      .from("messages")
      .select("id, content, channel, direction, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(config.threadWindowSize || 10);

    if (messages) {
      context.messageThread = messages.reverse().map((m) => ({
        content: m.content,
        channel: m.channel,
        direction: m.direction,
        timestamp: m.created_at,
      }));
    }
  }

  if (config.includeOpportunityContext) {
    const { data: opportunities } = await supabase
      .from("opportunities")
      .select(`
        id, name, value, expected_close_date, status,
        stage:pipeline_stages(id, name),
        pipeline:pipelines(id, name)
      `)
      .eq("contact_id", contactId)
      .neq("status", "lost")
      .order("created_at", { ascending: false })
      .limit(1);

    if (opportunities?.length) {
      context.opportunity = {
        id: opportunities[0].id,
        name: opportunities[0].name,
        value: opportunities[0].value,
        stage: opportunities[0].stage?.name,
        pipeline: opportunities[0].pipeline?.name,
        expectedCloseDate: opportunities[0].expected_close_date,
      };
    }
  }

  if (config.includeAppointmentContext) {
    const { data: appointments } = await supabase
      .from("appointments")
      .select(`
        id, title, start_time, end_time, status,
        appointment_type:appointment_types(id, name)
      `)
      .eq("contact_id", contactId)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(3);

    if (appointments?.length) {
      context.upcomingAppointments = appointments.map((a) => ({
        id: a.id,
        title: a.title,
        startTime: a.start_time,
        endTime: a.end_time,
        status: a.status,
        type: a.appointment_type?.name,
      }));
    }
  }

  if (config.includePreviousAIOutputs && existingContextData?.ai_outputs) {
    context.previousAIOutputs = existingContextData.ai_outputs;
  }

  return context;
}

function buildPrompt(
  systemPrompt: string,
  context: Record<string, unknown>,
  actionType: AIWorkflowActionType,
  config: AIActionConfig
): string {
  let prompt = systemPrompt + "\n\n";

  if (context.contact) {
    const c = context.contact as Record<string, unknown>;
    prompt += "## Contact Information\n";
    prompt += `Name: ${c.name}\n`;
    if (c.email) prompt += `Email: ${c.email}\n`;
    if (c.phone) prompt += `Phone: ${c.phone}\n`;
    if (c.company) prompt += `Company: ${c.company}\n`;
    if (c.jobTitle) prompt += `Job Title: ${c.jobTitle}\n`;
    if ((c.tags as string[])?.length) prompt += `Tags: ${(c.tags as string[]).join(", ")}\n`;
    prompt += "\n";
  }

  if (context.messageThread) {
    const messages = context.messageThread as Array<{
      content: string;
      direction: string;
      timestamp: string;
    }>;
    prompt += "## Recent Conversation\n";
    for (const msg of messages) {
      const role = msg.direction === "inbound" ? "Contact" : "Agent";
      prompt += `[${msg.timestamp}] ${role}: ${msg.content}\n`;
    }
    prompt += "\n";
  }

  if (context.opportunity) {
    const o = context.opportunity as Record<string, unknown>;
    prompt += "## Active Opportunity\n";
    prompt += `Name: ${o.name}\n`;
    prompt += `Value: $${(o.value as number || 0).toLocaleString()}\n`;
    prompt += `Stage: ${o.stage}\n`;
    prompt += `Pipeline: ${o.pipeline}\n`;
    prompt += "\n";
  }

  if (context.upcomingAppointments) {
    const appointments = context.upcomingAppointments as Array<Record<string, unknown>>;
    prompt += "## Upcoming Appointments\n";
    for (const apt of appointments) {
      prompt += `- ${apt.title} on ${apt.startTime} (${apt.status})\n`;
    }
    prompt += "\n";
  }

  prompt += getActionInstructions(actionType, config);

  return prompt;
}

function getActionInstructions(
  actionType: AIWorkflowActionType,
  config: AIActionConfig
): string {
  switch (actionType) {
    case "ai_conversation_reply":
      return `## Task
Generate a helpful, professional reply to continue this conversation.
Response style: ${config.responseStyle || "normal"}
Keep the message concise and appropriate for ${config.channel || "sms"}.`;

    case "ai_email_draft":
      return `## Task
Draft a professional email based on the context.
Start your response with "Subject: " followed by a clear subject line, then a blank line, then the email body.`;

    case "ai_follow_up_message":
      return `## Task
Generate an appropriate follow-up message based on the interaction history.
Be personable but professional. Reference specific details from previous interactions if available.`;

    case "ai_lead_qualification":
      return `## Task
Analyze the contact and conversation to qualify this lead.
Return ONLY a JSON object with these fields:
{
  "qualification_label": "hot" | "warm" | "cold" | "disqualified",
  "confidence": 0.0 to 1.0,
  "reasons": ["reason1", "reason2"],
  "recommended_next_action": "suggested action",
  "key_details_extracted": {
    "budget": "if mentioned",
    "timeline": "if mentioned",
    "need": "identified need",
    "objections": ["any objections"]
  }
}`;

    case "ai_booking_assist":
      return `## Task
Help the contact book an appointment. Suggest ${config.suggestedSlotCount || 3} available time slots.
Be friendly and make it easy for them to choose a time.`;

    case "ai_decision_step":
      return `## Task
Analyze the context and decide the best routing option.
Available options: ${(config.decisionOptions || []).join(", ")}
Return ONLY a JSON object:
{
  "decision": "chosen_option",
  "confidence": 0.0 to 1.0,
  "explanation": "brief explanation",
  "extracted_data": {}
}`;

    default:
      return "";
  }
}

function applyGuardrails(
  content: string,
  config: AIActionConfig["guardrails"]
): { blocked: boolean; blockedReason?: string; appliedGuardrails: string[]; modifiedContent?: string } {
  const applied: string[] = [];
  let modifiedContent = content;

  if (config.profanityFilter) {
    const profanityPatterns = [/\bf+u+c+k+/gi, /\bs+h+i+t+/gi, /\ba+s+s+h+o+l+e+/gi];
    for (const pattern of profanityPatterns) {
      if (pattern.test(content)) {
        return { blocked: true, blockedReason: "Content contains profanity", appliedGuardrails: applied };
      }
    }
    applied.push("profanity_filter");
  }

  if (config.blockSensitiveClaims) {
    const blockedClaims = ["guaranteed results", "risk-free", "you have won"];
    for (const claim of blockedClaims) {
      if (content.toLowerCase().includes(claim.toLowerCase())) {
        return { blocked: true, blockedReason: `Content contains blocked claim: "${claim}"`, appliedGuardrails: applied };
      }
    }
    applied.push("blocked_claims");
  }

  if (config.disallowedDomains?.length) {
    const urlPattern = /https?:\/\/([^\s/]+)/gi;
    let match;
    while ((match = urlPattern.exec(content)) !== null) {
      const domain = match[1].toLowerCase();
      for (const blocked of config.disallowedDomains) {
        if (domain === blocked.toLowerCase() || domain.endsWith("." + blocked.toLowerCase())) {
          return { blocked: true, blockedReason: `Content contains blocked domain: ${domain}`, appliedGuardrails: applied };
        }
      }
    }
    applied.push("domain_blocklist");
  }

  if (config.maxMessageLength && content.length > config.maxMessageLength) {
    modifiedContent = content.slice(0, config.maxMessageLength - 3) + "...";
    applied.push("max_length");
  }

  return { blocked: false, appliedGuardrails: applied, modifiedContent };
}

function parseStructuredOutput(
  content: string,
  actionType: AIWorkflowActionType
): Record<string, unknown> | null {
  try {
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(jsonStr.trim());
  } catch {
    return null;
  }
}

function determineBranch(
  actionType: AIWorkflowActionType,
  output: Record<string, unknown>,
  config: AIActionConfig
): string | null {
  if (actionType === "ai_lead_qualification") {
    const confidence = output.confidence as number || 0;
    if (confidence < (config.manualReviewThreshold || 0.5)) {
      return "manual_review";
    }
    return output.qualification_label as string || null;
  }

  if (actionType === "ai_decision_step") {
    const confidence = output.confidence as number || 0;
    if (confidence < 0.5 && config.lowConfidenceBranch) {
      return config.lowConfidenceBranch;
    }
    const decision = output.decision as string;
    if (config.decisionOptions?.includes(decision)) {
      return decision;
    }
    return config.defaultBranch || null;
  }

  return null;
}

function extractSubject(content: string): string | null {
  const match = content.match(/^Subject:\s*(.+?)(?:\n|$)/i);
  return match ? match[1].trim() : null;
}

function generateMockResponse(
  actionType: AIWorkflowActionType,
  context: Record<string, unknown>
): string {
  const contactName = (context.contact as Record<string, unknown>)?.name || "there";

  switch (actionType) {
    case "ai_conversation_reply":
      return `Hi ${contactName}! Thanks for reaching out. I'd be happy to help you today. What questions do you have?`;

    case "ai_email_draft":
      return `Subject: Following up on your inquiry

Hi ${contactName},

Thank you for your interest! I wanted to follow up and see if you had any questions.

Please let me know if there's anything I can help with.

Best regards`;

    case "ai_follow_up_message":
      return `Hi ${contactName}, just wanted to check in and see how things are going. Let me know if you need anything!`;

    case "ai_lead_qualification":
      return JSON.stringify({
        qualification_label: "warm",
        confidence: 0.75,
        reasons: ["Engaged in conversation", "Expressed interest"],
        recommended_next_action: "Schedule a discovery call",
        key_details_extracted: {
          need: "Looking for a solution",
        },
      });

    case "ai_booking_assist":
      return `Hi ${contactName}! I'd love to help you book a time to chat. Here are some available slots:\n\n1. Monday at 2:00 PM\n2. Tuesday at 10:00 AM\n3. Wednesday at 3:00 PM\n\nWhich works best for you?`;

    case "ai_decision_step":
      return JSON.stringify({
        decision: "continue",
        confidence: 0.8,
        explanation: "Contact shows positive engagement",
        extracted_data: {},
      });

    default:
      return "Message generated by AI";
  }
}
