import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

type SocialProvider =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "google_business"
  | "tiktok"
  | "youtube";

interface SocialAccount {
  id: string;
  provider: SocialProvider;
  external_account_id: string;
  unipile_account_id: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expiry: string | null;
  token_meta: Record<string, unknown>;
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
  platform_options?: Record<string, Record<string, unknown>>;
  customized_per_channel?: boolean;
}

interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
  unipileResponse?: Record<string, unknown>;
}

const MAX_ATTEMPTS = 3;

const CHARACTER_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  google_business: 1500,
  tiktok: 2200,
  youtube: 5000,
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

async function publishViaUnipile(
  unipileDsn: string,
  unipileApiKey: string,
  account: SocialAccount,
  post: SocialPost
): Promise<PublishResult> {
  try {
    if (!account.unipile_account_id) {
      return {
        success: false,
        error: "Account not connected via Unipile (missing unipile_account_id)",
      };
    }

    const text = preparePostText(account.provider, post.body);

    const unipileBody: Record<string, unknown> = {
      account_id: account.unipile_account_id,
      text,
    };

    if (post.media && post.media.length > 0) {
      unipileBody.media = post.media
        .filter((m) => m.url)
        .map((m) => ({ url: m.url }));
    }

    console.log(
      `[social-worker] Publishing to ${account.provider} via Unipile account ${account.unipile_account_id}`
    );

    const response = await fetch(`${unipileDsn}/api/v1/posts`, {
      method: "POST",
      headers: {
        "X-API-KEY": unipileApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(unipileBody),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        responseData.error?.message ||
        responseData.message ||
        responseData.title ||
        `Unipile API error (${response.status})`;
      console.error(
        `[social-worker] Unipile publish failed for ${account.provider}:`,
        response.status,
        JSON.stringify(responseData)
      );
      return {
        success: false,
        error: errorMessage,
        unipileResponse: responseData,
      };
    }

    const externalPostId =
      responseData.id ||
      responseData.post_id ||
      responseData.social_id ||
      responseData.object_id;

    console.log(
      `[social-worker] Published successfully to ${account.provider}, postId: ${externalPostId}`
    );

    return {
      success: true,
      postId: externalPostId || "unipile_success",
      unipileResponse: responseData,
    };
  } catch (error) {
    console.error(`[social-worker] Unipile publish exception:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown publish error",
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
  unipileDsn: string,
  unipileApiKey: string
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
  const unipileResponses: Record<string, unknown> = {};
  let allSucceeded = true;
  let lastError: string | undefined;

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
      via: "unipile",
    });

    const result = await publishViaUnipile(
      unipileDsn,
      unipileApiKey,
      account,
      post
    );

    if (result.success && result.postId) {
      providerPostIds[account.id] = result.postId;
      if (result.unipileResponse) {
        unipileResponses[account.id] = result.unipileResponse;
      }
      await createPostLog(supabase, post.id, account.id, "success", {
        provider_post_id: result.postId,
        via: "unipile",
      });
    } else {
      allSucceeded = false;
      lastError = result.error;
      await createPostLog(supabase, post.id, account.id, "failure", {
        error: result.error,
        via: "unipile",
        unipile_response: result.unipileResponse,
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
        unipile_response: unipileResponses,
        attempt_count: post.attempt_count + 1,
      })
      .eq("id", post.id);
    return { success: true };
  } else {
    const newAttemptCount = post.attempt_count + 1;
    const newStatus = newAttemptCount >= MAX_ATTEMPTS ? "failed" : "scheduled";

    await supabase
      .from("social_posts")
      .update({
        status: newStatus,
        last_error: lastError,
        attempt_count: newAttemptCount,
        provider_post_ids: providerPostIds,
        unipile_response: unipileResponses,
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
    const unipileDsn = Deno.env.get("UNIPILE_DSN");
    const unipileApiKey = Deno.env.get("UNIPILE_API_KEY");

    if (!unipileDsn || !unipileApiKey) {
      return new Response(
        JSON.stringify({ error: "Unipile not configured" }),
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
        unipileDsn,
        unipileApiKey
      );

      return new Response(
        JSON.stringify({
          message: result.success ? "Published successfully" : "Publish failed",
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
      const result = await processPost(
        supabase,
        post,
        unipileDsn,
        unipileApiKey
      );
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
