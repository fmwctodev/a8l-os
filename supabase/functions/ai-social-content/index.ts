import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTextViaKie } from "../_shared/kieTextClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type SocialAIActionType =
  | 'improve_engagement'
  | 'shorten'
  | 'rewrite_tone'
  | 'make_promotional'
  | 'add_cta'
  | 'optimize_hashtags'
  | 'localize'
  | 'generate_new'
  | 'repurpose';

type AIToneOption = 'brandboard_default' | 'friendly' | 'professional' | 'casual' | 'bold';
type AIContentLength = 'short' | 'medium' | 'long';
type AIGenerateObjective = 'promote_offer' | 'announce_update' | 'educational' | 'engagement' | 'testimonial';
type AIRepurposeAction = 'shorten_post' | 'carousel_captions' | 'proposal_highlights';

interface RequestPayload {
  action: 'quick_suggestion' | 'generate_new' | 'repurpose' | 'generate_hashtags' | 'generate_cta';
  content?: string;
  action_type?: SocialAIActionType;
  platform?: string;
  platforms?: string[];
  post_id?: string;
  brand_kit_id?: string;
  brand_voice_id?: string;
  location_context?: string;
  tone_override?: AIToneOption;
  objective?: AIGenerateObjective;
  tone?: AIToneOption;
  length?: AIContentLength;
  custom_prompt?: string;
  source_type?: string;
  source_content?: string;
  repurpose_action?: AIRepurposeAction;
  target_platform?: string;
  count?: number;
  include_trending?: boolean;
  include_niche?: boolean;
  include_brand?: boolean;
}

interface BrandVoiceSettings {
  tone_settings: {
    formality: number;
    friendliness: number;
    energy: number;
    confidence: number;
  };
  dos: string[];
  donts: string[];
  vocabulary_preferred: string[];
  vocabulary_prohibited: string[];
  ai_system_prompt: string | null;
}

const PLATFORM_CHARACTER_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  twitter: 280,
  google_business: 1500,
  all: 2200,
};

