import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LATE_API_BASE = "https://getlate.dev/api/v1";


type SocialProvider =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "google_business"
  | "tiktok"
  | "youtube"
  | "reddit";

interface SocialAccount {
  id: string;
  provider: SocialProvider;
  external_account_id: string;
  unipile_account_id: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expiry: string | null;
  token_meta: Record<string, unknown>;
  organization_id: string;
}

interface SocialPost {
  id: string;
  organization_id: string;
  body: string;
  media: Array<{ url: string; type: string }>;
  targets: string[];
  status: string;
  attempt_count: number;
  scheduled_at_utc: string | null;
  scheduled_timezone: string;
  platform_options?: Record<string, Record<string, unknown>>;
  customized_per_channel?: boolean;
}

interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
  lateResponse?: Record<string, unknown>;
}

const MAX_ATTEMPTS = 3;

const CHARACTER_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  google_business: 1500,
  tiktok: 2200,
  youtube: 5000,
  reddit: 40000,
};

const PROVIDER_TO_LATE_PLATFORM: Record<string, string> = {
  facebook: "facebook",
  instagram: "instagram",
  linkedin: "linkedin",
  google_business: "googlebusiness",
  tiktok: "tiktok",
  youtube: "youtube",
  reddit: "reddit",
};

function validatePlatformConstraints(
  provider: SocialProvider,
  post: SocialPost
): string | null {
  const text = post.body || "";

  const limit = CHARACTER_LIMITS[provider];
  if (limit && text.length > limit) {
    return `Text exceeds ${provider} character limit (${text.length}/${limit})`;
  }

  switch (provider) {
    case "instagram":
      if (post.media.length === 0) {
        return "Instagram requires at least one media attachment";
      }
      break;
    case "tiktok":
      if (
        post.media.length === 0 ||
        !post.media.some((m) => m.type === "video")
      ) {
        return "TikTok requires a video attachment";
      }
      break;
    case "youtube": {
      if (
        post.media.length === 0 ||
        !post.media.some((m) => m.type === "video")
      ) {
        return "YouTube requires a video attachment";
      }
      const ytOptions = post.platform_options?.youtube;
      if (
        !ytOptions?.video_title &&
        !ytOptions?.title &&
        post.body.length === 0
      ) {
        return "YouTube requires a title";
      }
      break;
    }
  }

  return null;
}

