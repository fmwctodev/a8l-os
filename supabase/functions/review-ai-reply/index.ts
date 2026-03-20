import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Review {
  id: string;
  organization_id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  provider: string;
}

interface ReputationSettings {
  brand_name: string | null;
  brand_voice_description: string | null;
  response_tone: "professional" | "friendly" | "apologetic" | "casual";
  ai_provider: "openai" | "anthropic" | "both";
}

interface Organization {
  name: string;
}

function buildReplyPrompt(
  review: Review,
  settings: ReputationSettings | null,
  orgName: string,
  tone: string
): string {
  const brandVoice = settings?.brand_voice_description || "";
  const businessName = settings?.brand_name || orgName;

  return `Generate a professional reply to the following customer review.

Business Name: ${businessName}
Review Platform: ${review.provider}
Customer Name: ${review.reviewer_name}
Rating: ${review.rating}/5 stars
Review Text: ${review.comment || "No text provided"}

${brandVoice ? `Brand Voice Guidelines: ${brandVoice}` : ""}

Tone: ${tone}

Guidelines for the reply:
1. Address the reviewer by name if appropriate
2. Thank them for their feedback
3. If negative (1-3 stars): Apologize sincerely, acknowledge their concerns specifically, offer to make it right
4. If positive (4-5 stars): Express genuine gratitude, highlight what made their experience positive
5. Keep it concise (2-4 sentences)
6. Include a call to action when appropriate (contact us, visit again, etc.)
7. Sign off with the business name
8. DO NOT use generic phrases like "valued customer" - be specific and personal
9. Match the tone specified: ${tone}

${tone === "apologetic" ? "Focus heavily on apologizing and making amends." : ""}
${tone === "friendly" ? "Use warm, conversational language." : ""}
${tone === "casual" ? "Be relaxed and approachable, but still professional." : ""}
${tone === "professional" ? "Maintain a formal, business-appropriate tone." : ""}

Respond with ONLY the reply text, no additional commentary or formatting.`;
}

async function generateWithAnthropic(
  prompt: string,
  apiKey: string
): Promise<{ reply: string; tokens: number; model: string }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      system: "You are an expert at writing professional, empathetic responses to customer reviews. Your replies are always helpful, specific, and match the requested tone.",
      messages: [
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const reply = data.content[0]?.text?.trim();

  if (!reply) {
    throw new Error("No content in Anthropic response");
  }

  return {
    reply,
    tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    model: "claude-sonnet-4-20250514",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { review_id, tone: overrideTone, provider: overrideProvider } = body;

    if (!review_id) {
      return new Response(
        JSON.stringify({ error: "review_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", review_id)
      .single();

    if (reviewError || !review) {
      return new Response(
        JSON.stringify({ error: "Review not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings } = await supabase
      .from("reputation_settings")
      .select("brand_name, brand_voice_description, response_tone, ai_provider")
      .eq("organization_id", review.organization_id)
      .maybeSingle();

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", review.organization_id)
      .single();

    const tone = overrideTone || settings?.response_tone || "professional";
    const provider = overrideProvider || settings?.ai_provider || "anthropic";
    const prompt = buildReplyPrompt(
      review as Review,
      settings as ReputationSettings | null,
      (org as Organization)?.name || "Our Business",
      tone
    );

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: { reply: string; tokens: number; model: string };

    try {
      result = await generateWithAnthropic(prompt, anthropicKey);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("ai_usage_logs").insert({
      organization_id: review.organization_id,
      feature: "review_reply",
      provider: "anthropic",
      model: result.model,
      tokens_used: result.tokens,
      metadata: {
        review_id,
        tone,
        rating: review.rating,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        reply: result.reply,
        provider: "anthropic",
        model: result.model,
        tokens: result.tokens,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Review AI reply error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
