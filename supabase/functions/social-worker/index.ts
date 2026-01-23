import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type SocialProvider = "facebook" | "instagram" | "linkedin" | "google_business" | "tiktok" | "youtube";

interface SocialAccount {
  id: string;
  provider: SocialProvider;
  external_account_id: string;
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
}

interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

const MAX_ATTEMPTS = 3;

function simpleDecrypt(encoded: string): string {
  return Buffer.from(encoded, "base64").toString("utf-8");
}

async function publishToFacebook(
  account: SocialAccount,
  post: SocialPost
): Promise<PublishResult> {
  try {
    const accessToken = simpleDecrypt(account.access_token_encrypted);
    const pageId = account.external_account_id;

    let endpoint = `https://graph.facebook.com/v18.0/${pageId}/feed`;
    const body: Record<string, unknown> = {
      message: post.body,
      access_token: accessToken,
    };

    if (post.media.length > 0) {
      const media = post.media[0];
      if (media.type === "image") {
        endpoint = `https://graph.facebook.com/v18.0/${pageId}/photos`;
        body.url = media.url;
        body.caption = post.body;
        delete body.message;
      } else if (media.type === "video") {
        endpoint = `https://graph.facebook.com/v18.0/${pageId}/videos`;
        body.file_url = media.url;
        body.description = post.body;
        delete body.message;
      }
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error?.message || "Facebook post failed" };
    }

    return { success: true, postId: data.id || data.post_id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function publishToInstagram(
  account: SocialAccount,
  post: SocialPost
): Promise<PublishResult> {
  try {
    const accessToken = simpleDecrypt(account.access_token_encrypted);
    const igUserId = account.external_account_id;

    if (post.media.length === 0) {
      return { success: false, error: "Instagram requires media for posts" };
    }

    const media = post.media[0];
    let containerEndpoint: string;
    const containerBody: Record<string, unknown> = {
      access_token: accessToken,
      caption: post.body,
    };

    if (media.type === "image") {
      containerEndpoint = `https://graph.facebook.com/v18.0/${igUserId}/media`;
      containerBody.image_url = media.url;
    } else if (media.type === "video") {
      containerEndpoint = `https://graph.facebook.com/v18.0/${igUserId}/media`;
      containerBody.video_url = media.url;
      containerBody.media_type = "REELS";
    } else {
      return { success: false, error: "Unsupported media type" };
    }

    const containerResponse = await fetch(containerEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    });

    const containerData = await containerResponse.json();
    if (!containerResponse.ok) {
      return { success: false, error: containerData.error?.message || "Failed to create media container" };
    }

    const containerId = containerData.id;

    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    );

    const publishData = await publishResponse.json();
    if (!publishResponse.ok) {
      return { success: false, error: publishData.error?.message || "Failed to publish media" };
    }

    return { success: true, postId: publishData.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function publishToLinkedIn(
  account: SocialAccount,
  post: SocialPost
): Promise<PublishResult> {
  try {
    const accessToken = simpleDecrypt(account.access_token_encrypted);
    const authorUrn = `urn:li:person:${account.external_account_id}`;

    const postBody: Record<string, unknown> = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: post.body,
          },
          shareMediaCategory: post.media.length > 0 ? "IMAGE" : "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    if (post.media.length > 0) {
      const mediaElements = post.media.map((m) => ({
        status: "READY",
        media: m.url,
      }));
      (postBody.specificContent as Record<string, Record<string, unknown>>)["com.linkedin.ugc.ShareContent"].media = mediaElements;
    }

    const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(postBody),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || "LinkedIn post failed" };
    }

    return { success: true, postId: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function publishToGoogleBusiness(
  account: SocialAccount,
  post: SocialPost
): Promise<PublishResult> {
  try {
    const accessToken = simpleDecrypt(account.access_token_encrypted);
    const locationName = account.external_account_id;

    const postBody: Record<string, unknown> = {
      languageCode: "en",
      summary: post.body,
      topicType: "STANDARD",
    };

    if (post.media.length > 0) {
      postBody.media = {
        mediaFormat: post.media[0].type === "video" ? "VIDEO" : "PHOTO",
        sourceUrl: post.media[0].url,
      };
    }

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postBody),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error?.message || "Google Business post failed" };
    }

    return { success: true, postId: data.name };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function publishToTikTok(
  account: SocialAccount,
  post: SocialPost
): Promise<PublishResult> {
  try {
    if (post.media.length === 0 || post.media[0].type !== "video") {
      return { success: false, error: "TikTok requires a video" };
    }

    const accessToken = simpleDecrypt(account.access_token_encrypted);

    const initResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_info: {
            title: post.body.substring(0, 150),
            privacy_level: "PUBLIC_TO_EVERYONE",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: post.media[0].url,
          },
        }),
      }
    );

    const initData = await initResponse.json();
    if (!initResponse.ok) {
      return { success: false, error: initData.error?.message || "TikTok upload init failed" };
    }

    return { success: true, postId: initData.data?.publish_id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function publishToYouTube(
  account: SocialAccount,
  post: SocialPost
): Promise<PublishResult> {
  try {
    if (post.media.length === 0 || post.media[0].type !== "video") {
      return { success: false, error: "YouTube requires a video" };
    }

    const accessToken = simpleDecrypt(account.access_token_encrypted);

    const initResponse = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/*",
        },
        body: JSON.stringify({
          snippet: {
            title: post.body.substring(0, 100) || "Video",
            description: post.body,
            categoryId: "22",
          },
          status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );

    if (!initResponse.ok) {
      const error = await initResponse.json();
      return { success: false, error: error.error?.message || "YouTube upload init failed" };
    }

    const uploadUrl = initResponse.headers.get("Location");
    if (!uploadUrl) {
      return { success: false, error: "No upload URL returned" };
    }

    return { success: true, postId: `pending:${uploadUrl}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function publishToProvider(
  provider: SocialProvider,
  account: SocialAccount,
  post: SocialPost
): Promise<PublishResult> {
  switch (provider) {
    case "facebook":
      return publishToFacebook(account, post);
    case "instagram":
      return publishToInstagram(account, post);
    case "linkedin":
      return publishToLinkedIn(account, post);
    case "google_business":
      return publishToGoogleBusiness(account, post);
    case "tiktok":
      return publishToTikTok(account, post);
    case "youtube":
      return publishToYouTube(account, post);
    default:
      return { success: false, error: `Unknown provider: ${provider}` };
  }
}

async function createPostLog(
  supabase: ReturnType<typeof createClient>,
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();
    const { data: duePosts, error: fetchError } = await supabase
      .from("social_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at_utc", now)
      .lt("attempt_count", MAX_ATTEMPTS);

    if (fetchError) {
      console.error("Error fetching due posts:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch posts" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!duePosts || duePosts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No posts to process", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const post of duePosts as SocialPost[]) {
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

        failureCount++;
        processedCount++;
        continue;
      }

      await supabase
        .from("social_posts")
        .update({ status: "posting" })
        .eq("id", post.id);

      const providerPostIds: Record<string, string> = {};
      let allSucceeded = true;
      let lastError: string | undefined;

      for (const account of accounts as SocialAccount[]) {
        await createPostLog(supabase, post.id, account.id, "attempt", {
          provider: account.provider,
        });

        const result = await publishToProvider(account.provider, account, post);

        if (result.success && result.postId) {
          providerPostIds[account.id] = result.postId;
          await createPostLog(supabase, post.id, account.id, "success", {
            provider_post_id: result.postId,
          });
        } else {
          allSucceeded = false;
          lastError = result.error;
          await createPostLog(supabase, post.id, account.id, "failure", {
            error: result.error,
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
            attempt_count: post.attempt_count + 1,
          })
          .eq("id", post.id);
        successCount++;
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
          })
          .eq("id", post.id);

        if (newStatus === "failed") {
          failureCount++;
        }
      }

      processedCount++;
    }

    return new Response(
      JSON.stringify({
        message: "Processing complete",
        processed: processedCount,
        succeeded: successCount,
        failed: failureCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Social worker error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
