import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatRequest {
  thread_id: string;
  content: string;
  message_type?: "text" | "url_share" | "image_share";
  attachments?: Array<{ type: string; url: string; title?: string }>;
  image_model_id?: string;
  video_model_id?: string;
  aspect_ratio?: string;
  auto_generate_media?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, name")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return new Response(
        JSON.stringify({
          error: "User not associated with an organization",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const orgId = userData.organization_id;
    const body: ChatRequest = await req.json();
    const {
      thread_id, content, message_type = "text", attachments,
      image_model_id, video_model_id, aspect_ratio,
      auto_generate_media = true,
    } = body;

    if (!thread_id || !content?.trim()) {
      return new Response(
        JSON.stringify({ error: "thread_id and content are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: thread } = await supabase
      .from("social_ai_threads")
      .select("id, organization_id")
      .eq("id", thread_id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!thread) {
      return new Response(
        JSON.stringify({ error: "Thread not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: history } = await supabase
      .from("social_ai_messages")
      .select("role, content, message_type")
      .eq("thread_id", thread_id)
      .order("created_at", { ascending: true })
      .limit(20);

    const { data: accounts } = await supabase
      .from("social_accounts")
      .select("provider, display_name, status")
      .eq("organization_id", orgId)
      .eq("status", "connected");

    const { data: guidelines } = await supabase
      .from("social_guidelines")
      .select("tone_preferences, words_to_avoid, hashtag_preferences, cta_rules, emoji_rules, industry_positioning, platform_tweaks")
      .eq("organization_id", orgId)
      .is("user_id", null)
      .maybeSingle();

    let brandContext = "";
    const { data: brandVoice } = await supabase
      .from("brand_voices")
      .select("id")
      .eq("org_id", orgId)
      .eq("active", true)
      .is("archived_at", null)
      .maybeSingle();

    if (brandVoice) {
      const { data: version } = await supabase
        .from("brand_voice_versions")
        .select("tone_settings, dos, donts, vocabulary_preferred, vocabulary_prohibited, ai_system_prompt")
        .eq("brand_voice_id", brandVoice.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (version?.ai_system_prompt) {
        brandContext = `\nBrand Voice: ${version.ai_system_prompt}`;
      }
    }

    const { data: providerConfig } = await supabase
      .from("llm_providers")
      .select("*")
      .eq("org_id", orgId)
      .eq("enabled", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let effectiveProvider = providerConfig;
    if (!effectiveProvider?.api_key_encrypted) {
      const envKey = Deno.env.get("OPENAI_API_KEY");
      if (envKey) {
        effectiveProvider = { provider: "openai", api_key_encrypted: envKey };
      }
    }

    const connectedPlatforms = (accounts || [])
      .map((a) => `${a.display_name} (${a.provider})`)
      .join(", ");

    const guidelinesContext = guidelines
      ? buildGuidelinesContext(guidelines)
      : "";

    const systemPrompt = `You are an expert AI social media manager. You help the user create, strategize, and optimize their social media content across platforms.

Connected accounts: ${connectedPlatforms || "None connected yet"}
${brandContext}
${guidelinesContext}

Your capabilities:
- Create post drafts for any platform with AI-generated media
- Suggest optimal posting times based on engagement data
- Recommend content strategies and themes
- Analyze URLs shared by the user to extract content for repurposing
- Generate campaign ideas with multiple post variations
- Advise on hashtag strategy, CTAs, and audience engagement

When creating a post draft, you MUST format it as:
---DRAFT---
{"platform":"instagram","body":"Your post text here","hook_text":"Opening hook","cta_text":"Call to action","hashtags":["tag1","tag2"],"media_type":"image","visual_style_suggestion":"Detailed generation prompt for the visual"}
---END_DRAFT---

IMPORTANT rules for the draft JSON:
- "media_type" MUST be one of: "image", "video", or "none"
  - Instagram feed/carousel: "image"
  - Instagram Reels, TikTok, YouTube Shorts: "video"
  - LinkedIn, Facebook, Twitter text posts: "none" (unless visual content is relevant)
  - When in doubt for visual platforms, use "image"
- "visual_style_suggestion" MUST be a detailed, specific image/video generation prompt (NOT vague).
  Good: "Professional flat-lay photograph of a laptop on a dark wooden desk with coffee, dramatic side lighting, warm tones, business theme"
  Bad: "Business image" or "Something professional"
  For video: describe the scene, movement, mood, and style. Example: "Smooth cinematic pan across a modern office space, natural lighting, people collaborating at standing desks, warm color grading, 5 seconds"

Always be proactive with suggestions. If the user shares a topic, immediately create drafts.
Keep responses concise but actionable. Use short paragraphs.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...(history || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content },
    ];

    let aiResponse: string;

    if (effectiveProvider?.api_key_encrypted) {
      aiResponse = await callLLM(effectiveProvider, messages);
    } else {
      aiResponse = generateFallbackResponse(content, connectedPlatforms);
    }

    const drafts = extractDrafts(aiResponse);
    const cleanedResponse = aiResponse
      .replace(/---DRAFT---[\s\S]*?---END_DRAFT---/g, "")
      .trim();

    const mediaJobs: Array<{
      job_id: string;
      model_id: string;
      model_name: string;
      media_type: string;
      prompt: string;
      status: string;
      draft_index: number;
    }> = [];

    if (auto_generate_media) {
      const kieApiKey = Deno.env.get("KIE_API_KEY");
      if (kieApiKey) {
        const mediaDrafts = drafts.filter(
          (d) => d.media_type && d.media_type !== "none" && d.visual_style_suggestion
        );

        for (let i = 0; i < mediaDrafts.length; i++) {
          const draft = mediaDrafts[i];
          const draftIndex = drafts.indexOf(draft);
          const isVideo = draft.media_type === "video";
          const preferredModelId = isVideo ? video_model_id : image_model_id;

          try {
            let model: Record<string, unknown> | null = null;

            if (preferredModelId) {
              const { data: preferred } = await supabase
                .from("kie_models")
                .select("*")
                .eq("id", preferredModelId)
                .eq("enabled", true)
                .maybeSingle();
              model = preferred;
            }

            if (!model) {
              const { data: recommended } = await supabase
                .from("kie_models")
                .select("*")
                .eq("type", isVideo ? "video" : "image")
                .eq("enabled", true)
                .eq("is_recommended", true)
                .order("display_priority", { ascending: true })
                .limit(1)
                .maybeSingle();
              model = recommended;
            }

            if (!model) continue;

            const effectiveAspect = aspect_ratio || getPlatformAspectRatio(draft.platform);

            const { data: job, error: jobErr } = await supabase
              .from("media_generation_jobs")
              .insert({
                organization_id: orgId,
                created_by: user.id,
                model_id: model.id,
                prompt: draft.visual_style_suggestion,
                params: {
                  aspect_ratio: effectiveAspect,
                  ...(isVideo ? { duration: (model as Record<string, unknown>).supports_durations?.[0] || 5 } : {}),
                },
                status: "waiting",
              })
              .select("id")
              .single();

            if (jobErr || !job) continue;

            const webhookUrl = `${supabaseUrl}/functions/v1/media-kie-webhook`;
            const modelKey = model.model_key as string;
            const isVeo = modelKey.startsWith("google/veo-");

            let kieEndpoint: string;
            let kieBody: Record<string, unknown>;

            if (isVeo) {
              kieEndpoint = (model.api_endpoint_override as string) || "https://api.kie.ai/api/v1/veo/generate";
              kieBody = {
                prompt: draft.visual_style_suggestion,
                aspect_ratio: effectiveAspect,
                duration: (model as Record<string, unknown>).supports_durations?.[0] || 8,
                callBackUrl: webhookUrl,
              };
            } else {
              kieEndpoint = "https://api.kie.ai/api/v1/jobs/createTask";
              const input: Record<string, unknown> = {
                prompt: draft.visual_style_suggestion,
                aspect_ratio: effectiveAspect,
              };
              if (isVideo) {
                input.duration = (model as Record<string, unknown>).supports_durations?.[0] || 5;
              }
              kieBody = {
                model: modelKey,
                callBackUrl: webhookUrl,
                input,
              };
            }

            const kieRes = await fetch(kieEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${kieApiKey}`,
              },
              body: JSON.stringify(kieBody),
            });

            const kieResult = await kieRes.json();

            if (kieRes.ok && kieResult.code === 200) {
              const taskId = kieResult.data?.taskId || kieResult.data?.task_id;
              await supabase
                .from("media_generation_jobs")
                .update({ kie_task_id: taskId, status: "queuing" })
                .eq("id", job.id);

              mediaJobs.push({
                job_id: job.id,
                model_id: model.id as string,
                model_name: model.display_name as string,
                media_type: draft.media_type!,
                prompt: draft.visual_style_suggestion!,
                status: "queuing",
                draft_index: draftIndex,
              });
            } else {
              await supabase
                .from("media_generation_jobs")
                .update({
                  status: "fail",
                  error_message: kieResult.msg || "Kie API error",
                  completed_at: new Date().toISOString(),
                })
                .eq("id", job.id);
            }
          } catch (mediaErr) {
            console.error("Media generation error for draft:", mediaErr);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        response: cleanedResponse || aiResponse,
        drafts,
        media_jobs: mediaJobs,
        model_used: effectiveProvider?.provider || "fallback",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("AI social chat error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function buildGuidelinesContext(guidelines: Record<string, unknown>): string {
  const parts: string[] = ["\nSocial Guidelines:"];

  if (guidelines.tone_preferences) {
    const tone = guidelines.tone_preferences as Record<string, number>;
    parts.push(
      `- Tone: formality=${tone.formality || 50}, humor=${tone.humor || 50}, enthusiasm=${tone.enthusiasm || 50}`
    );
  }
  if (
    guidelines.words_to_avoid &&
    (guidelines.words_to_avoid as string[]).length > 0
  ) {
    parts.push(
      `- Avoid words: ${(guidelines.words_to_avoid as string[]).join(", ")}`
    );
  }
  if (guidelines.industry_positioning) {
    parts.push(`- Industry positioning: ${guidelines.industry_positioning}`);
  }

  return parts.length > 1 ? parts.join("\n") : "";
}

async function callLLM(
  providerConfig: {
    provider: string;
    api_key_encrypted: string;
    base_url?: string;
  },
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = providerConfig.api_key_encrypted;

  if (providerConfig.provider === "openai") {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.8,
          max_tokens: 2000,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }
    throw new Error("OpenAI API request failed");
  }

  if (providerConfig.provider === "anthropic") {
    const systemMsg = messages.find((m) => m.role === "system");
    const chatMessages = messages.filter((m) => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 2000,
        system: systemMsg?.content || "",
        messages: chatMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.content?.[0]?.text || "";
    }
    throw new Error("Anthropic API request failed");
  }

  throw new Error(`Unsupported provider: ${providerConfig.provider}`);
}

function getPlatformAspectRatio(platform: string): string {
  const ratios: Record<string, string> = {
    instagram: "1:1",
    tiktok: "9:16",
    youtube: "16:9",
    facebook: "16:9",
    linkedin: "16:9",
    twitter: "16:9",
    google_business: "16:9",
  };
  return ratios[platform] || "16:9";
}

interface ExtractedDraft {
  platform: string;
  body: string;
  hook_text?: string;
  cta_text?: string;
  hashtags?: string[];
  visual_style_suggestion?: string;
  media_type?: string;
}

function extractDrafts(response: string): ExtractedDraft[] {
  const drafts: ExtractedDraft[] = [];

  const draftRegex = /---DRAFT---\s*([\s\S]*?)\s*---END_DRAFT---/g;
  let match;

  while ((match = draftRegex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.body) {
        drafts.push(parsed);
      }
    } catch {
      // skip malformed drafts
    }
  }

  return drafts;
}

function generateFallbackResponse(
  content: string,
  connectedPlatforms: string
): string {
  const lower = content.toLowerCase();

  if (
    lower.includes("create") ||
    lower.includes("write") ||
    lower.includes("draft")
  ) {
    return `I'd be happy to help create content for you! Here's a draft to get started:

---DRAFT---
{"platform":"all","body":"${content.replace(/"/g, '\\"').substring(0, 100)}... [AI-generated content would appear here with a configured LLM provider]","hook_text":"Attention-grabbing opener","cta_text":"Take action today!","hashtags":["social","content","strategy"]}
---END_DRAFT---

To get fully AI-generated content, connect an LLM provider (OpenAI or Anthropic) in Settings > AI Agents.`;
  }

  if (lower.includes("strategy") || lower.includes("plan")) {
    return `Here's a quick content strategy framework:

1. Post consistently (3-5x per week minimum)
2. Mix content types: educational (40%), engaging (30%), promotional (20%), personal (10%)
3. Use the Campaigns tab to automate recurring content themes
4. Review Analytics to find your best posting times

${connectedPlatforms ? `Your connected accounts (${connectedPlatforms}) give you good platform coverage.` : "Connect your social accounts in the Accounts tab to get started."}

Want me to create specific post drafts for any of these categories?`;
  }

  return `I can help you with social media content and strategy! Here are some things I can do:

- Create post drafts for any platform
- Suggest content strategies and themes
- Generate campaign ideas
- Recommend optimal posting times
- Help with hashtags and CTAs

${connectedPlatforms ? `You have these accounts connected: ${connectedPlatforms}` : "Start by connecting your social accounts in the Accounts tab."}

What would you like to work on? Try asking me to "create a post about [your topic]" or "suggest a content strategy for this week."`;
}
