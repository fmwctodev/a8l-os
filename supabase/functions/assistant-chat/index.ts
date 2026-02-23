import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_TOOL_CALLS = 15;
const EXECUTION_TIMEOUT_MS = 45_000;

interface PageContext {
  current_path: string;
  current_module: string | null;
  current_record_id: string | null;
}

interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const {
      data: { user },
      error: authErr,
    } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: userData } = await supabase
      .from("users")
      .select("id, email, organization_id, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (!userData) return json({ error: "User not found" }, 404);

    const body = await req.json();
    const { thread_id, content, context, action, confirmation_id, approved } =
      body as {
        thread_id: string;
        content?: string;
        context?: PageContext;
        action?: string;
        confirmation_id?: string;
        approved?: boolean;
      };

    if (action === "confirm") {
      return handleConfirmation(
        supabase,
        userData,
        thread_id,
        confirmation_id!,
        approved!
      );
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

    const systemPrompt = buildSystemPrompt(
      userData,
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

    const tools = buildToolDefinitions();

    const startTime = Date.now();
    let toolCallCount = 0;
    const allToolCalls: unknown[] = [];
    const confirmationsPending: unknown[] = [];
    const drafts: unknown[] = [];

    let messages = [...conversationHistory];
    let finalResponse = "";

    while (toolCallCount < MAX_TOOL_CALLS) {
      if (Date.now() - startTime > EXECUTION_TIMEOUT_MS) {
        finalResponse =
          "I ran out of time processing your request. Could you try a simpler question?";
        break;
      }

      const llmResult = await callLLM(
        llmConfig,
        systemPrompt,
        messages,
        tools
      );

      if (llmResult.error) {
        finalResponse = `I encountered an issue: ${llmResult.error}`;
        break;
      }

      if (!llmResult.tool_calls || llmResult.tool_calls.length === 0) {
        finalResponse = llmResult.text || "I'm not sure how to help with that.";
        break;
      }

      const toolResults = [];
      for (const tc of llmResult.tool_calls) {
        toolCallCount++;
        const toolStart = Date.now();

        const needsConfirmation = isDestructiveAction(tc.name);
        if (needsConfirmation && profile?.confirm_all_writes) {
          const confirmId = crypto.randomUUID();
          confirmationsPending.push({
            id: confirmId,
            action_type: tc.name,
            description: describeAction(tc.name, tc.input),
            details: tc.input,
            status: "pending",
          });

          await supabase.from("assistant_action_logs").insert({
            user_id: user.id,
            org_id: userData.organization_id,
            thread_id,
            action_type: tc.name,
            target_module: getModuleFromTool(tc.name),
            input_summary: describeAction(tc.name, tc.input),
            execution_status: "queued",
            tool_calls: [tc],
            confirmed_by_user: null,
          });

          toolResults.push({
            tool_use_id: tc.id,
            content: `Action requires user confirmation (id: ${confirmId}). Waiting for approval.`,
          });
          continue;
        }

        let result: { output: unknown; status: string };
        try {
          result = await executeTool(
            supabase,
            userData,
            tc.name,
            tc.input
          );
        } catch (e) {
          result = {
            output: { error: e instanceof Error ? e.message : "Tool failed" },
            status: "error",
          };
        }

        const duration = Date.now() - toolStart;
        allToolCalls.push({
          id: tc.id,
          tool_name: tc.name,
          input: tc.input,
          output: result.output,
          status: result.status,
          duration_ms: duration,
        });

        await supabase.from("assistant_action_logs").insert({
          user_id: user.id,
          org_id: userData.organization_id,
          thread_id,
          action_type: tc.name,
          target_module: getModuleFromTool(tc.name),
          input_summary: describeAction(tc.name, tc.input),
          output_summary:
            typeof result.output === "string"
              ? result.output
              : JSON.stringify(result.output).slice(0, 500),
          execution_status: result.status === "error" ? "failed" : "success",
          execution_time_ms: duration,
          error_message:
            result.status === "error"
              ? JSON.stringify(result.output)
              : null,
          tool_calls: [{ ...tc, output: result.output }],
          confirmed_by_user: !isDestructiveAction(tc.name) ? null : true,
        });

        toolResults.push({
          tool_use_id: tc.id,
          content: JSON.stringify(result.output),
        });
      }

      if (llmConfig.provider === "anthropic") {
        messages.push({
          role: "assistant",
          content: llmResult.raw_content,
        });
        messages.push({
          role: "user",
          content: toolResults.map((r: { tool_use_id: string; content: string }) => ({
            type: "tool_result",
            tool_use_id: r.tool_use_id,
            content: r.content,
          })),
        });
      } else {
        messages.push(llmResult.raw_message);
        for (const r of toolResults) {
          messages.push({
            role: "tool",
            tool_call_id: r.tool_use_id,
            content: r.content,
          });
        }
      }

      if (confirmationsPending.length > 0) {
        const confirmResult = await callLLM(
          llmConfig,
          systemPrompt,
          messages,
          []
        );
        finalResponse =
          confirmResult.text ||
          "I need your approval before proceeding. Please review the actions above.";
        break;
      }
    }

    if (!finalResponse && toolCallCount >= MAX_TOOL_CALLS) {
      finalResponse =
        "I reached the maximum number of steps. Here is what I found so far based on the actions taken.";
    }

    if (profile?.system_prompt_override) {
      await learnFromInteraction(
        supabase,
        user.id,
        userData.organization_id,
        content || "",
        finalResponse
      );
    }

    return json({
      response: finalResponse,
      tool_calls: allToolCalls,
      confirmations_pending: confirmationsPending,
      drafts,
      model_used: llmConfig.model,
    });
  } catch (err) {
    console.error("[assistant-chat] Error:", err);
    return json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500
    );
  }
});

