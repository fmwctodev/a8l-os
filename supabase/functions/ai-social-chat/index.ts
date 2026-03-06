import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateTextToVideo,
  generateTextToImage,
} from "../_shared/kieAdapter.ts";
import { generateText } from "../_shared/openaiTextClient.ts";
import { getRequiredAspectRatio } from "../_shared/platformAspectMatrix.ts";
import {
  buildStructuredPrompt,
  buildLLMStyleContext,
} from "../_shared/promptBuilder.ts";
import type { StylePreset } from "../_shared/promptBuilder.ts";

const BLOCKED_MODEL_FIELDS = ["model", "llm_model", "text_model", "model_key", "model_id"];

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
  video_model_id?: string;
  video_mode?: string;
  aspect_ratio?: string;
  auto_generate_media?: boolean;
  style_preset_id?: string;
}

interface DraftOutput {
  platform: string;
  body: string;
  hook_text?: string;
  cta_text?: string;
  media_type?: string;
  visual_style_suggestion?: string;
  style_preset?: string;
  hashtags?: string[];
  multi_prompt?: Array<{ prompt: string; duration: number }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Authorization required" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Invalid token" }, 401);
    }

    const { data: userData } = await supabase
      .from("users")
      .select("id, organization_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!userData) {
      return json({ error: "User not found" }, 404);
    }

    const orgId = userData.organization_id;

    const rawBody = await req.json();

    const hasBlockedField = BLOCKED_MODEL_FIELDS.some(
      (f) => f in rawBody && f !== "video_model_id"
    );
    if (hasBlockedField) {
      return json({ error: "Text model cannot be overridden." }, 400);
    }

    const body: ChatRequest = rawBody;
    const {
      thread_id,
      content,
      message_type = "text",
      attachments = [],
      video_model_id,
      video_mode,
      aspect_ratio,
      auto_generate_media = true,
      style_preset_id,
    } = body;

    if (!thread_id || !content) {
      return json({ error: "thread_id and content are required" }, 400);
    }

    const { data: thread } = await supabase
      .from("social_ai_threads")
      .select("id, organization_id")
      .eq("id", thread_id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!thread) {
      return json({ error: "Thread not found" }, 404);
    }

    const { data: history } = await supabase
      .from("social_ai_messages")
      .select("role, content, message_type, attachments")
      .eq("thread_id", thread_id)
      .order("created_at", { ascending: true })
      .limit(20);

    const { data: accounts } = await supabase
      .from("social_accounts")
      .select("provider, display_name")
      .eq("organization_id", orgId)
      .eq("status", "connected");

    const { data: guidelines } = await supabase
      .from("social_guidelines")
      .select(
        "content_themes, image_style, writing_style, tone_preferences, words_to_avoid, hashtag_preferences, platform_tweaks, industry_positioning, cta_rules, emoji_rules, visual_style_rules"
      )
      .eq("organization_id", orgId)
      .is("user_id", null)
      .maybeSingle();

    const { data: stylePresets } = await supabase
      .from("media_style_presets")
      .select("*")
      .eq("enabled", true)
      .order("display_priority", { ascending: true });

    let selectedPreset: StylePreset | null = null;
    if (style_preset_id) {
      selectedPreset =
        (stylePresets || []).find(
          (p: StylePreset) => p.id === style_preset_id
        ) || null;
    }

    const styleContext = buildLLMStyleContext(stylePresets || []);

    const connectedPlatforms = (accounts || [])
      .map(
        (a: Record<string, unknown>) =>
          `${a.provider} (${a.display_name || "unnamed"})`
      )
      .join(", ");

    const guidelinesSummary = buildGuidelinesSummary(guidelines);

    const systemPrompt = `You are an expert AI social media strategist. You help create engaging social media content.

Connected platforms: ${connectedPlatforms || "none yet"}
${guidelinesSummary}
${styleContext}

IMPORTANT: If brand guidelines are provided above, you MUST strictly follow them for ALL content you create. Specifically:
- Match the tone preferences (formality, friendliness, energy, confidence levels)
- Never use any words listed in "Words to Avoid"
- Follow the writing style and content theme directions exactly
- Use only preferred hashtags when available; never use banned hashtags
- Follow CTA rules for calls-to-action in every post
- Respect the emoji usage frequency setting (none/minimal/moderate/heavy) and never use banned emojis
- Apply visual style rules and image style guidelines to all visual_style_suggestion prompts
- Follow platform-specific instructions when creating content for that platform
- Reflect the industry positioning in the voice and framing of all content

When the user asks you to create a post, respond with:
1. A brief explanation of your strategy
2. One or more draft posts as JSON in a code block tagged \`\`\`drafts

Each draft should be a JSON array of objects with these fields:
- platform: the target platform (e.g. "instagram", "facebook", "linkedin", "tiktok", "twitter")
- body: the main post text
- hook_text: an attention-grabbing opening line
- cta_text: a call-to-action line
- media_type: "image", "video", or "none"
- visual_style_suggestion: a detailed prompt for generating the media (describe the visual in detail, incorporating any image style and visual style rules from the guidelines)
- style_preset: name of a style preset to use (optional)
- hashtags: array of hashtag strings

Example:
\`\`\`drafts
[{"platform":"instagram","body":"Check out our latest...","hook_text":"Stop scrolling!","cta_text":"Link in bio","media_type":"image","visual_style_suggestion":"A vibrant flat-lay photo of...","hashtags":["#tech","#innovation"]}]
\`\`\`

Always provide visual_style_suggestion when media_type is "image" or "video".
Keep posts within platform character limits. Use relevant hashtags.
Be creative and engaging. Adapt tone to each platform's audience.
For image generation, the model is always Nano Banana 2. Do not suggest, recommend, or reference any other image generation model.

MULTI-SHOT VIDEO: When a user requests a video with multiple scenes or shots, you can provide a "multi_prompt" array in the draft object. Each entry has a "prompt" (max 2500 chars) describing that scene and a "duration" (seconds, typically 5). Example:
\`\`\`drafts
[{"platform":"instagram","body":"...","media_type":"video","visual_style_suggestion":"A cinematic brand story","multi_prompt":[{"prompt":"Scene 1: Product close-up on marble surface, soft lighting","duration":5},{"prompt":"Scene 2: Person unboxing the product, excited expression","duration":5}],"hashtags":["#brand"]}]
\`\`\`
Only use multi_prompt when the user explicitly asks for multi-scene or multi-shot videos. For single-scene videos, omit multi_prompt entirely.`;

    const rawHistory = (history || []).map((m: Record<string, unknown>) => ({
      role: m.role as string,
      content: m.content as string,
    }));

    const mergedHistory: Array<{ role: string; content: string }> = [];
    for (const msg of rawHistory) {
      const prev = mergedHistory[mergedHistory.length - 1];
      if (prev && prev.role === msg.role) {
        prev.content += "\n\n" + msg.content;
      } else {
        mergedHistory.push({ ...msg });
      }
    }

    if (mergedHistory.length > 0 && mergedHistory[0].role !== "user") {
      mergedHistory.shift();
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...mergedHistory,
    ];

    const { data: llmProviders } = await supabase
      .from("llm_providers")
      .select("provider, api_key_encrypted, base_url")
      .eq("org_id", orgId)
      .eq("enabled", true)
      .in("provider", ["openai"])
      .order("created_at", { ascending: true });

    const providers = (llmProviders || []).filter(
      (p: Record<string, unknown>) => p.api_key_encrypted
    );

    if (providers.length === 0 && !openaiKey) {
      return json({ error: "No AI API key configured" }, 500);
    }

    if (providers.length === 0 && openaiKey) {
      providers.push({
        provider: "openai",
        api_key_encrypted: openaiKey,
        base_url: null,
      });
    }

    const provider = providers[0];
    const apiUrl =
      provider.base_url || "https://api.openai.com/v1/chat/completions";

    const textResult = await generateText(
      apiUrl,
      provider.api_key_encrypted,
      messages
    );
    const assistantContent = textResult.content;
    const modelUsed = textResult.model;

    let drafts: DraftOutput[] = [];
    const draftMatch = assistantContent.match(
      /```drafts\s*\n?([\s\S]*?)\n?```/
    );
    if (draftMatch) {
      try {
        drafts = JSON.parse(draftMatch[1]);
      } catch {
        console.warn("[ai-social-chat] Failed to parse drafts JSON");
      }
    }

    const cleanContent = assistantContent.replace(
      /```drafts\s*\n?[\s\S]*?\n?```/g,
      ""
    ).trim();

    const mediaJobs: Record<string, unknown>[] = [];
    let mediaSkippedReason: string | null = null;

    // --- Model Routing Rules (immutable) ---
    // TEXT:  OpenAI gpt-5.1 via openaiTextClient.ts -- locked, no override
    // IMAGE: Kie.ai nano-banana-2 -- locked, enforced here + kieAdapter.ts
    // VIDEO: Kie.ai with user-selected video model from kie_models table
    if (auto_generate_media) {
      const kieApiKey = Deno.env.get("KIE_API_KEY");
      const mediaDrafts = drafts.filter(
        (d) =>
          d.media_type &&
          d.media_type !== "none" &&
          d.visual_style_suggestion
      );

      if (!kieApiKey && mediaDrafts.length > 0) {
        mediaSkippedReason = "KIE_API_KEY not configured";
      }

      if (kieApiKey && mediaDrafts.length > 0) {
        for (let i = 0; i < mediaDrafts.length; i++) {
          const draft = mediaDrafts[i];
          const draftIndex = drafts.indexOf(draft);
          const isVideo = draft.media_type === "video";

          try {
            let model: Record<string, unknown> | null = null;

            if (isVideo) {
              if (video_model_id) {
                const { data: preferred } = await supabase
                  .from("kie_models")
                  .select("*")
                  .eq("id", video_model_id)
                  .eq("enabled", true)
                  .maybeSingle();
                model = preferred;
              }

              if (!model) {
                const { data: recommended } = await supabase
                  .from("kie_models")
                  .select("*")
                  .eq("type", "video")
                  .eq("enabled", true)
                  .eq("is_recommended", true)
                  .order("display_priority", { ascending: true })
                  .limit(1)
                  .maybeSingle();
                model = recommended;
              }

              if (!model) {
                const { data: anyEnabled } = await supabase
                  .from("kie_models")
                  .select("*")
                  .eq("type", "video")
                  .eq("enabled", true)
                  .order("display_priority", { ascending: true })
                  .limit(1)
                  .maybeSingle();
                model = anyEnabled;
              }
            } else {
              const { data: nb2 } = await supabase
                .from("kie_models")
                .select("*")
                .eq("model_key", "nano-banana-2")
                .eq("enabled", true)
                .maybeSingle();
              model = nb2;
            }

            if (!model) continue;

            if (!isVideo && (model.model_key as string) !== "nano-banana-2") {
              console.warn(
                `[ai-social-chat] Image model override blocked: resolved "${model.model_key}", forcing nano-banana-2`
              );
              const { data: nb2Override } = await supabase
                .from("kie_models")
                .select("*")
                .eq("model_key", "nano-banana-2")
                .eq("enabled", true)
                .maybeSingle();
              if (!nb2Override) continue;
              model = nb2Override;
            }

            const effectiveAspect =
              aspect_ratio || getRequiredAspectRatio(draft.platform);

            let draftPreset = selectedPreset;
            if (!draftPreset && draft.style_preset) {
              draftPreset =
                (stylePresets || []).find(
                  (p: StylePreset) => p.name === draft.style_preset
                ) || null;
            }

            const rawPrompt = draft.visual_style_suggestion!;
            let enrichedPrompt = rawPrompt;
            if (!isVideo) {
              const imgStyleBlocks = guidelines
                ? formatBlocks(guidelines.image_style as Array<{ content: string }> | null)
                : "";
              if (imgStyleBlocks) {
                enrichedPrompt = `${enrichedPrompt}\n\nImage style guidelines: ${imgStyleBlocks}`;
              }
              const vsRules = guidelines?.visual_style_rules as string[] | null;
              if (vsRules?.length) {
                enrichedPrompt = `${enrichedPrompt}\n\nVisual style rules: ${vsRules.join(", ")}`;
              }
            }
            const finalPrompt = buildStructuredPrompt(enrichedPrompt, draftPreset);

            const modelKey = model.model_key as string;
            const isVeo = modelKey.startsWith("google/veo-");
            const webhookSecret = Deno.env.get("KIE_WEBHOOK_SECRET");
            const webhookUrl = webhookSecret
              ? `${supabaseUrl}/functions/v1/media-kie-webhook?token=${encodeURIComponent(webhookSecret)}`
              : `${supabaseUrl}/functions/v1/media-kie-webhook`;
            const endpointOverride =
              (model.api_endpoint_override as string) || null;

            const jobType = isVideo ? "text_to_video" : "text_to_image";

            const modelDefaults = (model.default_params as Record<string, unknown>) || {};
            const supportedDurations = model.supports_durations as
              | number[]
              | null;
            const defaultDuration =
              (modelDefaults.duration as number) ||
              (supportedDurations && supportedDurations.length > 0
                ? supportedDurations[0]
                : 5);

            const effectiveMode = video_mode || (modelDefaults.mode as string) || undefined;

            const { data: job, error: jobErr } = await supabase
              .from("media_generation_jobs")
              .insert({
                organization_id: orgId,
                created_by: user.id,
                model_id: model.id,
                prompt: finalPrompt,
                params: {
                  aspect_ratio: effectiveAspect,
                  ...(isVideo ? { duration: defaultDuration } : {}),
                  ...(effectiveMode ? { mode: effectiveMode } : {}),
                  ...(hasMultiShot ? { multi_prompt: draft.multi_prompt } : {}),
                },
                status: "waiting",
                job_type: jobType,
                style_preset_id: draftPreset?.id || null,
              })
              .select("id")
              .single();

            if (jobErr || !job) continue;

            let kieResult;

            let veoModelParam: string | undefined;
            if (isVeo) {
              veoModelParam = modelKey === "google/veo-3.1" ? "veo3" : "veo3_fast";
            }

            const hasMultiShot = isVideo && draft.multi_prompt && draft.multi_prompt.length > 0;

            if (isVideo) {
              kieResult = await generateTextToVideo(
                kieApiKey,
                {
                  prompt: finalPrompt,
                  aspectRatio: effectiveAspect,
                  duration: defaultDuration,
                  callbackUrl: webhookUrl,
                  model: isVeo ? veoModelParam : modelKey,
                  mode: effectiveMode,
                  multiShots: hasMultiShot || undefined,
                  multiPrompt: hasMultiShot ? draft.multi_prompt : undefined,
                },
                isVeo
                  ? endpointOverride || undefined
                  : undefined
              );
            } else {
              const supportsRes = model.supports_resolutions as string[] | null;
              const defaultRes =
                supportsRes && supportsRes.length > 0
                  ? supportsRes[0]
                  : undefined;

              kieResult = await generateTextToImage(kieApiKey, {
                modelKey,
                prompt: finalPrompt,
                aspectRatio: effectiveAspect,
                resolution: defaultRes,
                callbackUrl: webhookUrl,
                endpointOverride: endpointOverride || undefined,
              });
            }

            if (kieResult.success && kieResult.taskId) {
              await supabase
                .from("media_generation_jobs")
                .update({
                  kie_task_id: kieResult.taskId,
                  status: "queuing",
                })
                .eq("id", job.id);

              mediaJobs.push({
                job_id: job.id,
                model_id: model.id as string,
                model_name: model.display_name as string,
                media_type: draft.media_type!,
                prompt: finalPrompt,
                status: "queuing",
                draft_index: draftIndex,
              });
            } else {
              const errMsg = kieResult.error || "Kie API error";
              await supabase
                .from("media_generation_jobs")
                .update({
                  status: "fail",
                  error_message: errMsg,
                  completed_at: new Date().toISOString(),
                })
                .eq("id", job.id);

              mediaJobs.push({
                job_id: job.id,
                model_id: model.id as string,
                model_name: model.display_name as string,
                media_type: draft.media_type!,
                prompt: finalPrompt,
                status: "fail",
                draft_index: draftIndex,
                error: errMsg,
              });
            }
          } catch (mediaErr) {
            console.error(
              "[ai-social-chat] Media generation error for draft:",
              mediaErr
            );
          }
        }
      }
    }

    return json({
      response: cleanContent,
      drafts,
      media_jobs: mediaJobs,
      media_skipped_reason: mediaSkippedReason,
      model_used: modelUsed,
    });
  } catch (err) {
    console.error("[ai-social-chat] Error:", err);
    return json(
      {
        error: err instanceof Error ? err.message : "Unexpected error",
      },
      500
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatBlocks(
  blocks: Array<{ content: string }> | null | undefined
): string {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return "";
  return blocks
    .map((b) => stripHtml(b.content || ""))
    .filter((t) => t.length > 0)
    .join("\n\n");
}

function buildGuidelinesSummary(
  g: Record<string, unknown> | null
): string {
  if (!g) return "";

  const sections: string[] = [];

  const contentThemes = formatBlocks(
    g.content_themes as Array<{ content: string }> | null
  );
  const imageStyleBlocks = formatBlocks(
    g.image_style as Array<{ content: string }> | null
  );
  const writingStyleBlocks = formatBlocks(
    g.writing_style as Array<{ content: string }> | null
  );

  if (contentThemes) {
    sections.push(`Content Themes:\n${contentThemes}`);
  }
  if (imageStyleBlocks) {
    sections.push(`Image Style Guidelines:\n${imageStyleBlocks}`);
  }
  if (writingStyleBlocks) {
    sections.push(`Writing Style Guidelines:\n${writingStyleBlocks}`);
  }

  const tone = g.tone_preferences as Record<string, unknown> | null;
  const avoid = g.words_to_avoid as string[] | null;
  const hashtags = g.hashtag_preferences as Record<string, unknown> | null;
  const positioning = g.industry_positioning as string | null;
  const tweaks = g.platform_tweaks as Record<string, unknown> | null;
  const ctaRules = g.cta_rules as string[] | null;
  const emojiRules = g.emoji_rules as Record<string, unknown> | null;
  const visualStyleRules = g.visual_style_rules as string[] | null;

  if (tone) {
    const labels: Record<string, [string, string]> = {
      formality: ["Casual", "Formal"],
      friendliness: ["Reserved", "Warm"],
      energy: ["Calm", "Energetic"],
      confidence: ["Humble", "Confident"],
    };
    const toneLines = Object.entries(tone)
      .filter(([k]) => labels[k])
      .map(([k, v]) => {
        const [low, high] = labels[k];
        return `  ${low} ←${v}→ ${high} (${v}/100)`;
      });
    if (toneLines.length > 0) {
      sections.push(`Tone Preferences:\n${toneLines.join("\n")}`);
    }
  }
  if (avoid?.length) sections.push(`Words to Avoid (NEVER use these): ${avoid.join(", ")}`);
  if (hashtags) {
    const preferred = (hashtags.preferred as string[]) || [];
    const banned = (hashtags.banned as string[]) || [];
    const parts: string[] = [];
    if (preferred.length) parts.push(`Preferred: ${preferred.join(", ")}`);
    if (banned.length) parts.push(`Banned (never use): ${banned.join(", ")}`);
    if (parts.length) sections.push(`Hashtag Rules:\n${parts.join("\n")}`);
  }
  if (positioning) sections.push(`Industry Positioning:\n${positioning}`);
  if (tweaks && Object.keys(tweaks).length > 0) {
    const tweakLines = Object.entries(tweaks)
      .filter(([, v]) => typeof v === "string" && (v as string).trim())
      .map(([platform, instructions]) => `  ${platform}: ${instructions}`);
    if (tweakLines.length > 0) {
      sections.push(`Platform-Specific Instructions:\n${tweakLines.join("\n")}`);
    }
  }
  if (ctaRules?.length) {
    sections.push(`Call-to-Action Rules:\n${ctaRules.map((r) => `- ${r}`).join("\n")}`);
  }
  if (emojiRules) {
    const freq = emojiRules.frequency as string || "minimal";
    const banned = (emojiRules.banned as string[]) || [];
    let emojiLine = `Emoji Usage: ${freq}`;
    if (banned.length) emojiLine += ` | Banned emojis: ${banned.join(" ")}`;
    sections.push(emojiLine);
  }
  if (visualStyleRules?.length) {
    sections.push(`Visual Style Rules:\n${visualStyleRules.map((r) => `- ${r}`).join("\n")}`);
  }

  return sections.length > 0
    ? `\n--- BRAND GUIDELINES (You MUST follow these when creating any content) ---\n${sections.join("\n\n")}\n--- END GUIDELINES ---`
    : "";
}


