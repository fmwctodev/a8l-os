import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CLARA_MODEL,
  CLARA_TEMPERATURE,
  CLARA_MAX_TOKENS,
  getAnthropicMessagesUrl,
  extractTextFromResponse,
  buildAnthropicHeaders,
  type AnthropicResponse,
} from "../_shared/claraConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: userData } = await supabase
      .from("users")
      .select("id, organization_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!userData) return json({ error: "User not found" }, 404);

    const { transcription_id } = await req.json();
    if (!transcription_id) return json({ error: "transcription_id required" }, 400);

    const { data: transcription, error: txErr } = await supabase
      .from("meeting_transcriptions")
      .select("*")
      .eq("id", transcription_id)
      .eq("org_id", userData.organization_id)
      .maybeSingle();

    if (txErr || !transcription) {
      return json({ error: "Transcription not found" }, 404);
    }

    const transcript = transcription.transcript_text || "";
    if (!transcript.trim()) {
      return json({ error: "Empty transcript" }, 400);
    }

    const llmConfig = await resolveLLMConfig(supabase, userData.organization_id);

    const systemPrompt = `You are an AI meeting assistant. Analyze the following meeting transcript and produce a structured summary.

Return a JSON object with these fields:
- summary: A concise 2-4 paragraph summary of the meeting
- key_decisions: An array of strings, each a key decision made
- action_items: An array of objects with {assignee, task, deadline}
- attendee_sentiments: An object mapping attendee names to their overall sentiment (positive, neutral, negative, concerned)
- opportunity_signals: An object with {deal_mentioned: boolean, follow_up_needed: boolean, budget_discussed: boolean, next_steps: string}

Only return valid JSON, no markdown.`;

    const response = await callLLM(llmConfig, systemPrompt, transcript);

    let parsed;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        summary: response,
        key_decisions: [],
        action_items: [],
        attendee_sentiments: null,
        opportunity_signals: null,
      };
    } catch {
      parsed = {
        summary: response,
        key_decisions: [],
        action_items: [],
        attendee_sentiments: null,
        opportunity_signals: null,
      };
    }

    const { data: summary, error: insertErr } = await supabase
      .from("assistant_meeting_summaries")
      .insert({
        user_id: user.id,
        org_id: userData.organization_id,
        meeting_transcription_id: transcription_id,
        summary: parsed.summary || "",
        key_decisions: parsed.key_decisions || [],
        action_items: parsed.action_items || [],
        attendee_sentiments: parsed.attendee_sentiments || null,
        opportunity_signals: parsed.opportunity_signals || null,
      })
      .select("*")
      .single();

    if (insertErr) {
      console.error("[assistant-meeting-processor] Insert error:", insertErr);
      return json({ error: "Failed to save summary" }, 500);
    }

    return json(summary);
  } catch (err) {
    console.error("[assistant-meeting-processor] Error:", err);
    return json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500
    );
  }
});

interface LLMConfig {
  provider: "anthropic";
  model: string;
  apiKey: string;
}

async function resolveLLMConfig(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<LLMConfig> {
  const { data: providers } = await supabase
    .from("llm_providers")
    .select("*")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .limit(10);

  // Prefer platform-level env var (Supabase secrets) over per-org DB keys
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    return { provider: "anthropic", model: CLARA_MODEL, apiKey: anthropicKey };
  }

  if (providers && providers.length > 0) {
    for (const p of providers) {
      if (p.provider === "anthropic" && p.api_key_encrypted) {
        return {
          provider: "anthropic",
          model: CLARA_MODEL,
          apiKey: p.api_key_encrypted,
        };
      }
    }
  }
  throw new Error("No LLM provider configured");
}

async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  transcript: string
): Promise<string> {
  const url = getAnthropicMessagesUrl();

  console.log("Clara using model:", CLARA_MODEL);

  const res = await fetch(url, {
    method: "POST",
    headers: buildAnthropicHeaders(config.apiKey),
    body: JSON.stringify({
      model: CLARA_MODEL,
      system: systemPrompt,
      messages: [{ role: "user", content: transcript.slice(0, 100000) }],
      temperature: CLARA_TEMPERATURE,
      max_tokens: CLARA_MAX_TOKENS,
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
  const data = await res.json() as AnthropicResponse;
  return extractTextFromResponse(data);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