async function handleConfirmation(
  supabase: ReturnType<typeof createClient>,
  userData: { id: string; organization_id: string; email: string; full_name: string },
  threadId: string,
  confirmationId: string,
  approved: boolean
) {
  await supabase
    .from("assistant_action_logs")
    .update({
      confirmed_by_user: approved,
      execution_status: approved ? "running" : "canceled",
    })
    .eq("thread_id", threadId)
    .eq("execution_status", "queued");

  const responseText = approved
    ? "Action approved. Executing now..."
    : "Action canceled.";

  return json({
    response: responseText,
    tool_calls: [],
    confirmations_pending: [],
    drafts: [],
    model_used: "system",
  });
}

interface LLMConfig {
  provider: "anthropic" | "openai";
  model: string;
  apiKey: string;
  baseUrl?: string;
}

async function resolveLLMConfig(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<LLMConfig> {
  const { data: providers } = await supabase
    .from("llm_providers")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(5);

  if (providers && providers.length > 0) {
    for (const p of providers) {
      if (p.provider_type === "anthropic" && p.api_key) {
        return {
          provider: "anthropic",
          model: p.default_model || "claude-sonnet-4-20250514",
          apiKey: p.api_key,
          baseUrl: p.base_url || undefined,
        };
      }
      if (p.provider_type === "openai" && p.api_key) {
        return {
          provider: "openai",
          model: p.default_model || "gpt-4o-mini",
          apiKey: p.api_key,
          baseUrl: p.base_url || undefined,
        };
      }
    }
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    return {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: anthropicKey,
    };
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    return { provider: "openai", model: "gpt-4o-mini", apiKey: openaiKey };
  }

  throw new Error("No LLM provider configured");
}

interface LLMResult {
  text: string;
  tool_calls: { id: string; name: string; input: Record<string, unknown> }[];
  raw_content: unknown;
  raw_message: unknown;
  error?: string;
}

async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  messages: unknown[],
  tools: ToolDef[]
): Promise<LLMResult> {
  if (config.provider === "anthropic") {
    return callAnthropic(config, systemPrompt, messages, tools);
  }
  return callOpenAI(config, systemPrompt, messages, tools);
}

