import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateTextToVideo,
  generateTextToImage,
} from "../_shared/kieAdapter.ts";
import { getRequiredAspectRatio } from "../_shared/platformAspectMatrix.ts";
import {
  buildStructuredPrompt,
  buildLLMStyleContext,
} from "../_shared/promptBuilder.ts";
import type { StylePreset } from "../_shared/promptBuilder.ts";

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

    const body: ChatRequest = await req.json();
    const {
      thread_id,
      content,
      message_type = "text",
      attachments = [],
      image_model_id,
      video_model_id,
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
        "tone_preferences, words_to_avoid, hashtag_preferences, platform_tweaks, industry_positioning"
      )
      .eq("organization_id", orgId)
      .limit(5);

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

    const guidelinesSummary = buildGuidelinesSummary(guidelines || []);

    const systemPrompt = `You are an expert AI social media strategist. You help create engaging social media content.

Connected platforms: ${connectedPlatforms || "none yet"}
${guidelinesSummary}
${styleContext}

When the user asks you to create a post, respond with:
1. A brief explanation of your strategy
2. One or more draft posts as JSON in a code block tagged \`\`\`drafts

Each draft should be a JSON array of objects with these fields:
- platform: the target platform (e.g. "instagram", "facebook", "linkedin", "tiktok", "twitter")
- body: the main post text
- hook_text: an attention-grabbing opening line
- cta_text: a call-to-action line
- media_type: "image", "video", or "none"
- visual_style_suggestion: a detailed prompt for generating the media (describe the visual in detail)
- style_preset: name of a style preset to use (optional)
- hashtags: array of hashtag strings

Example:
\`\`\`drafts
[{"platform":"instagram","body":"Check out our latest...","hook_text":"Stop scrolling!","cta_text":"Link in bio","media_type":"image","visual_style_suggestion":"A vibrant flat-lay photo of...","hashtags":["#tech","#innovation"]}]
\`\`\`

Always provide visual_style_suggestion when media_type is "image" or "video".
Keep posts within platform character limits. Use relevant hashtags.
Be creative and engaging. Adapt tone to each platform's audience.`;

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
      .in("provider", ["openai", "anthropic"])
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

    let assistantContent: string | null = null;
    let modelUsed = "";
    let lastError = "";

    for (const provider of providers) {
      try {
        if (provider.provider === "anthropic") {
          const url =
            provider.base_url ||
            "https://api.anthropic.com/v1/messages";
          const model = "claude-sonnet-4-20250514";
          assistantContent = await callAnthropic(
            url,
            provider.api_key_encrypted,
            model,
            messages
          );
          modelUsed = model;
        } else {
          const url =
            provider.base_url ||
            "https://api.openai.com/v1/chat/completions";
          const model = "gpt-4o";
          assistantContent = await callOpenAI(
            url,
            provider.api_key_encrypted,
            model,
            messages
          );
          modelUsed = model;
        }
        break;
      } catch (providerErr) {
        lastError =
          providerErr instanceof Error ? providerErr.message : String(providerErr);
        console.warn(
          `[ai-social-chat] Provider ${provider.provider} failed, trying next:`,
          lastError
        );
      }
    }

    if (assistantContent === null) {
      return json({ error: lastError || "All AI providers failed" }, 500);
    }

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

            if (!model) {
              const { data: anyEnabled } = await supabase
                .from("kie_models")
                .select("*")
                .eq("type", isVideo ? "video" : "image")
                .eq("enabled", true)
                .order("display_priority", { ascending: true })
                .limit(1)
                .maybeSingle();
              model = anyEnabled;
            }

            if (!model) continue;

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
            const finalPrompt = buildStructuredPrompt(rawPrompt, draftPreset);

            const modelKey = model.model_key as string;
            const isVeo = modelKey.startsWith("google/veo-");
            const webhookUrl = `${supabaseUrl}/functions/v1/media-kie-webhook`;
            const endpointOverride =
              (model.api_endpoint_override as string) || null;

            const jobType = isVideo ? "text_to_video" : "text_to_image";

            const supportedDurations = model.supports_durations as
              | number[]
              | null;
            const defaultDuration =
              supportedDurations && supportedDurations.length > 0
                ? supportedDurations[0]
                : 5;

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
                },
                status: "waiting",
                job_type: jobType,
                style_preset_id: draftPreset?.id || null,
              })
              .select("id")
              .single();

            if (jobErr || !job) continue;

            let kieResult;

            if (isVideo) {
              kieResult = await generateTextToVideo(
                kieApiKey,
                {
                  prompt: finalPrompt,
                  aspectRatio: effectiveAspect,
                  duration: defaultDuration,
                  callbackUrl: webhookUrl,
                  model: isVeo ? undefined : modelKey,
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
              await supabase
                .from("media_generation_jobs")
                .update({
                  status: "fail",
                  error_message: kieResult.error || "Kie API error",
                  completed_at: new Date().toISOString(),
                })
                .eq("id", job.id);
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

function buildGuidelinesSummary(
  guidelines: Record<string, unknown>[]
): string {
  if (!guidelines.length) return "";

  const parts: string[] = [];
  for (const g of guidelines) {
    const tone = g.tone_preferences as Record<string, unknown> | null;
    const avoid = g.words_to_avoid as string[] | null;
    const hashtags = g.hashtag_preferences as Record<string, unknown> | null;
    const positioning = g.industry_positioning as string | null;
    const tweaks = g.platform_tweaks as Record<string, unknown> | null;

    if (tone) parts.push(`Tone: ${JSON.stringify(tone)}`);
    if (avoid?.length) parts.push(`Words to avoid: ${avoid.join(", ")}`);
    if (hashtags) parts.push(`Hashtag prefs: ${JSON.stringify(hashtags)}`);
    if (positioning) parts.push(`Industry: ${positioning}`);
    if (tweaks) parts.push(`Platform tweaks: ${JSON.stringify(tweaks)}`);
  }

  return parts.length > 0 ? `\nGuidelines: ${parts.join("; ")}` : "";
}

async function callOpenAI(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[ai-social-chat] OpenAI error:", response.status, errText);
    throw new Error(`AI generation failed (OpenAI ${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemMsg?.content || "",
      messages: chatMessages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[ai-social-chat] Anthropic error:", response.status, errText);
    throw new Error(`AI generation failed (Anthropic ${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}