function preparePostText(provider: SocialProvider, text: string): string {
  if (provider === "google_business") {
    return text.replace(/#\w+/g, "").replace(/\s{2,}/g, " ").trim();
  }
  return text;
}

async function resolveLateAccountId(
  supabase: SupabaseClient,
  account: SocialAccount
): Promise<string | null> {
  const lateId = account.token_meta?.late_account_id as string;
  if (lateId) return lateId;

  const { data: lateConn } = await supabase
    .from("late_connections")
    .select("late_account_id")
    .eq("org_id", account.organization_id)
    .eq("platform", account.provider)
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();

  return lateConn?.late_account_id || null;
}

async function publishViaLate(
  lateApiKey: string,
  supabase: SupabaseClient,
  account: SocialAccount,
  post: SocialPost
): Promise<PublishResult> {
  try {
    const lateAccountId = await resolveLateAccountId(supabase, account);

    if (!lateAccountId) {
      return {
        success: false,
        error:
          "Account not connected via Late.dev (missing late_account_id)",
      };
    }

    const text = preparePostText(account.provider, post.body);
    const latePlatform = PROVIDER_TO_LATE_PLATFORM[account.provider];

    if (!latePlatform) {
      return {
        success: false,
        error: `Unsupported platform for Late.dev: ${account.provider}`,
      };
    }

    const latePayload: Record<string, unknown> = {
      content: text,
      publishNow: true,
      platforms: [
        {
          platform: latePlatform,
          accountId: lateAccountId,
        },
      ],
    };

    if (post.scheduled_at_utc && post.status === "scheduled") {
      latePayload.publishNow = false;
      latePayload.scheduledFor = post.scheduled_at_utc;
      if (post.scheduled_timezone) {
        latePayload.timezone = post.scheduled_timezone;
      }
    }

    if (post.media && post.media.length > 0) {
      latePayload.mediaItems = post.media
        .filter((m) => m.url)
        .map((m) => ({ url: m.url, type: m.type }));
    }

    console.log(
      `[social-worker] Publishing to ${account.provider} via Late.dev account ${lateAccountId}`
    );

    const response = await fetch(`${LATE_API_BASE}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lateApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(latePayload),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        (responseData as Record<string, unknown>).error ||
        (responseData as Record<string, unknown>).message ||
        `Late.dev API error (${response.status})`;
      console.error(
        `[social-worker] Late.dev publish failed for ${account.provider}:`,
        response.status,
        JSON.stringify(responseData)
      );
      return {
        success: false,
        error: typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage),
        lateResponse: responseData as Record<string, unknown>,
      };
    }

    const latePostId =
      (responseData as Record<string, unknown>).id ||
      (responseData as Record<string, unknown>).postId ||
      (responseData as Record<string, unknown>).post_id;

    console.log(
      `[social-worker] Published successfully to ${account.provider}, latePostId: ${latePostId}`
    );

    return {
      success: true,
      postId: (latePostId as string) || "late_success",
      lateResponse: responseData as Record<string, unknown>,
    };
  } catch (error) {
    console.error(`[social-worker] Late.dev publish exception:`, error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown publish error",
    };
  }
}

async function createPostLog(
  supabase: SupabaseClient,
  postId: string,
  accountId: string | null,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  await supabase.from("social_post_logs").insert({
    post_id: postId,
    account_id: accountId,
    action,
    details,
  });
}

async function processPost(
  supabase: SupabaseClient,
  post: SocialPost,
  lateApiKey: string
): Promise<{ success: boolean }> {
  await supabase
    .from("social_posts")
    .update({ status: "queued" })
    .eq("id", post.id);
  await createPostLog(supabase, post.id, null, "queued", {});

  const { data: accounts, error: accountsError } = await supabase
    .from("social_accounts")
    .select("*")
    .in("id", post.targets)
    .eq("status", "connected");

  if (accountsError || !accounts || accounts.length === 0) {
    await supabase
      .from("social_posts")
      .update({
        status: "failed",
        last_error: "No connected accounts found for targets",
        attempt_count: post.attempt_count + 1,
      })
      .eq("id", post.id);
    await createPostLog(supabase, post.id, null, "failure", {
      error: "No connected accounts found",
    });
    return { success: false };
  }

  await supabase
    .from("social_posts")
    .update({ status: "posting" })
    .eq("id", post.id);

  const providerPostIds: Record<string, string> = {};
  const lateResponses: Record<string, unknown> = {};
  let allSucceeded = true;
  let lastError: string | undefined;
  let latePostId: string | null = null;

  for (const account of accounts as SocialAccount[]) {
    const validationError = validatePlatformConstraints(
      account.provider,
      post
    );
    if (validationError) {
      allSucceeded = false;
      lastError = validationError;
      await createPostLog(supabase, post.id, account.id, "failure", {
        error: validationError,
        type: "validation",
      });
      continue;
    }

    await createPostLog(supabase, post.id, account.id, "attempt", {
      provider: account.provider,
      via: "late",
    });

    const result = await publishViaLate(
      lateApiKey,
      supabase,
      account,
      post
    );

    if (result.success && result.postId) {
      providerPostIds[account.id] = result.postId;
      if (result.lateResponse) {
        lateResponses[account.id] = result.lateResponse;
      }
      if (!latePostId) {
        latePostId = result.postId;
      }
      await createPostLog(supabase, post.id, account.id, "success", {
        provider_post_id: result.postId,
        via: "late",
      });
    } else {
      allSucceeded = false;
      lastError = result.error;
      await createPostLog(supabase, post.id, account.id, "failure", {
        error: result.error,
        via: "late",
        late_response: result.lateResponse,
      });
    }
  }

  if (allSucceeded) {
    await supabase
      .from("social_posts")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
        provider_post_ids: providerPostIds,
        late_post_id: latePostId,
        late_status: "published",
        late_response: lateResponses,
        attempt_count: post.attempt_count + 1,
      })
      .eq("id", post.id);
    return { success: true };
  } else {
    const newAttemptCount = post.attempt_count + 1;
    const newStatus =
      newAttemptCount >= MAX_ATTEMPTS ? "failed" : "scheduled";

    await supabase
      .from("social_posts")
      .update({
        status: newStatus,
        last_error: lastError,
        attempt_count: newAttemptCount,
        provider_post_ids: providerPostIds,
        late_post_id: latePostId,
        late_status: "failed",
        late_response: lateResponses,
      })
      .eq("id", post.id);

    return { success: false };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lateApiKey = Deno.env.get("LATE_API_KEY");

    if (!lateApiKey) {
      return new Response(
        JSON.stringify({ error: "Late.dev not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let publishPostId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        publishPostId = body.post_id || null;
      } catch {
        // no body = cron trigger
      }
    }

    if (publishPostId) {
      const { data: post, error: postError } = await supabase
        .from("social_posts")
        .select("*")
        .eq("id", publishPostId)
        .maybeSingle();

      if (postError || !post) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (post.status !== "draft" && post.status !== "scheduled") {
        return new Response(
          JSON.stringify({
            error: `Cannot publish post with status: ${post.status}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const result = await processPost(
        supabase,
        post as SocialPost,
        lateApiKey
      );

      return new Response(
        JSON.stringify({
          message: result.success
            ? "Published successfully"
            : "Publish failed",
          success: result.success,
          post_id: publishPostId,
        }),
        {
          status: result.success ? 200 : 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const now = new Date().toISOString();
    const { data: duePosts, error: fetchError } = await supabase
      .from("social_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at_utc", now)
      .lt("attempt_count", MAX_ATTEMPTS);

    if (fetchError) {
      console.error("[social-worker] Error fetching due posts:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch posts" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!duePosts || duePosts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No posts to process", processed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const post of duePosts as SocialPost[]) {
      const result = await processPost(supabase, post, lateApiKey);
      processedCount++;
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Processing complete",
        processed: processedCount,
        succeeded: successCount,
        failed: failureCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[social-worker] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