async function callAnthropic(
  config: LLMConfig,
  systemPrompt: string,
  messages: unknown[],
  tools: ToolDef[]
): Promise<LLMResult> {
  const url = config.baseUrl
    ? `${config.baseUrl}/v1/messages`
    : "https://api.anthropic.com/v1/messages";

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  };

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    return {
      text: "",
      tool_calls: [],
      raw_content: null,
      raw_message: null,
      error: `Anthropic API error ${res.status}: ${errText}`,
    };
  }

  const data = await res.json();
  const textBlocks = (data.content || []).filter(
    (b: { type: string }) => b.type === "text"
  );
  const toolBlocks = (data.content || []).filter(
    (b: { type: string }) => b.type === "tool_use"
  );

  return {
    text: textBlocks.map((b: { text: string }) => b.text).join(""),
    tool_calls: toolBlocks.map(
      (b: { id: string; name: string; input: Record<string, unknown> }) => ({
        id: b.id,
        name: b.name,
        input: b.input,
      })
    ),
    raw_content: data.content,
    raw_message: data,
  };
}

async function callOpenAI(
  config: LLMConfig,
  systemPrompt: string,
  messages: unknown[],
  tools: ToolDef[]
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

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
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
    return {
      text: "",
      tool_calls: [],
      raw_content: null,
      raw_message: null,
      error: `OpenAI API error ${res.status}: ${errText}`,
    };
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const msg = choice?.message;

  return {
    text: msg?.content || "",
    tool_calls: (msg?.tool_calls || []).map(
      (tc: {
        id: string;
        function: { name: string; arguments: string };
      }) => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments || "{}"),
      })
    ),
    raw_content: msg?.content,
    raw_message: msg,
  };
}

function buildSystemPrompt(
  user: { full_name: string; email: string },
  profile: Record<string, unknown> | null,
  memories: { memory_key: string; memory_value: unknown; category: string }[],
  context: PageContext | null
): string {
  const memSection =
    memories.length > 0
      ? `\n\nUser memories:\n${memories
          .map((m) => `- [${m.category}] ${m.memory_key}: ${JSON.stringify(m.memory_value)}`)
          .join("\n")}`
      : "";

  const ctxSection = context
    ? `\n\nCurrent page context: module=${context.current_module || "dashboard"}, record_id=${context.current_record_id || "none"}, path=${context.current_path}`
    : "";

  const customPrompt = profile?.system_prompt_override
    ? `\n\nAdditional user instructions:\n${profile.system_prompt_override}`
    : "";

  return `You are Clara, a personal AI executive assistant for ${user.full_name} (${user.email}) in the Autom8ion CRM platform.

Your role:
- Help manage emails, calendar, contacts, opportunities, and daily tasks
- Draft and send emails via Gmail
- Schedule and manage appointments
- Look up and update contact records
- Provide pipeline and opportunity summaries
- Be proactive, concise, and professional

Guidelines:
- Always confirm before sending emails, creating records, or canceling appointments
- Use the user's timezone and preferences from memory
- Reference contact names naturally
- Keep responses concise but thorough
- When tools return data, summarize it naturally for the user${memSection}${ctxSection}${customPrompt}`;
}

