import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateTextToVideo,
  generateImageToVideo,
  generateTextToImage,
} from "../_shared/kieAdapter.ts";
import { getRequiredAspectRatio } from "../_shared/platformAspectMatrix.ts";
import { buildStructuredPrompt, buildLLMStyleContext } from "../_shared/promptBuilder.ts";
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
  content: string;
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
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
      return jsonResponse({ success: false, error: "Authorization required" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ success: false, error: "Invalid token" }, 401);
    }

    const { data: userData } = await supabase
      .from("users")
      .select("id, organization_id, role_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!userData) {
      return jsonResponse({ success: false, error: "User not found" }, 404);
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
      return jsonResponse({ success: false, error: "thread_id and content are required" }, 400);
    }

    const { data: thread } = await supabase
      .from("social_chat_threads")
      .select("id, organization_id")
      .eq("id", thread_id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!thread) {
      return jsonResponse({ success: false, error: "Thread not found" }, 404);
    }

    await supabase.from("social_chat_messages").insert({
      thread_id,
      role: "user",
      content,
      message_type,
      attachments,
    });

    const { data: history } = await supabase
      .from("social_chat_messages")
      .select("role, content, message_type, attachments")
      .eq("thread_id", thread_id)
      .order("created_at", { ascending: true })
      .limit(20);

    const { data: accounts } = await supabase
      .from("social_accounts")
      .select("platform, account_name")
      .eq("organization_id", orgId)
      .eq("status", "connected");

    const { data: guidelines } = await supabase
      .from("social_guidelines")
      .select("platform, tone, topics_to_avoid, hashtag_rules, content_rules")
      .eq("organization_id", orgId)
      .limit(10);

    const { data: stylePresets } = await supabase
      .from("media_style_presets")
      .select("*")
      .eq("enabled", true)
      .order("display_priority", { ascending: true });

    let selectedPreset: StylePreset | null = null;
    if (style_preset_id) {
      selectedPreset = (stylePresets || []).find((p: StylePreset) => p.id === style_preset_id) || null;
    }

    const styleContext = buildLLMStyleContext(stylePresets || []);

    const connectedPlatforms = (accounts || []).map((a: Record<string, unknown>) => a.platform).join(", ");
    const guidelinesSummary = (guidelines || [])
      .map((g: Record<string, unknown>) => `${g.platform}: tone=${g.tone || "professional"}, avoid=${g.topics_to_avoid || "none"}`)
      .join("; ");

    const systemPrompt = `You are an expert AI social media strategist. You help create engaging social media content.

Connected platforms: ${connectedPlatforms || "none yet"}
Guidelines: ${guidelinesSummary || "none set"}
${styleContext}

When the user asks you to create a post, respond with:
1. A brief explanation of your strategy
2. One or more draft posts as JSON in a code block tagged \`\`\`drafts

Each draft should be a JSON array of objects with these fields:
- platform: the target platform
- content: the post text with hashtags
- media_type: "image", "video", or "none"
- visual_style_suggestion: a detailed prompt for generating the media (describe the visual in detail)
- style_preset: name of a style preset to use (optional)
- hashtags: array of hashtag strings

Example:
\`\`\`drafts
[{"platform":"instagram","content":"Check out...","media_type":"image","visual_style_suggestion":"A vibrant flat-lay photo of...","hashtags":["#tech","#innovation"]}]
\`\`\`

Always provide visual_style_suggestion when media_type is "image" or "video".
Keep posts within platform character limits. Use relevant hashtags.
Be creative and engaging. Adapt tone to each platform's audience.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: Record<string, unknown>) => ({
        role: m.role as string,
        content: m.content as string,
      })),
    ];

    const { data: aiSettings } = await supabase
      .from("ai_settings")
      .select("provider, model, api_key_encrypted")
      .eq("organization_id", orgId)
      .eq("feature", "social_chat")
      .maybeSingle();

    let apiKey = openaiKey;
    let model = "gpt-4o";
    let apiUrl = "https://api.openai.com/v1/chat/completions";

    if (aiSettings) {
      if (aiSettings.api_key_encrypted) {
        apiKey = aiSettings.api_key_encrypted;
      }
      if (aiSettings.model) model = aiSettings.model;
      if (aiSettings.provider === "anthropic") {
        apiUrl = "https://api.anthropic.com/v1/messages";
      }
    }

    if (!apiKey) {
      return jsonResponse({ success: false, error: "No AI API key configured" }, 500);
    }

    const llmResponse = await fetch(apiUrl, {
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

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      console.error("[ai-social-chat] LLM error:", errText);
      return jsonResponse({ success: false, error: "AI generation failed" }, 502);
    }

    const llmData = await llmResponse.json();
    const assistantContent = llmData.choices?.[0]?.message?.content || "";

    await supabase.from("social_chat_messages").insert({
      thread_id,
      role: "assistant",
      content: assistantContent,
    });

    let drafts: DraftOutput[] = [];
    const draftMatch = assistantContent.match(/```drafts\s*\n?([\s\S]*?)\n?```/);
    if (draftMatch) {
      try {
        drafts = JSON.parse(draftMatch[1]);
      } catch {
        console.warn("[ai-social-chat] Failed to parse drafts JSON");
      }
    }

    const savedDrafts: Record<string, unknown>[] = [];
    for (const draft of drafts) {
      const { data: saved } = await supabase
        .from("social_post_drafts")
        .insert({
          organization_id: orgId,
          created_by: user.id,
          thread_id,
          platform: draft.platform,
          content: draft.content,
          media_type: draft.media_type || "none",
          visual_style_suggestion: draft.visual_style_suggestion || null,
          hashtags: draft.hashtags || [],
          status: "draft",
        })
        .select()
        .single();
      if (saved) savedDrafts.push(saved);
    }

    const mediaJobs: Record<string, unknown>[] = [];
    let mediaSkippedReason: string | null = null;

    if (auto_generate_media) {
      const kieApiKey = Deno.env.get("KIE_API_KEY");
      if (!kieApiKey) {
        const hasMediaDrafts = drafts.some(
          (d) => d.media_type && d.media_type !== "none" && d.visual_style_suggestion
        );
        if (hasMediaDrafts) {
          mediaSkippedReason = "KIE_API_KEY not configured";
          console.warn("[ai-social-chat] KIE_API_KEY missing – skipping media generation");
        }
      }
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

            const effectiveAspect = aspect_ratio || getRequiredAspectRatio(draft.platform);

            let draftPreset = selectedPreset;
            if (!draftPreset && draft.style_preset) {
              draftPreset = (stylePresets || []).find((p: StylePreset) => p.name === draft.style_preset) || null;
            }

            const rawPrompt = draft.visual_style_suggestion!;
            const finalPrompt = buildStructuredPrompt(rawPrompt, draftPreset);

            const modelKey = model.model_key as string;
            const isVeo = modelKey.startsWith("google/veo-");
            const webhookUrl = `${supabaseUrl}/functions/v1/media-kie-webhook`;
            const endpointOverride = model.api_endpoint_override as string | null;

            const jobType = isVideo ? "text_to_video" : "text_to_image";

            const { data: job, error: jobErr } = await supabase
              .from("media_generation_jobs")
              .insert({
                organization_id: orgId,
                created_by: user.id,
                model_id: model.id,
                prompt: finalPrompt,
                params: {
                  aspect_ratio: effectiveAspect,
                  ...(isVideo ? { duration: (model as Record<string, unknown>).supports_durations?.[0] || 5 } : {}),
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
                  duration: (model as Record<string, unknown>).supports_durations?.[0] as number || 8,
                  callbackUrl: webhookUrl,
                  model: isVeo ? undefined : modelKey,
                },
                isVeo ? (endpointOverride || undefined) : undefined
              );
            } else {
              kieResult = await generateTextToImage(kieApiKey, {
                modelKey,
                prompt: finalPrompt,
                aspectRatio: effectiveAspect,
                callbackUrl: webhookUrl,
                endpointOverride: endpointOverride || undefined,
              });
            }

            if (kieResult.success && kieResult.taskId) {
              await supabase
                .from("media_generation_jobs")
                .update({ kie_task_id: kieResult.taskId, status: "queuing" })
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
            console.error("Media generation error for draft:", mediaErr);
          }
        }
      }
    }

    return jsonResponse({
      success: true,
      data: {
        message: assistantContent,
        drafts: savedDrafts,
        media_jobs: mediaJobs,
        media_skipped_reason: mediaSkippedReason,
      },
    });
  } catch (err) {
    console.error("[ai-social-chat] Error:", err);
    return jsonResponse(
      { success: false, error: err instanceof Error ? err.message : "Unexpected error" },
      500
    );
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
