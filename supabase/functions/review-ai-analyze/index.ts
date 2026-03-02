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
  ai_analysis_id: string | null;
}

interface AIAnalysisResult {
  sentiment_score: number;
  sentiment_label: "positive" | "neutral" | "negative";
  themes: string[];
  tags: string[];
  summary: string;
  key_phrases: string[];
  suggested_reply: string;
}

const ANALYSIS_PROMPT = `Analyze the following customer review and provide a structured analysis.

Review Rating: {rating}/5
Review Text: {comment}
Reviewer Name: {reviewer_name}

Provide your analysis in the following JSON format:
{
  "sentiment_score": <number between -1 and 1, where -1 is very negative, 0 is neutral, 1 is very positive>,
  "sentiment_label": <"positive", "neutral", or "negative">,
  "themes": <array of main themes/topics discussed, e.g., ["customer service", "product quality", "pricing"]>,
  "tags": <array of relevant tags for categorization, e.g., ["complaint", "praise", "suggestion"]>,
  "summary": <brief one-sentence summary of the review>,
  "key_phrases": <array of key phrases from the review that capture the main points>,
  "suggested_reply": <professional reply to this review that acknowledges their feedback>
}

Important guidelines:
- For sentiment_score, consider both the rating and the text content
- Themes should be specific to what the customer mentioned
- Tags should help categorize the type of feedback
- The suggested reply should be empathetic, professional, and address their specific concerns
- If the review is negative, the reply should apologize and offer to make things right
- If the review is positive, the reply should express gratitude

Respond ONLY with valid JSON, no additional text.`;

async function analyzeWithOpenAI(
  review: Review,
  apiKey: string
): Promise<{ result: AIAnalysisResult; tokens: number; model: string }> {
  const prompt = ANALYSIS_PROMPT
    .replace("{rating}", String(review.rating))
    .replace("{comment}", review.comment || "No text provided")
    .replace("{reviewer_name}", review.reviewer_name);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing customer reviews. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_completion_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No content in OpenAI response");
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from OpenAI response");
  }

  const result = JSON.parse(jsonMatch[0]) as AIAnalysisResult;
  const tokens = data.usage?.total_tokens || 0;

  return { result, tokens, model: "gpt-5.1" };
}

async function analyzeReview(
  review: Review,
  _provider: "openai" | "anthropic" | "both",
  supabase: ReturnType<typeof createClient>
): Promise<{ success: boolean; analysis_id?: string; error?: string }> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  let analysisResult: { result: AIAnalysisResult; tokens: number; model: string };

  try {
    if (!openaiKey) throw new Error("OpenAI API key not configured");
    analysisResult = await analyzeWithOpenAI(review, openaiKey);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }

  const { data: analysis, error: insertError } = await supabase
    .from("review_ai_analysis")
    .upsert(
      {
        organization_id: review.organization_id,
        review_id: review.id,
        sentiment_score: analysisResult!.result.sentiment_score,
        sentiment_label: analysisResult!.result.sentiment_label,
        themes: analysisResult!.result.themes,
        tags: analysisResult!.result.tags,
        summary: analysisResult!.result.summary,
        key_phrases: analysisResult!.result.key_phrases,
        suggested_reply: analysisResult!.result.suggested_reply,
        ai_provider: "openai",
        model_used: analysisResult!.model,
        tokens_used: analysisResult!.tokens,
        analyzed_at: new Date().toISOString(),
      },
      { onConflict: "review_id" }
    )
    .select()
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  await supabase
    .from("reviews")
    .update({ ai_analysis_id: analysis.id })
    .eq("id", review.id);

  return { success: true, analysis_id: analysis.id };
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

    const url = new URL(req.url);
    const reviewId = url.searchParams.get("review_id");
    const orgId = url.searchParams.get("org_id");
    const provider = (url.searchParams.get("provider") || "openai") as "openai" | "anthropic" | "both";

    if (req.method === "POST") {
      const body = await req.json();
      const targetReviewId = body.review_id || reviewId;

      if (!targetReviewId) {
        return new Response(
          JSON.stringify({ error: "review_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: review, error: reviewError } = await supabase
        .from("reviews")
        .select("*")
        .eq("id", targetReviewId)
        .single();

      if (reviewError || !review) {
        return new Response(
          JSON.stringify({ error: "Review not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await analyzeReview(
        review as Review,
        body.provider || provider,
        supabase
      );

      if (result.success) {
        const { data: analysis } = await supabase
          .from("review_ai_analysis")
          .select("*")
          .eq("id", result.analysis_id)
          .single();

        return new Response(
          JSON.stringify({ success: true, analysis }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let reviewsQuery = supabase
      .from("reviews")
      .select("*")
      .is("ai_analysis_id", null)
      .not("comment", "is", null)
      .order("received_at", { ascending: false })
      .limit(20);

    if (orgId) {
      reviewsQuery = reviewsQuery.eq("organization_id", orgId);
    }

    const { data: reviews, error: reviewsError } = await reviewsQuery;

    if (reviewsError) throw reviewsError;

    const results: Array<{ review_id: string; success: boolean; error?: string }> = [];

    for (const review of reviews || []) {
      const { data: settings } = await supabase
        .from("reputation_settings")
        .select("ai_provider, auto_analyze_reviews")
        .eq("organization_id", review.organization_id)
        .maybeSingle();

      if (settings?.auto_analyze_reviews === false) {
        continue;
      }

      const providerToUse = (settings?.ai_provider || "openai") as "openai" | "anthropic" | "both";
      const result = await analyzeReview(review as Review, providerToUse, supabase);
      results.push({ review_id: review.id, ...result });
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Review AI analyze error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