function buildToolDefinitions(): ToolDef[] {
  return [
    {
      name: "search_contacts",
      description: "Search contacts by name, email, phone, company, or tag",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_contact",
      description: "Get full details for a specific contact by ID",
      input_schema: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "Contact UUID" },
        },
        required: ["contact_id"],
      },
    },
    {
      name: "update_contact",
      description: "Update a contact record",
      input_schema: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "Contact UUID" },
          updates: {
            type: "object",
            description: "Fields to update (first_name, last_name, email, phone, company, etc.)",
          },
        },
        required: ["contact_id", "updates"],
      },
    },
    {
      name: "list_appointments_today",
      description: "List today's appointments for the user",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "list_appointments_range",
      description: "List appointments within a date range",
      input_schema: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "ISO date string" },
          end_date: { type: "string", description: "ISO date string" },
        },
        required: ["start_date", "end_date"],
      },
    },
    {
      name: "create_appointment",
      description: "Create a new appointment",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          start_time: { type: "string", description: "ISO datetime" },
          end_time: { type: "string", description: "ISO datetime" },
          contact_id: { type: "string" },
          calendar_id: { type: "string" },
          notes: { type: "string" },
        },
        required: ["title", "start_time", "end_time"],
      },
    },
    {
      name: "cancel_appointment",
      description: "Cancel an appointment",
      input_schema: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["appointment_id"],
      },
    },
    {
      name: "draft_email",
      description: "Draft an email for user review before sending",
      input_schema: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email" },
          subject: { type: "string" },
          body: { type: "string", description: "Email body (plain text)" },
        },
        required: ["to", "subject", "body"],
      },
    },
    {
      name: "send_email",
      description: "Send an email via Gmail",
      input_schema: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
          reply_to_message_id: { type: "string" },
        },
        required: ["to", "subject", "body"],
      },
    },
    {
      name: "list_recent_emails",
      description: "List recent emails from the user's Gmail inbox",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Gmail search query" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: [],
      },
    },
    {
      name: "get_email",
      description: "Get full email details by message ID",
      input_schema: {
        type: "object",
        properties: {
          message_id: { type: "string", description: "Gmail message ID" },
        },
        required: ["message_id"],
      },
    },
    {
      name: "list_opportunities",
      description: "List opportunities with optional filters",
      input_schema: {
        type: "object",
        properties: {
          pipeline_id: { type: "string" },
          stage_id: { type: "string" },
          status: { type: "string", description: "open, won, lost" },
          limit: { type: "number" },
        },
        required: [],
      },
    },
    {
      name: "get_opportunity",
      description: "Get full details for a specific opportunity",
      input_schema: {
        type: "object",
        properties: {
          opportunity_id: { type: "string" },
        },
        required: ["opportunity_id"],
      },
    },
    {
      name: "update_opportunity",
      description: "Update an opportunity (value, stage, status, notes, etc.)",
      input_schema: {
        type: "object",
        properties: {
          opportunity_id: { type: "string" },
          updates: { type: "object" },
        },
        required: ["opportunity_id", "updates"],
      },
    },
    {
      name: "pipeline_summary",
      description: "Get a summary of a pipeline's stages and deal counts/values",
      input_schema: {
        type: "object",
        properties: {
          pipeline_id: { type: "string" },
        },
        required: [],
      },
    },
    {
      name: "add_contact_note",
      description: "Add a note to a contact",
      input_schema: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          content: { type: "string" },
        },
        required: ["contact_id", "content"],
      },
    },
    {
      name: "create_task",
      description: "Create a calendar task for the user",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          due_date: { type: "string", description: "ISO date" },
          priority: {
            type: "string",
            description: "low, medium, high, urgent",
          },
        },
        required: ["title"],
      },
    },
    {
      name: "send_sms",
      description: "Send an SMS message to a phone number",
      input_schema: {
        type: "object",
        properties: {
          to: { type: "string", description: "Phone number" },
          body: { type: "string" },
        },
        required: ["to", "body"],
      },
    },
    {
      name: "remember",
      description:
        "Store a user preference or fact in memory for future reference",
      input_schema: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "Memory key (e.g. preferred_meeting_time)",
          },
          value: { type: "string", description: "Value to remember" },
          category: {
            type: "string",
            description:
              "scheduling, communication, preferences, contacts, rules, general",
          },
        },
        required: ["key", "value"],
      },
    },
    {
      name: "get_current_time",
      description: "Get the current date and time",
      input_schema: { type: "object", properties: {}, required: [] },
    },
  ];
}

