import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LATE_API_BASE = "https://getlate.dev/api/v1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lateApiKey = Deno.env.get("LATE_API_KEY");

    if (!lateApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Late.dev not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { post_id, bulk } = body;

    const lateHeaders = {
      Authorization: `Bearer ${lateApiKey}`,
      Accept: "application/json",
    };

    // Bulk mode: sync metrics for all recently published posts
    if (bulk) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: posts } = await supabase
        .from("social_posts")
        .select("id, late_post_id, organization_id")
        .eq("organization_id", userData.organization_id)
        .eq("late_status", "published")
        .not("late_post_id", "is", null)
        .gte("posted_at", thirtyDaysAgo.toISOString());

      if (!posts || posts.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No published posts to sync", synced: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let synced = 0;
      for (const post of posts) {
        const ok = await fetchAndStoreMetrics(supabase, lateHeaders, post.id, post.late_post_id, post.organization_id);
        if (ok) synced++;
      }

      return new Response(
        JSON.stringify({ success: true, synced }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single post mode
    if (!post_id) {
      return new Response(
        JSON.stringify({ success: false, error: "post_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: post } = await supabase
      .from("social_posts")
      .select("id, late_post_id, organization_id, late_status")
      .eq("id", post_id)
      .eq("organization_id", userData.organization_id)
      .maybeSingle();

    if (!post) {
      return new Response(
        JSON.stringify({ success: false, error: "Post not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!post.late_post_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Post has not been published via Late.dev yet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ok = await fetchAndStoreMetrics(supabase, lateHeaders, post.id, post.late_post_id, post.organization_id);

    if (!ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch metrics from Late.dev" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: metrics } = await supabase
      .from("social_post_metrics")
      .select("*")
      .eq("post_id", post_id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return new Response(
      JSON.stringify({ success: true, metrics }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[late-metrics] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fetchAndStoreMetrics(
  supabase: ReturnType<typeof createClient>,
  lateHeaders: Record<string, string>,
  postId: string,
  latePostId: string,
  organizationId: string
): Promise<boolean> {
  try {
    // Try GET /v1/analytics?postId={id}
    const analyticsResponse = await fetch(
      `${LATE_API_BASE}/analytics?postId=${encodeURIComponent(latePostId)}`,
      { headers: lateHeaders }
    );

    if (!analyticsResponse.ok) {
      // Fallback: GET /v1/posts/{id} may include stats
      const postResponse = await fetch(`${LATE_API_BASE}/posts/${latePostId}`, { headers: lateHeaders });
      if (!postResponse.ok) {
        console.error("[late-metrics] Both analytics and post fetch failed for:", latePostId);
        return false;
      }
      const postData = await postResponse.json();
      const stats = postData.stats || postData.analytics || postData.metrics || {};
      await upsertMetrics(supabase, postId, organizationId, stats, postData.platform || "unknown");
      return true;
    }

    const analyticsData = await analyticsResponse.json();
    const items: Array<Record<string, unknown>> = analyticsData.data || analyticsData.analytics || (Array.isArray(analyticsData) ? analyticsData : [analyticsData]);

    for (const item of items) {
      await upsertMetrics(supabase, postId, organizationId, item, (item.platform as string) || "unknown");
    }

    return true;
  } catch (err) {
    console.error("[late-metrics] fetchAndStoreMetrics error:", err);
    return false;
  }
}

async function upsertMetrics(
  supabase: ReturnType<typeof createClient>,
  postId: string,
  organizationId: string,
  data: Record<string, unknown>,
  platform: string
): Promise<void> {
  const impressions = toInt(data.impressions ?? data.reach_total ?? data.views);
  const reach = toInt(data.reach ?? data.unique_reach ?? data.unique_views);
  const likes = toInt(data.likes ?? data.reactions ?? data.like_count);
  const comments = toInt(data.comments ?? data.comment_count);
  const shares = toInt(data.shares ?? data.reposts ?? data.share_count ?? data.retweets);
  const saves = toInt(data.saves ?? data.bookmarks ?? data.saved);
  const clicks = toInt(data.clicks ?? data.link_clicks ?? data.click_count);
  const videoViews = toInt(data.video_views ?? data.video_plays ?? data.views);

  const totalEngagements = (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0) + (clicks ?? 0);
  const engagementScore = impressions && impressions > 0
    ? totalEngagements / impressions
    : null;

  const { error } = await supabase
    .from("social_post_metrics")
    .upsert(
      {
        post_id: postId,
        organization_id: organizationId,
        platform,
        impressions,
        reach,
        likes,
        comments,
        shares,
        saves,
        clicks,
        video_views: videoViews,
        engagement_score: engagementScore,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "post_id,platform" }
    );

  if (error) {
    console.error("[late-metrics] upsertMetrics error:", error);
  }
}

function toInt(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : Math.round(n);
}
