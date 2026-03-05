import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LATE_API_BASE = "https://getlate.dev/api";
const COMMENT_PLATFORMS = ["facebook", "instagram", "linkedin"];

interface LateInboxPost {
  id?: string;
  postId?: string;
  accountId?: string;
  platform?: string;
  body?: string;
  postBody?: string;
  text?: string;
  postUrl?: string;
  platformPostUrl?: string;
  commentCount?: number;
  lastCommentAt?: string;
}

interface LateComment {
  id?: string;
  commentId?: string;
  postId?: string;
  accountId?: string;
  platform?: string;
  authorId?: string;
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  text?: string;
  body?: string;
  likeCount?: number;
  replyCount?: number;
  isReply?: boolean;
  parentCommentId?: string;
  hidden?: boolean;
  hasPrivateReply?: boolean;
  createdAt?: string;
}

async function fetchInboxPosts(
  lateApiKey: string,
  accountId: string,
  maxPages = 5
): Promise<LateInboxPost[]> {
  const all: LateInboxPost[] = [];
  let cursor: string | undefined;
  let page = 0;

  while (page < maxPages) {
    const params = new URLSearchParams({ accountId });
    if (cursor) params.set("cursor", cursor);

    const url = `${LATE_API_BASE}/v1/inbox/comments?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${lateApiKey}`, Accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`[late-inbox-comments-sync] Posts fetch failed for ${accountId}: ${res.status}`);
      break;
    }

    const data = await res.json();
    const items: LateInboxPost[] = data.posts || data.items || data.data || [];
    all.push(...items);

    cursor = data.nextCursor || data.cursor;
    if (!cursor || items.length === 0) break;
    page++;
  }

  return all;
}

async function fetchPostComments(
  lateApiKey: string,
  latePostId: string,
  accountId: string,
  maxPages = 5
): Promise<LateComment[]> {
  const all: LateComment[] = [];
  let cursor: string | undefined;
  let page = 0;

  while (page < maxPages) {
    const params = new URLSearchParams({ postId: latePostId, accountId });
    if (cursor) params.set("cursor", cursor);

    const url = `${LATE_API_BASE}/v1/inbox/comments/${encodeURIComponent(latePostId)}?${new URLSearchParams({ accountId })}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${lateApiKey}`, Accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`[late-inbox-comments-sync] Comments fetch failed for post ${latePostId}: ${res.status}`);
      break;
    }

    const data = await res.json();
    const items: LateComment[] = data.comments || data.items || data.data || [];
    all.push(...items);

    cursor = data.nextCursor || data.cursor;
    if (!cursor || items.length === 0) break;
    page++;
  }

  return all;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lateApiKey = Deno.env.get("LATE_API_KEY");

    if (!lateApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "LATE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let orgId: string | null = null;
    let specificAccountId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isServiceRole = token === serviceRoleKey;

    if (isServiceRole) {
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      orgId = body.org_id || new URL(req.url).searchParams.get("org_id") || null;
      specificAccountId = body.account_id || new URL(req.url).searchParams.get("account_id") || null;
    } else if (authHeader) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: authData, error: authError } = await anonClient.auth.getUser(token);
      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", authData.user.id)
        .maybeSingle();
      orgId = userData?.organization_id || null;
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let connectionsQuery = supabase
      .from("late_connections")
      .select("id, late_account_id, platform, account_name")
      .eq("org_id", orgId)
      .eq("status", "connected")
      .in("platform", COMMENT_PLATFORMS);

    if (specificAccountId) {
      connectionsQuery = connectionsQuery.eq("late_account_id", specificAccountId);
    }

    const { data: connections } = await connectionsQuery;

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No connected accounts found", synced: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalPosts = 0;
    let totalComments = 0;
    const errors: string[] = [];

    for (const conn of connections) {
      try {
        const inboxPosts = await fetchInboxPosts(lateApiKey, conn.late_account_id);
        console.log(`[late-inbox-comments-sync] Account ${conn.account_name}: ${inboxPosts.length} posts with comments`);

        for (const post of inboxPosts) {
          const latePostId = post.id || post.postId || "";
          if (!latePostId) continue;

          const platform = post.platform || conn.platform;
          const bodyPreview = post.body || post.postBody || post.text || null;
          const postUrl = post.postUrl || post.platformPostUrl || null;
          const commentCount = post.commentCount || 0;
          const lastCommentAt = post.lastCommentAt || null;

          const { data: commentPost, error: cpError } = await supabase
            .from("social_post_comment_posts")
            .upsert(
              {
                organization_id: orgId,
                late_post_id: latePostId,
                late_account_id: conn.late_account_id,
                platform,
                post_body_preview: bodyPreview,
                platform_post_url: postUrl,
                comment_count: commentCount,
                last_comment_at: lastCommentAt,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "organization_id,late_post_id,late_account_id" }
            )
            .select("id")
            .maybeSingle();

          if (cpError) {
            console.error(`[late-inbox-comments-sync] Comment post upsert error:`, cpError);
            errors.push(`Post upsert failed: ${cpError.message}`);
            continue;
          }

          totalPosts++;
          const commentPostId = commentPost?.id || null;

          const comments = await fetchPostComments(lateApiKey, latePostId, conn.late_account_id);

          for (const comment of comments) {
            const lateCommentId = comment.id || comment.commentId || "";
            if (!lateCommentId) continue;

            const { error: commentError } = await supabase
              .from("social_post_comments")
              .upsert(
                {
                  organization_id: orgId,
                  comment_post_id: commentPostId,
                  late_comment_id: lateCommentId,
                  late_post_id: latePostId,
                  late_account_id: conn.late_account_id,
                  platform: comment.platform || platform,
                  author_id: comment.authorId || null,
                  author_name: comment.authorName || null,
                  author_handle: comment.authorHandle || null,
                  author_avatar_url: comment.authorAvatarUrl || null,
                  text: comment.text || comment.body || null,
                  like_count: comment.likeCount || 0,
                  reply_count: comment.replyCount || 0,
                  is_reply: comment.isReply || false,
                  parent_comment_id: comment.parentCommentId || null,
                  hidden: comment.hidden || false,
                  has_private_reply: comment.hasPrivateReply || false,
                  comment_created_at: comment.createdAt || null,
                  synced_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "organization_id,late_comment_id" }
              );

            if (commentError) {
              console.error(`[late-inbox-comments-sync] Comment upsert error:`, commentError);
            } else {
              totalComments++;
            }
          }
        }

        await supabase
          .from("late_connections")
          .update({ last_comments_synced_at: new Date().toISOString() })
          .eq("id", conn.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[late-inbox-comments-sync] Account ${conn.account_name} error:`, msg);
        errors.push(`${conn.account_name}: ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        posts_synced: totalPosts,
        comments_synced: totalComments,
        accounts_processed: connections.length,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[late-inbox-comments-sync] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
