import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ToneConfig {
  key: string;
  label: string;
  instruction: string;
}

const TONE_PRESETS: ToneConfig[] = [
  {
    key: "professional",
    label: "Concise Professional",
    instruction:
      "Write a concise, formal, business-appropriate reply. Be direct and polished. 2-3 sentences maximum.",
  },
  {
    key: "friendly",
    label: "Friendly Empathetic",
    instruction:
      "Write a warm, empathetic, conversational reply. Show genuine care and understanding. Use friendly language. 2-4 sentences.",
  },
  {
    key: "fix_it",
    label: "Problem-Solving",
    instruction:
      "Write a solution-oriented reply focused on resolving the issue. Acknowledge the problem, offer a concrete next step or fix, and invite further contact. 2-4 sentences.",
  },
];

function buildSystemPrompt(
  brandVoice: string | null,
  orgName: string,
  signature: string | null,
  appendSignature: boolean,
  escalationEmail: string | null
): string {
  let prompt = `You are an expert at writing professional, empathetic responses to customer reviews on behalf of "${orgName}".

SAFETY RULES (MANDATORY):
- Never invent facts about the business or customer's experience
- Never promise refunds, discounts, or compensation unless the business policy explicitly allows it
- Never ask for private information (email, phone, address) in a public reply
- If the review mentions legal threats, medical issues, or safety concerns, recommend taking the conversation offline
- Output ONLY the reply text. No markdown, no quotes, no labels.`;

  if (brandVoice) {
    prompt += `\n\nBRAND VOICE GUIDELINES:\n${brandVoice}`;
  }

  if (escalationEmail) {
    prompt += `\n\nFor serious issues, direct the customer to: ${escalationEmail}`;
  }

  if (appendSignature && signature) {
    prompt += `\n\nAlways end with this signature:\n${signature}`;
  }

  return prompt;
}

function buildUserPrompt(
  review: {
    rating: number;
    review_text: string | null;
    reviewer_name: string;
    platform: string;
  },
  toneInstruction: string,
  customInstructions?: string
): string {
  const platformLabel =
    review.platform === "googlebusiness"
      ? "Google Business Profile"
      : "Facebook";

  let prompt = `Review Platform: ${platformLabel}
Reviewer: ${review.reviewer_name}
Rating: ${review.rating}/5 stars
Review Text: ${review.review_text || "(No text provided)"}

TONE: ${toneInstruction}`;

  if (review.rating <= 2) {
    prompt += `\n\nThis is a negative review. Apologize sincerely, acknowledge specific concerns mentioned, and offer to make it right.`;
  } else if (review.rating === 3) {
    prompt += `\n\nThis is a mixed review. Acknowledge what went well and address any concerns mentioned.`;
  } else {
    prompt += `\n\nThis is a positive review. Express genuine gratitude and highlight what made their experience great.`;
  }

  if (customInstructions) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS: ${customInstructions}`;
  }

  return prompt;
}

async function generateDraft(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  temperature: number
): Promise<{ text: string; tokens: number }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_completion_tokens: 400,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from OpenAI");

  return { text, tokens: data.usage?.total_tokens || 0 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: authData, error: authError } =
      await anonClient.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userId = authData.user.id;
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();

    if (!userData?.organization_id) {
      return new Response(
        JSON.stringify({ error: "User organization not found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const orgId = userData.organization_id;
    const body = await req.json();
    const { review_id, instructions } = body;

    if (!review_id) {
      return new Response(
        JSON.stringify({ error: "review_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: review, error: reviewError } = await supabase
      .from("reputation_reviews")
      .select("*")
      .eq("id", review_id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (reviewError || !review) {
      return new Response(
        JSON.stringify({ error: "Review not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: settings } = await supabase
      .from("reputation_settings")
      .select(
        "brand_name, brand_voice_description, response_tone, default_temperature, default_signature, auto_append_signature, escalation_email"
      )
      .eq("organization_id", orgId)
      .maybeSingle();

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();

    const temperature = Number(settings?.default_temperature) || 0.4;
    const orgName = settings?.brand_name || org?.name || "Our Business";
    const brandVoice = settings?.brand_voice_description || null;
    const signature = settings?.default_signature || null;
    const appendSignature = settings?.auto_append_signature ?? true;
    const escalationEmail = settings?.escalation_email || null;

    const systemPrompt = buildSystemPrompt(
      brandVoice,
      orgName,
      signature,
      appendSignature,
      escalationEmail
    );

    const drafts: Array<{
      id: string;
      tone_preset: string;
      tone_label: string;
      draft_text: string;
      tokens: number;
    }> = [];

    let totalTokens = 0;

    for (const tone of TONE_PRESETS) {
      const userPrompt = buildUserPrompt(
        review,
        tone.instruction,
        instructions
      );

      const result = await generateDraft(
        systemPrompt,
        userPrompt,
        openaiKey,
        temperature
      );

      const { data: draftRow } = await supabase
        .from("reputation_ai_drafts")
        .insert({
          org_id: orgId,
          review_id,
          draft_text: result.text,
          model: "gpt-5.1",
          tone_preset: tone.key,
          created_by_user_id: userId,
          applied: false,
        })
        .select("id")
        .maybeSingle();

      drafts.push({
        id: draftRow?.id || "",
        tone_preset: tone.key,
        tone_label: tone.label,
        draft_text: result.text,
        tokens: result.tokens,
      });

      totalTokens += result.tokens;
    }

    await supabase.from("ai_usage_logs").insert({
      organization_id: orgId,
      feature: "reputation_ai_draft",
      provider: "openai",
      model: "gpt-5.1",
      tokens_used: totalTokens,
      metadata: {
        review_id,
        rating: review.rating,
        platform: review.platform,
        drafts_generated: drafts.length,
        temperature,
      },
    });

    await supabase.from("reputation_actions_audit").insert({
      org_id: orgId,
      user_id: userId,
      action: "generate_ai_reply",
      entity_type: "draft",
      entity_id: review_id,
      metadata: {
        review_id,
        drafts_count: drafts.length,
        total_tokens: totalTokens,
        temperature,
        instructions: instructions || null,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        drafts,
        model: "gpt-5.1",
        total_tokens: totalTokens,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[reputation-ai-generate] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