const PLATFORM_HASHTAG_MAX: Record<string, number> = {
  facebook: 3,
  instagram: 30,
  linkedin: 5,
  tiktok: 5,
  youtube: 15,
  google_business: 0,
  all: 5,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData?.organization_id) {
      return new Response(JSON.stringify({ error: "User not associated with an organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = userData.organization_id;
    const body: RequestPayload = await req.json();
    const { action } = body;

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

    let brandVoiceSettings: BrandVoiceSettings | null = null;
    if (body.brand_voice_id || body.tone === 'brandboard_default') {
      brandVoiceSettings = await getBrandVoiceSettings(supabase, orgId, body.brand_voice_id);
    }

    let result: unknown;

    switch (action) {
      case 'quick_suggestion':
        result = await handleQuickSuggestion(
          supabase,
          providerConfig,
          brandVoiceSettings,
          orgId,
          user.id,
          body
        );
        break;

      case 'generate_new':
        result = await handleGenerateNew(
          supabase,
          providerConfig,
          brandVoiceSettings,
          orgId,
          user.id,
          body
        );
        break;

      case 'repurpose':
        result = await handleRepurpose(
          supabase,
          providerConfig,
          brandVoiceSettings,
          orgId,
          user.id,
          body
        );
        break;

      case 'generate_hashtags':
        result = await handleGenerateHashtags(
          supabase,
          providerConfig,
          orgId,
          user.id,
          body
        );
        break;

      case 'generate_cta':
        result = await handleGenerateCTA(
          supabase,
          providerConfig,
          orgId,
          user.id,
          body
        );
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI social content error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getBrandVoiceSettings(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  brandVoiceId?: string
): Promise<BrandVoiceSettings | null> {
  let voiceQuery = supabase.from("brand_voices").select("id");

  if (brandVoiceId) {
    voiceQuery = voiceQuery.eq("id", brandVoiceId);
  } else {
    voiceQuery = voiceQuery.eq("org_id", orgId).eq("active", true).is("archived_at", null);
  }

  const { data: voice } = await voiceQuery.maybeSingle();
  if (!voice) return null;

  const { data: version } = await supabase
    .from("brand_voice_versions")
    .select("tone_settings, dos, donts, vocabulary_preferred, vocabulary_prohibited, ai_system_prompt")
    .eq("brand_voice_id", voice.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!version) return null;

  return {
    tone_settings: version.tone_settings || { formality: 50, friendliness: 50, energy: 50, confidence: 50 },
    dos: version.dos || [],
    donts: version.donts || [],
    vocabulary_preferred: version.vocabulary_preferred || [],
    vocabulary_prohibited: version.vocabulary_prohibited || [],
    ai_system_prompt: version.ai_system_prompt,
  };
}

async function handleQuickSuggestion(
  supabase: ReturnType<typeof createClient>,
  providerConfig: { provider: string; api_key_encrypted: string } | null,
  brandVoiceSettings: BrandVoiceSettings | null,
  orgId: string,
  userId: string,
  body: RequestPayload
) {
  const { content, action_type, platform = 'all', post_id, location_context, tone_override } = body;

  if (!content?.trim()) {
    throw new Error("Content is required");
  }
  if (!action_type) {
    throw new Error("Action type is required");
  }

  const charLimit = PLATFORM_CHARACTER_LIMITS[platform] || 2200;
  const systemPrompt = buildQuickSuggestionPrompt(
    action_type,
    platform,
    charLimit,
    brandVoiceSettings,
    location_context,
    tone_override
  );

  let suggested: string;

  if (providerConfig?.api_key_encrypted) {
    suggested = await callLLM(providerConfig, systemPrompt, content);
  } else {
    suggested = generateFallbackSuggestion(content, action_type, charLimit);
  }

  const { data: metadata } = await supabase
    .from("social_post_ai_metadata")
    .insert({
      post_id: post_id || null,
      organization_id: orgId,
      user_id: userId,
      platform,
      action_type,
      model_used: providerConfig?.provider || "fallback",
      brand_voice_id: body.brand_voice_id || null,
      input_content: content,
      input_length: content.length,
      output_content: suggested,
      output_length: suggested.length,
      tokens_used: 0,
      generation_params: { tone_override, location_context },
      applied: false,
    })
    .select("id")
    .single();

  return {
    original: content,
    suggested,
    action_type,
    character_count_original: content.length,
    character_count_suggested: suggested.length,
    metadata_id: metadata?.id,
  };
}

async function handleGenerateNew(
  supabase: ReturnType<typeof createClient>,
  providerConfig: { provider: string; api_key_encrypted: string } | null,
  brandVoiceSettings: BrandVoiceSettings | null,
  orgId: string,
  userId: string,
  body: RequestPayload
) {
  const { objective, tone, length, platforms = [], custom_prompt, post_id } = body;

  if (!objective) throw new Error("Objective is required");
  if (!tone) throw new Error("Tone is required");
  if (!length) throw new Error("Length is required");

  const minCharLimit = platforms.length > 0
    ? Math.min(...platforms.map(p => PLATFORM_CHARACTER_LIMITS[p] || 2200))
    : 2200;

  const lengthRange = getLengthRange(length, minCharLimit);
  const systemPrompt = buildGenerateNewPrompt(
    objective,
    tone,
    lengthRange,
    platforms,
    brandVoiceSettings
  );

  const userPrompt = custom_prompt || `Create 3 social media post variations for the objective: ${objective}`;

  let variations: { content: string; character_count: number }[];

  if (providerConfig?.api_key_encrypted) {
    const response = await callLLM(providerConfig, systemPrompt, userPrompt);
    variations = parseVariations(response);
  } else {
    variations = generateFallbackVariations(objective, tone, lengthRange);
  }

  const { data: metadata } = await supabase
    .from("social_post_ai_metadata")
    .insert({
      post_id: post_id || null,
      organization_id: orgId,
      user_id: userId,
      platform: platforms[0] || 'all',
      action_type: 'generate_new',
      model_used: providerConfig?.provider || "fallback",
      brand_voice_id: body.brand_voice_id || null,
      input_content: custom_prompt || null,
      input_length: custom_prompt?.length || 0,
      output_content: variations.map(v => v.content).join('\n---\n'),
      output_length: variations.reduce((sum, v) => sum + v.character_count, 0),
      tokens_used: 0,
      generation_params: { objective, tone, length, platforms },
      applied: false,
    })
    .select("id")
    .single();

  return {
    variations,
    objective,
    tone,
    metadata_id: metadata?.id,
  };
}

async function handleRepurpose(
  supabase: ReturnType<typeof createClient>,
  providerConfig: { provider: string; api_key_encrypted: string } | null,
  brandVoiceSettings: BrandVoiceSettings | null,
  orgId: string,
  userId: string,
  body: RequestPayload
) {
  const { source_content, repurpose_action, target_platform = 'all', post_id } = body;

  if (!source_content?.trim()) throw new Error("Source content is required");
  if (!repurpose_action) throw new Error("Repurpose action is required");

  const charLimit = PLATFORM_CHARACTER_LIMITS[target_platform] || 2200;
  const systemPrompt = buildRepurposePrompt(repurpose_action, target_platform, charLimit, brandVoiceSettings);

  let result: { content: string; slides?: string[] };

  if (providerConfig?.api_key_encrypted) {
    const response = await callLLM(providerConfig, systemPrompt, source_content);
    result = parseRepurposeResult(response, repurpose_action);
  } else {
    result = generateFallbackRepurpose(source_content, repurpose_action, charLimit);
  }

  const { data: metadata } = await supabase
    .from("social_post_ai_metadata")
    .insert({
      post_id: post_id || null,
      organization_id: orgId,
      user_id: userId,
      platform: target_platform,
      action_type: 'repurpose',
      model_used: providerConfig?.provider || "fallback",
      brand_voice_id: body.brand_voice_id || null,
      input_content: source_content,
      input_length: source_content.length,
      output_content: result.slides ? result.slides.join('\n---\n') : result.content,
      output_length: result.content.length,
      tokens_used: 0,
      generation_params: { repurpose_action, target_platform },
      applied: false,
    })
    .select("id")
    .single();

  return {
    ...result,
    character_count: result.content.length,
    metadata_id: metadata?.id,
  };
}

async function handleGenerateHashtags(
  supabase: ReturnType<typeof createClient>,
  providerConfig: { provider: string; api_key_encrypted: string } | null,
  orgId: string,
  userId: string,
  body: RequestPayload
) {
  const { content, platform = 'all', count = 10, include_trending = true, include_niche = true, include_brand = true } = body;

  if (!content?.trim()) throw new Error("Content is required");

  const maxHashtags = Math.min(count, PLATFORM_HASHTAG_MAX[platform] || 5);
  const systemPrompt = buildHashtagPrompt(platform, maxHashtags, include_trending, include_niche, include_brand);

  let hashtags: { text: string; category: string; platform_appropriate: string[] }[];

  if (providerConfig?.api_key_encrypted) {
    const response = await callLLM(providerConfig, systemPrompt, content);
    hashtags = parseHashtags(response, platform);
  } else {
    hashtags = generateFallbackHashtags(content, platform, maxHashtags);
  }

  return { hashtags };
}

async function handleGenerateCTA(
  supabase: ReturnType<typeof createClient>,
  providerConfig: { provider: string; api_key_encrypted: string } | null,
  orgId: string,
  userId: string,
  body: RequestPayload
) {
  const { content, objective, platform = 'all', count = 5 } = body;

  if (!content?.trim()) throw new Error("Content is required");

  const systemPrompt = buildCTAPrompt(platform, objective, count);

  let ctas: { text: string; context: string; platform_appropriate: string[] }[];

  if (providerConfig?.api_key_encrypted) {
    const response = await callLLM(providerConfig, systemPrompt, content);
    ctas = parseCTAs(response, platform);
  } else {
    ctas = generateFallbackCTAs(content, platform, count);
  }

  return { ctas };
}

async function callLLM(
  providerConfig: { provider: string; api_key_encrypted: string; base_url?: string },
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const kieApiKey = Deno.env.get("KIE_API_KEY") || "";
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    const textResult = await generateTextViaKie(kieApiKey, messages);
    return textResult.content;
  } catch (err) {
    console.error("[ai-social-content] Kie.ai LLM Error:", err);
    throw err;
  }
}

function buildQuickSuggestionPrompt(
  actionType: SocialAIActionType,
  platform: string,
  charLimit: number,
  brandVoice: BrandVoiceSettings | null,
  locationContext?: string,
  toneOverride?: AIToneOption
): string {
  const actionInstructions: Record<SocialAIActionType, string> = {
    improve_engagement: "Rewrite this content to maximize engagement (likes, comments, shares). Add hooks, questions, or calls to action that encourage interaction.",
    shorten: `Condense this content while preserving the key message. Target ${Math.min(charLimit, 150)} characters or less.`,
    rewrite_tone: `Rewrite this content with a ${toneOverride || 'professional'} tone while keeping the same message.`,
    make_promotional: "Transform this content into a compelling promotional post that drives action without being overly salesy.",
    add_cta: "Add a strong, platform-appropriate call-to-action that encourages the reader to take the next step.",
    optimize_hashtags: "Optimize the hashtags for maximum reach and relevance. Replace or add hashtags as needed.",
    localize: `Adapt this content for a ${locationContext || 'local'} audience. Include relevant local references or terminology.`,
    generate_new: "Generate new content based on the given prompt.",
    repurpose: "Repurpose this content for a different format or platform.",
  };

  let prompt = `You are a social media content expert specializing in ${platform} content.

Task: ${actionInstructions[actionType]}

Requirements:
- Maximum ${charLimit} characters
- Optimized for ${platform}
- Return ONLY the rewritten content, no explanations`;

  if (brandVoice) {
    prompt += `\n\nBrand Voice Guidelines:`;
    if (brandVoice.ai_system_prompt) {
      prompt += `\n${brandVoice.ai_system_prompt}`;
    } else {
      const { tone_settings } = brandVoice;
      prompt += `\n- Formality: ${tone_settings.formality > 60 ? 'formal' : tone_settings.formality < 40 ? 'casual' : 'balanced'}`;
      prompt += `\n- Friendliness: ${tone_settings.friendliness > 60 ? 'warm' : tone_settings.friendliness < 40 ? 'direct' : 'approachable'}`;
      if (brandVoice.dos.length > 0) prompt += `\nDo: ${brandVoice.dos.slice(0, 3).join(', ')}`;
      if (brandVoice.donts.length > 0) prompt += `\nDon't: ${brandVoice.donts.slice(0, 3).join(', ')}`;
    }
  }

  return prompt;
}

function buildGenerateNewPrompt(
  objective: AIGenerateObjective,
  tone: AIToneOption,
  lengthRange: { min: number; max: number },
  platforms: string[],
  brandVoice: BrandVoiceSettings | null
): string {
  const objectiveGuide: Record<AIGenerateObjective, string> = {
    promote_offer: "Create compelling promotional content that highlights the value proposition and drives action.",
    announce_update: "Craft an announcement that generates excitement while clearly communicating the news.",
    educational: "Create informative content that provides value and positions the brand as a thought leader.",
    engagement: "Write content designed to spark conversation, encourage shares, and build community.",
    testimonial: "Transform the given information into an authentic testimonial or success story format.",
  };

  let prompt = `You are a social media content creator.

Objective: ${objectiveGuide[objective]}
Tone: ${tone === 'brandboard_default' ? 'as defined by brand voice' : tone}
Length: ${lengthRange.min}-${lengthRange.max} characters
Target platforms: ${platforms.join(', ') || 'general social media'}

Create exactly 3 unique variations. Format your response as:
1. [First variation]
2. [Second variation]
3. [Third variation]

Each variation should be complete and ready to post.`;

  if (brandVoice && tone === 'brandboard_default') {
    prompt += `\n\nBrand Voice:\n${brandVoice.ai_system_prompt || 'Follow a professional, approachable tone.'}`;
  }

  return prompt;
}

function buildRepurposePrompt(
  action: AIRepurposeAction,
  platform: string,
  charLimit: number,
  brandVoice: BrandVoiceSettings | null
): string {
  const actionGuide: Record<AIRepurposeAction, string> = {
    shorten_post: `Condense this long-form content into a brief, impactful social media post. Maximum ${Math.min(charLimit, 280)} characters.`,
    carousel_captions: "Transform this content into 5 carousel slide captions. Each caption should be 50-100 characters and standalone while being part of a cohesive story. Format as:\nSlide 1: [caption]\nSlide 2: [caption]\netc.",
    proposal_highlights: "Extract the key highlights from this proposal content and format them as an engaging social media post that teases the value proposition.",
  };

  let prompt = `You are a content repurposing expert.

Task: ${actionGuide[action]}
Target platform: ${platform}
Maximum characters: ${charLimit}

Return ONLY the repurposed content in the specified format.`;

  if (brandVoice) {
    prompt += `\n\nMaintain brand voice: ${brandVoice.ai_system_prompt || 'Professional and engaging'}`;
  }

  return prompt;
}

function buildHashtagPrompt(
  platform: string,
  maxHashtags: number,
  includeTrending: boolean,
  includeNiche: boolean,
  includeBrand: boolean
): string {
  const categories = [];
  if (includeTrending) categories.push("trending (widely popular, high reach)");
  if (includeNiche) categories.push("niche (specific to the topic, targeted audience)");
  if (includeBrand) categories.push("brand (industry-specific, professional)");

  return `You are a social media hashtag expert for ${platform}.

Generate ${maxHashtags} relevant hashtags for the given content.

Categories to include: ${categories.join(', ')}

Format your response as JSON array:
[{"text": "#hashtag", "category": "trending|niche|brand"}]

Only return the JSON array, no other text.`;
}

function buildCTAPrompt(platform: string, objective?: AIGenerateObjective, count: number = 5): string {
  return `You are a conversion copywriter specializing in ${platform}.

Generate ${count} compelling call-to-action phrases for the given content.
${objective ? `Objective: ${objective}` : ''}

CTAs should be:
- Action-oriented
- Platform-appropriate for ${platform}
- Varied in style (some urgent, some soft, some social proof-based)

Format as JSON array:
[{"text": "CTA text", "context": "when to use this CTA"}]

Only return the JSON array.`;
}

function getLengthRange(length: AIContentLength, maxLimit: number): { min: number; max: number } {
  switch (length) {
    case 'short':
      return { min: 50, max: Math.min(100, maxLimit) };
    case 'medium':
      return { min: 100, max: Math.min(250, maxLimit) };
    case 'long':
      return { min: 250, max: Math.min(500, maxLimit) };
    default:
      return { min: 100, max: 250 };
  }
}

function parseVariations(content: string): { content: string; character_count: number }[] {
  const lines = content.split('\n').filter(line => line.trim());
  const variations: { content: string; character_count: number }[] = [];

  for (const line of lines) {
    const cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();
    if (cleaned.length > 10) {
      variations.push({ content: cleaned, character_count: cleaned.length });
    }
  }

  return variations.slice(0, 3);
}

function parseRepurposeResult(content: string, action: AIRepurposeAction): { content: string; slides?: string[] } {
  if (action === 'carousel_captions') {
    const slides = content.split(/Slide \d+:/i)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    return { content: slides[0] || content, slides };
  }
  return { content: content.trim() };
}

function parseHashtags(content: string, platform: string): { text: string; category: string; platform_appropriate: string[] }[] {
  try {
    const parsed = JSON.parse(content);
    return parsed.map((h: { text: string; category: string }) => ({
      ...h,
      platform_appropriate: [platform],
    }));
  } catch {
    const matches = content.match(/#\w+/g) || [];
    return matches.map(text => ({
      text,
      category: 'niche',
      platform_appropriate: [platform],
    }));
  }
}

function parseCTAs(content: string, platform: string): { text: string; context: string; platform_appropriate: string[] }[] {
  try {
    const parsed = JSON.parse(content);
    return parsed.map((c: { text: string; context: string }) => ({
      ...c,
      platform_appropriate: [platform],
    }));
  } catch {
    return [{ text: content.trim(), context: 'general', platform_appropriate: [platform] }];
  }
}

function generateFallbackSuggestion(content: string, actionType: SocialAIActionType, charLimit: number): string {
  switch (actionType) {
    case 'shorten':
      return content.length > charLimit ? content.substring(0, charLimit - 3) + '...' : content;
    case 'add_cta':
      return content + '\n\nLearn more - link in bio!';
    case 'optimize_hashtags':
      const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 4).slice(0, 3);
      const tags = words.map(w => `#${w.replace(/[^a-z0-9]/g, '')}`).join(' ');
      return content + '\n\n' + tags;
    default:
      return content;
  }
}

function generateFallbackVariations(
  objective: AIGenerateObjective,
  tone: AIToneOption,
  lengthRange: { min: number; max: number }
): { content: string; character_count: number }[] {
  const templates: Record<AIGenerateObjective, string[]> = {
    promote_offer: [
      "Don't miss out! We have something special for you.",
      "Limited time offer - act now!",
      "Your opportunity awaits. Take action today.",
    ],
    announce_update: [
      "Big news! We're excited to share our latest update.",
      "Something new is here! Check out what we've been working on.",
      "Fresh updates just dropped! See what's new.",
    ],
    educational: [
      "Did you know? Here's an insight that might surprise you.",
      "Let's explore this topic together. Here's what you need to know.",
      "Quick tip: Here's something valuable to keep in mind.",
    ],
    engagement: [
      "We'd love to hear from you! Share your thoughts below.",
      "Question: What's your take on this?",
      "Join the conversation! Tell us what you think.",
    ],
    testimonial: [
      "Here's what our community is saying...",
      "Success story: See how others have benefited.",
      "Real results from real people. Here's their story.",
    ],
  };

  return templates[objective].map(content => ({
    content,
    character_count: content.length,
  }));
}

function generateFallbackRepurpose(
  content: string,
  action: AIRepurposeAction,
  charLimit: number
): { content: string; slides?: string[] } {
  switch (action) {
    case 'shorten_post':
      const shortened = content.substring(0, Math.min(content.length, charLimit - 20)) + '...';
      return { content: shortened };
    case 'carousel_captions':
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10).slice(0, 5);
      return {
        content: sentences[0]?.trim() || content.substring(0, 100),
        slides: sentences.map(s => s.trim()),
      };
    case 'proposal_highlights':
      return { content: `Key highlights: ${content.substring(0, 200)}...` };
    default:
      return { content };
  }
}

function generateFallbackHashtags(
  content: string,
  platform: string,
  count: number
): { text: string; category: string; platform_appropriate: string[] }[] {
  const words = content.toLowerCase().split(/\s+/)
    .filter(w => w.length > 4 && !['this', 'that', 'with', 'from', 'have', 'will'].includes(w));

  const hashtags = words.slice(0, Math.min(count, 5)).map(w => ({
    text: `#${w.replace(/[^a-z0-9]/g, '')}`,
    category: 'niche',
    platform_appropriate: [platform],
  }));

  const generalTags = ['#business', '#growth', '#success'].map(text => ({
    text,
    category: 'trending',
    platform_appropriate: [platform],
  }));

  return [...hashtags, ...generalTags].slice(0, count);
}

function generateFallbackCTAs(
  content: string,
  platform: string,
  count: number
): { text: string; context: string; platform_appropriate: string[] }[] {
  const ctas = [
    { text: 'Learn more - link in bio!', context: 'general' },
    { text: 'Comment below with your thoughts!', context: 'engagement' },
    { text: 'Share with someone who needs this!', context: 'viral' },
    { text: 'Save this for later!', context: 'retention' },
    { text: 'Follow for more content like this!', context: 'growth' },
  ];

  return ctas.slice(0, count).map(cta => ({
    ...cta,
    platform_appropriate: [platform],
  }));
}