async function executeTool(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; organization_id: string; email: string; full_name: string },
  toolName: string,
  input: Record<string, unknown>
): Promise<{ output: unknown; status: string }> {
  switch (toolName) {
    case "search_contacts": {
      const q = (input.query as string) || "";
      const limit = (input.limit as number) || 10;
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, company, status")
        .eq("org_id", user.organization_id)
        .or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%,phone.ilike.%${q}%`
        )
        .limit(limit);
      if (error) return { output: { error: error.message }, status: "error" };
      return { output: data, status: "success" };
    }

    case "get_contact": {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", input.contact_id as string)
        .eq("org_id", user.organization_id)
        .maybeSingle();
      if (error) return { output: { error: error.message }, status: "error" };
      if (!data)
        return { output: { error: "Contact not found" }, status: "error" };
      return { output: data, status: "success" };
    }

    case "update_contact": {
      const { data, error } = await supabase
        .from("contacts")
        .update(input.updates as Record<string, unknown>)
        .eq("id", input.contact_id as string)
        .eq("org_id", user.organization_id)
        .select("id, first_name, last_name, email")
        .maybeSingle();
      if (error) return { output: { error: error.message }, status: "error" };
      return {
        output: { updated: true, contact: data },
        status: "success",
      };
    }

    case "list_appointments_today": {
      const today = new Date();
      const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).toISOString();
      const end = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1
      ).toISOString();

      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, title, start_time, end_time, status, contacts(first_name, last_name)"
        )
        .eq("org_id", user.organization_id)
        .gte("start_time", start)
        .lt("start_time", end)
        .order("start_time");
      if (error) return { output: { error: error.message }, status: "error" };
      return { output: data, status: "success" };
    }

    case "list_appointments_range": {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, title, start_time, end_time, status, contacts(first_name, last_name)"
        )
        .eq("org_id", user.organization_id)
        .gte("start_time", input.start_date as string)
        .lt("start_time", input.end_date as string)
        .order("start_time");
      if (error) return { output: { error: error.message }, status: "error" };
      return { output: data, status: "success" };
    }

    case "create_appointment": {
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          org_id: user.organization_id,
          title: input.title,
          start_time: input.start_time,
          end_time: input.end_time,
          contact_id: input.contact_id || null,
          calendar_id: input.calendar_id || null,
          notes: input.notes || null,
          status: "scheduled",
          created_by: user.id,
        })
        .select("id, title, start_time, end_time")
        .single();
      if (error) return { output: { error: error.message }, status: "error" };
      return { output: { created: true, appointment: data }, status: "success" };
    }

    case "cancel_appointment": {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "canceled", notes: input.reason || "Canceled by Clara" })
        .eq("id", input.appointment_id as string)
        .eq("org_id", user.organization_id);
      if (error) return { output: { error: error.message }, status: "error" };
      return { output: { canceled: true }, status: "success" };
    }

    case "draft_email": {
      return {
        output: {
          draft: true,
          to: input.to,
          subject: input.subject,
          body: input.body,
          message:
            "Email draft created. Ask the user to review and confirm sending.",
        },
        status: "success",
      };
    }

    case "send_email": {
      const { data: conn } = await supabase
        .from("user_connected_accounts")
        .select("access_token, refresh_token, token_expires_at")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .maybeSingle();

      if (!conn || !conn.access_token) {
        return {
          output: { error: "Gmail not connected. Please connect Gmail in settings." },
          status: "error",
        };
      }

      let token = conn.access_token;
      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        const refreshed = await refreshGmailToken(supabase, user.id, conn.refresh_token);
        if (!refreshed) {
          return { output: { error: "Gmail token expired. Please reconnect." }, status: "error" };
        }
        token = refreshed;
      }

      const raw = createRawEmail(
        user.email,
        input.to as string,
        input.subject as string,
        input.body as string
      );

      const gmailRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        }
      );

      if (!gmailRes.ok) {
        const errText = await gmailRes.text();
        return { output: { error: `Gmail send failed: ${errText}` }, status: "error" };
      }

      const sent = await gmailRes.json();
      return { output: { sent: true, message_id: sent.id }, status: "success" };
    }

    case "list_recent_emails": {
      const { data: conn } = await supabase
        .from("user_connected_accounts")
        .select("access_token, refresh_token, token_expires_at")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .maybeSingle();

      if (!conn || !conn.access_token) {
        return { output: { error: "Gmail not connected" }, status: "error" };
      }

      let token = conn.access_token;
      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        const refreshed = await refreshGmailToken(supabase, user.id, conn.refresh_token);
        if (!refreshed) return { output: { error: "Gmail token expired" }, status: "error" };
        token = refreshed;
      }

      const query = (input.query as string) || "in:inbox";
      const limit = (input.limit as number) || 10;
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!listRes.ok) {
        return { output: { error: "Failed to fetch emails" }, status: "error" };
      }

      const listData = await listRes.json();
      const messages = listData.messages || [];

      const summaries = [];
      for (const m of messages.slice(0, 5)) {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];
          summaries.push({
            id: m.id,
            subject: headers.find((h: { name: string }) => h.name === "Subject")?.value || "",
            from: headers.find((h: { name: string }) => h.name === "From")?.value || "",
            date: headers.find((h: { name: string }) => h.name === "Date")?.value || "",
            snippet: msgData.snippet || "",
          });
        }
      }

      return { output: summaries, status: "success" };
    }

    case "get_email": {
      const { data: conn } = await supabase
        .from("user_connected_accounts")
        .select("access_token, refresh_token, token_expires_at")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .maybeSingle();

      if (!conn?.access_token) {
        return { output: { error: "Gmail not connected" }, status: "error" };
      }

      let token = conn.access_token;
      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        const refreshed = await refreshGmailToken(supabase, user.id, conn.refresh_token);
        if (!refreshed) return { output: { error: "Gmail token expired" }, status: "error" };
        token = refreshed;
      }

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${input.message_id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return { output: { error: "Failed to fetch email" }, status: "error" };
      const data = await res.json();
      return { output: { id: data.id, snippet: data.snippet, payload: data.payload }, status: "success" };
    }

    case "list_opportunities": {
      let q = supabase
        .from("opportunities")
        .select("id, title, value, status, stage_id, contact_id, owner_id, created_at")
        .eq("org_id", user.organization_id);

      if (input.pipeline_id) q = q.eq("pipeline_id", input.pipeline_id as string);
      if (input.stage_id) q = q.eq("stage_id", input.stage_id as string);
      if (input.status) q = q.eq("status", input.status as string);

      const { data, error } = await q.order("created_at", { ascending: false }).limit((input.limit as number) || 20);
      if (error) return { output: { error: error.message }, status: "error" };
      return { output: data, status: "success" };
    }

    case "get_opportunity": {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", input.opportunity_id as string)
        .eq("org_id", user.organization_id)
        .maybeSingle();
      if (error) return { output: { error: error.message }, status: "error" };
      return { output: data, status: "success" };
    }

    case "update_opportunity": {
      const { data, error } = await supabase
        .from("opportunities")
        .update(input.updates as Record<string, unknown>)
        .eq("id", input.opportunity_id as string)
        .eq("org_id", user.organization_id)
        .select("id, title, status, value")
        .maybeSingle();
      if (error) return { output: { error: error.message }, status: "error" };
      return { output: { updated: true, opportunity: data }, status: "success" };
    }

    case "pipeline_summary": {
      let pipelineQuery = supabase
        .from("pipelines")
        .select("id, name")
        .eq("org_id", user.organization_id);

      if (input.pipeline_id) {
        pipelineQuery = pipelineQuery.eq("id", input.pipeline_id as string);
      }

      const { data: pipelines } = await pipelineQuery.limit(1);
      if (!pipelines || pipelines.length === 0) {
        return { output: { error: "No pipeline found" }, status: "error" };
      }
      const pipeline = pipelines[0];

      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("pipeline_id", pipeline.id)
        .order("position");

      const { data: opps } = await supabase
        .from("opportunities")
        .select("stage_id, value, status")
        .eq("pipeline_id", pipeline.id)
        .eq("status", "open");

      const summary = (stages || []).map(
        (s: { id: string; name: string; position: number }) => {
          const stageOpps = (opps || []).filter(
            (o: { stage_id: string }) => o.stage_id === s.id
          );
          return {
            stage: s.name,
            count: stageOpps.length,
            total_value: stageOpps.reduce(
              (sum: number, o: { value: number }) => sum + (o.value || 0),
              0
            ),
          };
        }
      );

      return {
        output: { pipeline: pipeline.name, stages: summary },
        status: "success",
      };
    }

    case "add_contact_note": {
      const { error } = await supabase.from("contact_notes").insert({
        contact_id: input.contact_id,
        org_id: user.organization_id,
        content: input.content,
        created_by: user.id,
        source: "clara_assistant",
      });
      if (error) return { output: { error: error.message }, status: "error" };
      return { output: { added: true }, status: "success" };
    }

    case "create_task": {
      const { data, error } = await supabase
        .from("calendar_tasks")
        .insert({
          org_id: user.organization_id,
          title: input.title,
          description: input.description || null,
          due_date: input.due_date || null,
          priority: input.priority || "medium",
          status: "pending",
          assigned_to: user.id,
          created_by: user.id,
        })
        .select("id, title, due_date")
        .single();
      if (error) return { output: { error: error.message }, status: "error" };
      return { output: { created: true, task: data }, status: "success" };
    }

    case "send_sms": {
      return {
        output: { info: "SMS sending requires Twilio integration. Queued for review." },
        status: "success",
      };
    }

    case "remember": {
      const { error } = await supabase.from("assistant_user_memory").upsert(
        {
          user_id: user.id,
          org_id: user.organization_id,
          memory_key: input.key as string,
          memory_value: input.value,
          category: (input.category as string) || "general",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,memory_key" }
      );
      if (error) return { output: { error: error.message }, status: "error" };
      return {
        output: { remembered: true, key: input.key },
        status: "success",
      };
    }

    case "get_current_time": {
      return {
        output: { now: new Date().toISOString(), timezone: "UTC" },
        status: "success",
      };
    }

    default:
      return {
        output: { error: `Unknown tool: ${toolName}` },
        status: "error",
      };
  }
}

function isDestructiveAction(toolName: string): boolean {
  return [
    "send_email",
    "send_sms",
    "cancel_appointment",
    "update_contact",
    "update_opportunity",
  ].includes(toolName);
}

function getModuleFromTool(toolName: string): string {
  if (toolName.includes("contact") || toolName === "add_contact_note")
    return "contacts";
  if (toolName.includes("appointment") || toolName.includes("calendar"))
    return "calendar";
  if (toolName.includes("email")) return "email";
  if (toolName.includes("opportunity") || toolName.includes("pipeline"))
    return "opportunities";
  if (toolName.includes("task")) return "calendar";
  if (toolName.includes("sms")) return "messaging";
  if (toolName === "remember") return "memory";
  return "general";
}

function describeAction(
  toolName: string,
  input: Record<string, unknown>
): string {
  switch (toolName) {
    case "send_email":
      return `Send email to ${input.to}: "${input.subject}"`;
    case "send_sms":
      return `Send SMS to ${input.to}`;
    case "cancel_appointment":
      return `Cancel appointment ${input.appointment_id}`;
    case "update_contact":
      return `Update contact ${input.contact_id}`;
    case "update_opportunity":
      return `Update opportunity ${input.opportunity_id}`;
    default:
      return `${toolName}`;
  }
}

async function refreshGmailToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) return null;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    await supabase
      .from("user_connected_accounts")
      .update({
        access_token: data.access_token,
        token_expires_at: new Date(
          Date.now() + data.expires_in * 1000
        ).toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "gmail");

    return data.access_token;
  } catch {
    return null;
  }
}

function createRawEmail(
  from: string,
  to: string,
  subject: string,
  body: string
): string {
  const msg = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");

  return btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function learnFromInteraction(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  orgId: string,
  userMessage: string,
  _response: string
): Promise<void> {
  try {
    const patterns = [
      {
        regex: /(?:i prefer|always|usually|my style is|i like to)\s+(.+)/i,
        category: "preferences",
      },
      {
        regex: /(?:schedule|meeting|call)\s+(?:at|for)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
        category: "scheduling",
      },
    ];

    for (const p of patterns) {
      const match = userMessage.match(p.regex);
      if (match) {
        await supabase.from("assistant_user_memory").upsert(
          {
            user_id: userId,
            org_id: orgId,
            memory_key: `auto_${p.category}_${Date.now()}`,
            memory_value: match[0],
            category: p.category,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,memory_key" }
        );
      }
    }
  } catch {
    // non-critical
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
