import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CampaignGenerateRequest {
  campaign_id: string;
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
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return new Response(
        JSON.stringify({ error: "User not associated with an organization" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const orgId = userData.organization_id;
    const body: CampaignGenerateRequest = await req.json();
    const { campaign_id } = body;

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: campaign } = await supabase
      .from("social_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: accounts } = await supabase
      .from("social_accounts")
      .select("id, provider, display_name")
      .eq("organization_id", orgId)
      .eq("status", "connected")
      .in("provider", campaign.platforms || []);

    const { data: providerConfig } = await supabase
      .from("llm_providers")
      .select("*")
      .eq("organization_id", orgId)
      .eq("is_enabled", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const postCount = getPostCount(campaign.frequency);
    const accountTargets = (accounts || []).map((a) => a.id);

    let posts: Array<{
      body: string;
      hook_text: string;
      cta_text: string;
      hashtags: string[];
      visual_style_suggestion: string;
    }>;

    if (providerConfig?.api_key_encrypted) {
      posts = await generateWithLLM(providerConfig, campaign, postCount);
    } else {
      posts = generateFallbackPosts(campaign, postCount);
    }

    let generated = 0;
    const now = new Date();

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const scheduledAt = getScheduleDate(now, campaign.frequency, i);

      const { error: insertError } = await supabase
        .from("social_posts")
        .insert({
          organization_id: orgId,
          created_by: user.id,
          body: post.body,
          targets: accountTargets,
          status: campaign.approval_required ? "draft" : "scheduled",
          scheduled_at_utc: scheduledAt.toISOString(),
          scheduled_timezone: "UTC",
          requires_approval: campaign.approval_required,
          campaign_id: campaign.id,
          hook_text: post.hook_text,
          cta_text: post.cta_text,
          hashtags: post.hashtags,
          visual_style_suggestion: post.visual_style_suggestion,
          media: [],
          targets_meta: {},
          link_preview: {},
          platform_options: {},
        });

      if (!insertError) generated++;
    }

    return new Response(
      JSON.stringify({ generated, total_requested: postCount }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Campaign generator error:", error);
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

function getPostCount(frequency: string): number {
  switch (frequency) {
    case "daily":
      return 7;
    case "3x_week":
      return 3;
    case "weekly":
      return 4;
    case "biweekly":
      return 2;
    default:
      return 3;
  }
}

function getScheduleDate(
  baseDate: Date,
  frequency: string,
  index: number
): Date {
  const date = new Date(baseDate);
  date.setHours(10, 0, 0, 0);

  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + index + 1);
      break;
    case "3x_week": {
      const daysToAdd = [1, 3, 5];
      date.setDate(date.getDate() + (daysToAdd[index % 3] || index * 2 + 1));
      break;
    }
    case "weekly":
      date.setDate(date.getDate() + (index + 1) * 7);
      break;
    case "biweekly":
      date.setDate(date.getDate() + (index + 1) * 14);
      break;
    default:
      date.setDate(date.getDate() + (index + 1) * 2);
  }

  return date;
}

async function generateWithLLM(
  providerConfig: {
    provider: string;
    api_key_encrypted: string;
  },
  campaign: Record<string, unknown>,
  count: number
): Promise<
  Array<{
    body: string;
    hook_text: string;
    cta_text: string;
    hashtags: string[];
    visual_style_suggestion: string;
  }>
> {
  const apiKey = providerConfig.api_key_encrypted;

  const systemPrompt = `You are a social media campaign strategist. Generate exactly ${count} unique social media posts for a campaign.

Campaign details:
- Name: ${campaign.name}
- Description: ${campaign.description || "Not specified"}
- Theme: ${campaign.theme || "General"}
- Content type: ${campaign.content_type || "Mixed"}
- Hook style: ${campaign.hook_style_preset || "question"}
- Platforms: ${(campaign.platforms as string[])?.join(", ") || "all"}

For each post, respond with a JSON array where each element has:
- body: The full post text (max 2000 chars)
- hook_text: An attention-grabbing opening line
- cta_text: A call to action
- hashtags: Array of 3-5 relevant hashtags (without #)
- visual_style_suggestion: Brief description of recommended visual

Respond ONLY with the JSON array, no other text.`;

  let responseText: string;

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate ${count} posts for the "${campaign.name}" campaign.`,
          },
        ],
        temperature: 0.8,
        max_tokens: 3000,
      }),
    }
  );

  if (!response.ok) throw new Error("OpenAI API request failed");
  const data = await response.json();
  responseText = data.choices?.[0]?.message?.content || "[]";

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(responseText);
  } catch {
    return generateFallbackPosts(campaign, count);
  }
}

function generateFallbackPosts(
  campaign: Record<string, unknown>,
  count: number
): Array<{
  body: string;
  hook_text: string;
  cta_text: string;
  hashtags: string[];
  visual_style_suggestion: string;
}> {
  const name = (campaign.name as string) || "Campaign";
  const theme = (campaign.theme as string) || "business";
  const hookStyle = (campaign.hook_style_preset as string) || "question";

  const hooks: Record<string, string[]> = {
    question: [
      `Did you know this about ${theme}?`,
      `What's your take on ${theme}?`,
      `Have you tried this ${theme} strategy?`,
      `Why does ${theme} matter now more than ever?`,
      `Ready to transform your ${theme} approach?`,
      `What if you could improve your ${theme} overnight?`,
      `Is your ${theme} strategy working?`,
    ],
    bold_claim: [
      `${theme} will never be the same.`,
      `This changes everything about ${theme}.`,
      `The truth about ${theme} nobody tells you.`,
      `Stop doing ${theme} the old way.`,
      `${theme} is broken. Here's the fix.`,
      `We cracked the code on ${theme}.`,
      `Forget everything you know about ${theme}.`,
    ],
    statistic: [
      `80% of businesses struggle with ${theme}.`,
      `${theme} grew 200% this year.`,
      `Only 1 in 5 get ${theme} right.`,
      `Companies investing in ${theme} see 3x returns.`,
      `${theme} adoption is at an all-time high.`,
      `Studies show ${theme} drives 40% more engagement.`,
      `The ${theme} market is worth $10B and growing.`,
    ],
    story: [
      `A year ago, we started our ${theme} journey...`,
      `Here's what happened when we focused on ${theme}...`,
      `Three months into ${theme}, we learned this...`,
      `The moment that changed our ${theme} approach...`,
      `When we first discovered ${theme}...`,
      `Our ${theme} story starts with a simple idea...`,
      `Last week, ${theme} taught us something new...`,
    ],
  };

  const hookList = hooks[hookStyle] || hooks.question;

  const posts = [];
  for (let i = 0; i < count; i++) {
    const hook = hookList[i % hookList.length];
    posts.push({
      body: `${hook}\n\nWe've been working on something exciting related to ${theme}. Stay tuned for more updates from ${name}.\n\nConnect an LLM provider in Settings to get AI-generated content tailored to your campaign.`,
      hook_text: hook,
      cta_text: "Follow for more updates!",
      hashtags: [
        theme.replace(/\s+/g, ""),
        "socialmedia",
        "marketing",
        "business",
      ],
      visual_style_suggestion:
        "Clean, modern graphic with brand colors and bold typography",
    });
  }

  return posts;
}
