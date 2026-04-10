import { createClient } from "npm:@supabase/supabase-js@2";
import { extractUserContext, getSupabaseClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CaptionRequest {
  prompt: string;
  platforms: string[];
  tone?: 'professional' | 'casual' | 'friendly' | 'humorous' | 'inspirational';
  includeHashtags?: boolean;
  includeEmojis?: boolean;
  brandVoice?: string;
  characterLimit?: number;
}

interface CaptionResponse {
  suggestions: string[];
  generationId?: string;
}

const PLATFORM_CHARACTER_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  google_business: 1500,
  tiktok: 2200,
  youtube: 5000,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = getSupabaseClient();
    const userContext = await extractUserContext(req, supabase);

    if (!userContext) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Check Supabase Dashboard logs for [Auth] diagnostic info." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = userContext;
    const orgId = user.orgId || "";

    if (!orgId) {
      return new Response(JSON.stringify({ error: "User not associated with an organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CaptionRequest = await req.json();
    const {
      prompt,
      platforms = [],
      tone = 'professional',
      includeHashtags = true,
      includeEmojis = true,
      brandVoice,
    } = body;

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const minCharLimit = platforms.length > 0
      ? Math.min(...platforms.map(p => PLATFORM_CHARACTER_LIMITS[p] || 2200))
      : 2200;

    let providerConfig: { provider: string; api_key_encrypted: string; base_url?: string } | null = null;
    const { data: dbProvider } = await supabase
      .from("llm_providers")
      .select("*")
      .eq("org_id", orgId)
      .eq("enabled", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (dbProvider?.api_key_encrypted) {
      providerConfig = dbProvider;
    } else {
      const envKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (envKey) {
        providerConfig = { provider: "anthropic", api_key_encrypted: envKey };
      }
    }

    let suggestions: string[];

    if (providerConfig?.api_key_encrypted) {
      suggestions = await generateWithLLM(
        providerConfig,
        prompt,
        platforms,
        tone,
        includeHashtags,
        includeEmojis,
        brandVoice,
        minCharLimit
      );
    } else {
      suggestions = generateFallbackCaptions(
        prompt,
        platforms,
        tone,
        includeHashtags,
        includeEmojis,
        minCharLimit
      );
    }

    const { data: generation } = await supabase
      .from("content_ai_generations")
      .insert({
        organization_id: orgId,
        user_id: user.id,
        content_type: "social_caption",
        prompt,
        output: { suggestions },
        model_used: providerConfig?.provider || "fallback",
        tokens_used: 0,
        metadata: {
          platforms,
          tone,
          includeHashtags,
          includeEmojis,
        },
      })
      .select("id")
      .single();

    const response: CaptionResponse = {
      suggestions,
      generationId: generation?.id,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Caption generation error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate captions" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function generateWithLLM(
  providerConfig: { provider: string; api_key_encrypted: string; base_url?: string },
  prompt: string,
  platforms: string[],
  tone: string,
  includeHashtags: boolean,
  includeEmojis: boolean,
  brandVoice: string | undefined,
  characterLimit: number
): Promise<string[]> {
  const systemPrompt = buildSystemPrompt(
    platforms,
    tone,
    includeHashtags,
    includeEmojis,
    brandVoice,
    characterLimit
  );

  const userPrompt = `Create 3 engaging social media captions for the following topic:\n\n${prompt}`;

  try {
    const apiKey = providerConfig.api_key_encrypted;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.content?.[0]?.text || "";
      return parseCaptions(content);
    }

    return generateFallbackCaptions(prompt, platforms, tone, includeHashtags, includeEmojis, characterLimit);
  } catch {
    return generateFallbackCaptions(prompt, platforms, tone, includeHashtags, includeEmojis, characterLimit);
  }
}

function buildSystemPrompt(
  platforms: string[],
  tone: string,
  includeHashtags: boolean,
  includeEmojis: boolean,
  brandVoice: string | undefined,
  characterLimit: number
): string {
  let prompt = `You are a social media content expert. Create engaging, platform-appropriate captions.

Tone: ${tone}
Target platforms: ${platforms.join(", ") || "general social media"}
Maximum character limit: ${characterLimit} characters per caption

Requirements:
- Create exactly 3 unique caption variations
- Each caption should be complete and ready to post
- Optimize for engagement (likes, comments, shares)`;

  if (includeHashtags) {
    prompt += "\n- Include 3-5 relevant hashtags at the end of each caption";
  }

  if (includeEmojis) {
    prompt += "\n- Use 2-4 relevant emojis naturally throughout the caption";
  }

  if (brandVoice) {
    prompt += `\n- Match this brand voice: ${brandVoice}`;
  }

  prompt += `

Format your response as:
1. [First caption]
2. [Second caption]
3. [Third caption]

Do not include any other text or explanations.`;

  return prompt;
}

function parseCaptions(content: string): string[] {
  const lines = content.split("\n").filter(line => line.trim());
  const captions: string[] = [];

  for (const line of lines) {
    const cleaned = line.replace(/^\d+[\.\)]\s*/, "").trim();
    if (cleaned.length > 10) {
      captions.push(cleaned);
    }
  }

  return captions.slice(0, 3);
}

function generateFallbackCaptions(
  prompt: string,
  platforms: string[],
  tone: string,
  includeHashtags: boolean,
  includeEmojis: boolean,
  characterLimit: number
): string[] {
  const templates = getFallbackTemplates(tone);
  const hashtags = generateHashtags(prompt);
  const emojis = getRelevantEmojis(prompt);

  return templates.map(template => {
    let caption = template.replace("{topic}", prompt);

    if (includeEmojis && emojis.length > 0) {
      caption = `${emojis[0]} ${caption} ${emojis.slice(1, 3).join("")}`;
    }

    if (includeHashtags && hashtags.length > 0) {
      caption += `\n\n${hashtags.join(" ")}`;
    }

    if (caption.length > characterLimit) {
      const hashtagPart = includeHashtags ? `\n\n${hashtags.join(" ")}` : "";
      const maxBodyLength = characterLimit - hashtagPart.length;
      caption = caption.substring(0, maxBodyLength - 3) + "..." + hashtagPart;
    }

    return caption;
  });
}

function getFallbackTemplates(tone: string): string[] {
  const templates: Record<string, string[]> = {
    professional: [
      "We're excited to share: {topic}. This represents our commitment to excellence and innovation.",
      "Announcing: {topic}. Learn how this can benefit you and your business.",
      "Big news! {topic} - another step forward in our mission to deliver value.",
    ],
    casual: [
      "Hey everyone! Check this out: {topic}. Pretty cool, right?",
      "Just wanted to share: {topic}. What do you think?",
      "Guess what? {topic}! We're super excited about this!",
    ],
    friendly: [
      "Hi friends! We have something special to share: {topic}. We'd love to hear your thoughts!",
      "Happy to announce: {topic}. Thanks for being part of our journey!",
      "We're thrilled to tell you about: {topic}. Your support means everything!",
    ],
    humorous: [
      "Plot twist: {topic}. You didn't see that coming, did you?",
      "Breaking news (not really breaking, but still important): {topic}!",
      "Here's something to brighten your day: {topic}. You're welcome!",
    ],
    inspirational: [
      "Every great journey starts with a single step. Today, that step is: {topic}",
      "Dream big, act bold. Introducing: {topic}. Let's make it happen together.",
      "The future is now: {topic}. Join us in making a difference.",
    ],
  };

  return templates[tone] || templates.professional;
}

function generateHashtags(prompt: string): string[] {
  const words = prompt.toLowerCase().split(/\s+/);
  const keywords = words.filter(w => w.length > 3 && !["this", "that", "with", "from", "have", "will", "your", "about"].includes(w));

  const hashtags = keywords.slice(0, 3).map(w => `#${w.replace(/[^a-z0-9]/g, "")}`);

  const generalHashtags = ["#business", "#growth", "#success", "#innovation", "#updates"];
  while (hashtags.length < 4 && generalHashtags.length > 0) {
    const tag = generalHashtags.shift()!;
    if (!hashtags.includes(tag)) {
      hashtags.push(tag);
    }
  }

  return hashtags;
}

function getRelevantEmojis(prompt: string): string[] {
  const promptLower = prompt.toLowerCase();

  const emojiMap: Record<string, string[]> = {
    launch: ["🚀", "🎉", "✨"],
    sale: ["🏷️", "💰", "🎁"],
    new: ["✨", "🆕", "🎊"],
    team: ["👥", "🤝", "💪"],
    growth: ["📈", "🌱", "🚀"],
    success: ["🏆", "⭐", "🎯"],
    announcement: ["📢", "🎉", "✨"],
    update: ["🔄", "📝", "ℹ️"],
    product: ["📦", "🛍️", "✨"],
    service: ["🔧", "💼", "✅"],
    event: ["📅", "🎪", "🎉"],
    webinar: ["💻", "🎓", "📺"],
    holiday: ["🎄", "🎁", "❄️"],
    summer: ["☀️", "🌴", "🏖️"],
    thank: ["🙏", "❤️", "💝"],
  };

  for (const [keyword, emojis] of Object.entries(emojiMap)) {
    if (promptLower.includes(keyword)) {
      return emojis;
    }
  }

  return ["✨", "💡", "📌"];
}
