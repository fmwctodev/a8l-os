import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LATE_API_BASE = "https://getlate.dev/api";

interface InboxReview {
  id?: string;
  reviewId?: string;
  accountId?: string;
  accountUsername?: string;
  platform?: string;
  reviewer?: {
    id?: string | null;
    name?: string;
    profileImage?: string | null;
  };
  reviewerName?: string;
  reviewerDisplayName?: string;
  reviewerProfileImage?: string;
  reviewerPhotoUrl?: string;
  rating?: number | string;
  starRating?: string;
  text?: string;
  reviewText?: string;
  comment?: string;
  message?: string;
  recommendation_type?: string;
  has_rating?: boolean;
  created?: string;
  createdAt?: string;
  createTime?: string;
  created_time?: string;
  updatedAt?: string;
  hasReply?: boolean;
  reply?: {
    id?: string;
    text?: string;
    comment?: string;
    created?: string;
    createdAt?: string;
    updateTime?: string;
  } | null;
  reviewReply?: {
    comment?: string;
    text?: string;
    updateTime?: string;
  } | null;
  ownerReply?: {
    comment?: string;
    text?: string;
    updateTime?: string;
  } | null;
  reviewUrl?: string;
  url?: string;
}

interface NormalizedReview {
  externalId: string;
  platform: string;
  accountId: string;
  reviewerName: string;
  reviewerProfileImage: string | null;
  rating: number;
  text: string | null;
  created: string;
  hasReply: boolean;
  replyText: string | null;
  replyCreatedAt: string | null;
  reviewUrl: string | null;
}

interface RoutingRule {
  id: string;
  platform: string | null;
  min_rating: number | null;
  max_rating: number | null;
  assign_to_user_id: string | null;
  assign_to_role: string | null;
  priority: string;
  requires_manual_approval: boolean;
}

interface ReputationSettings {
  sla_hours_positive: number;
  sla_hours_negative: number;
  escalation_keywords: string[];
  escalation_user_id: string | null;
  escalation_email: string | null;
}

const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

function parseStarRating(raw: string | number | undefined): number {
  if (typeof raw === "number") return Math.min(5, Math.max(1, Math.round(raw)));
  if (typeof raw === "string") {
    const mapped = STAR_RATING_MAP[raw.toUpperCase()];
    if (mapped) return mapped;
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) return Math.min(5, Math.max(1, parsed));
  }
  return 3;
}

function normalizeInboxReview(r: InboxReview, accountId: string): NormalizedReview {
  const reviewId = r.id || r.reviewId || "";
  const platform = r.platform || "unknown";

  let rating = 3;
  if (r.rating !== undefined) {
    rating = parseStarRating(r.rating);
  } else if (r.starRating !== undefined) {
    rating = parseStarRating(r.starRating);
  } else if (r.recommendation_type === "positive") {
    rating = 5;
  } else if (r.recommendation_type === "negative") {
    rating = 1;
  } else if (r.has_rating === false) {
    rating = 3;
  }

  const reviewerName =
    r.reviewer?.name ||
    r.reviewerName ||
    r.reviewerDisplayName ||
    "Anonymous";

  const reviewerProfileImage =
    r.reviewer?.profileImage ||
    r.reviewerProfileImage ||
    r.reviewerPhotoUrl ||
    null;

  const text = r.text || r.reviewText || r.comment || r.message || null;

  const created =
    r.created ||
    r.createdAt ||
    r.createTime ||
    r.created_time ||
    new Date().toISOString();

  const replyObj =
    r.reply ||
    r.reviewReply ||
    r.ownerReply ||
    null;

  const replyText = replyObj
    ? (replyObj.text || (replyObj as Record<string, string>).comment || null)
    : null;

  const replyCreatedAt = replyObj
    ? (replyObj.created || replyObj.createdAt || (replyObj as Record<string, string>).updateTime || null)
    : null;

  const reviewUrl = r.reviewUrl || r.url || null;

  const platformKey = platform === "googlebusiness" || platform === "google_business"
    ? "googlebusiness"
    : platform;

  return {
    externalId: `${platformKey}_${accountId}_${reviewId}`,
    platform: platformKey,
    accountId,
    reviewerName,
    reviewerProfileImage,
    rating,
    text,
    created,
    hasReply: r.hasReply ?? !!replyText,
    replyText,
    replyCreatedAt,
    reviewUrl,
  };
}

async function fetchInboxReviews(
  lateApiKey: string,
  accountId: string,
  maxPages = 10
): Promise<{ reviews: NormalizedReview[]; error?: string }> {
  const normalized: NormalizedReview[] = [];
  let cursor: string | undefined;
  let page = 0;

  while (page < maxPages) {
    const params = new URLSearchParams({ accountId });
    if (cursor) params.set("cursor", cursor);

    const url = `${LATE_API_BASE}/v1/inbox/reviews?${params}`;
    console.log(`[reputation-review-sync] Inbox reviews page ${page + 1}: accountId=${accountId}`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${lateApiKey}`, Accept: "application/json" },
    });

    if (!res.ok) {
      const errText = await res.text();
      const msg = `Inbox reviews API error ${res.status}: ${errText.slice(0, 300)}`;
      console.error(`[reputation-review-sync] ${msg}`);
      return { reviews: normalized, error: msg };
    }

    const data = await res.json();
    const reviews: InboxReview[] = data.data || data.reviews || data.items || [];

    for (const r of reviews) {
      normalized.push(normalizeInboxReview(r, accountId));
    }

    cursor = data.pagination?.nextCursor || data.nextCursor || data.cursor || data.nextPageToken;
    if (!cursor || reviews.length === 0) break;
    page++;
  }

  return { reviews: normalized };
}

function computeSlaBreached(
  reviewCreatedAt: string,
  rating: number,
  hasReply: boolean,
  settings: ReputationSettings
): boolean {
  if (hasReply) return false;
  const created = new Date(reviewCreatedAt);
  const slaHours =
    rating >= 4 ? settings.sla_hours_positive : settings.sla_hours_negative;
  const deadline = new Date(created.getTime() + slaHours * 60 * 60 * 1000);
  return new Date() > deadline;
}

function checkEscalation(
  rating: number,
  text: string | null,
  keywords: string[]
): boolean {
  if (rating <= 2) return true;
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function matchRoutingRule(
  rules: RoutingRule[],
  platform: string,
  rating: number
): RoutingRule | null {
  const priorityOrder: Record<string, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };
  const sorted = [...rules].sort(
    (a, b) =>
      (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
  );
  for (const rule of sorted) {
    if (rule.platform && rule.platform !== platform) continue;
    if (rule.min_rating && rating < rule.min_rating) continue;
    if (rule.max_rating && rating > rule.max_rating) continue;
    return rule;
  }
  return null;
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
        JSON.stringify({ error: "LATE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let orgId: string;
    let userId: string | null = null;

    if (isServiceRole) {
      const body = req.method === "POST" ? await req.json() : {};
      orgId = body.org_id || new URL(req.url).searchParams.get("org_id") || "";
      userId = body.user_id || null;
    } else {
      const anonClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data: authData, error: authError } = await anonClient.auth.getUser(token);
      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = authData.user.id;
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", userId)
        .maybeSingle();
      orgId = userData?.organization_id || "";
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "Organization ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const urlParams = new URL(req.url).searchParams;
    const platformFilter = urlParams.get("platform") || undefined;

    console.log(`[reputation-review-sync] Syncing org ${orgId}, platform: ${platformFilter || "all"}`);

    const { data: connections } = await supabase
      .from("late_connections")
      .select("late_account_id, platform, account_name")
      .eq("org_id", orgId)
      .eq("status", "connected");

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No connected accounts found. Please connect a Google Business or Facebook account first." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings } = await supabase
      .from("reputation_settings")
      .select("sla_hours_positive, sla_hours_negative, escalation_keywords, escalation_user_id, escalation_email")
      .eq("organization_id", orgId)
      .maybeSingle();

    const slaSettings: ReputationSettings = {
      sla_hours_positive: settings?.sla_hours_positive ?? 48,
      sla_hours_negative: settings?.sla_hours_negative ?? 12,
      escalation_keywords: settings?.escalation_keywords ?? ["refund", "lawsuit", "attorney", "scam", "lawyer", "legal"],
      escalation_user_id: settings?.escalation_user_id ?? null,
      escalation_email: settings?.escalation_email ?? null,
    };

    const { data: routingRules } = await supabase
      .from("reputation_routing_rules")
      .select("*")
      .eq("org_id", orgId);

    const allReviews: NormalizedReview[] = [];
    const syncErrors: string[] = [];

    for (const conn of connections) {
      const platform = conn.platform as string;
      if (platformFilter && platform !== platformFilter) continue;

      const { reviews, error } = await fetchInboxReviews(lateApiKey, conn.late_account_id);
      if (error) syncErrors.push(`[${conn.account_name}] ${error}`);
      allReviews.push(...reviews);
    }

    console.log(`[reputation-review-sync] Fetched ${allReviews.length} reviews total`);

    let upserted = 0;

    for (const review of allReviews) {
      try {
        const slaBreached = computeSlaBreached(review.created, review.rating, review.hasReply, slaSettings);
        const escalated = checkEscalation(review.rating, review.text, slaSettings.escalation_keywords);
        const matchedRule = matchRoutingRule((routingRules || []) as RoutingRule[], review.platform, review.rating);

        const reviewRow = {
          org_id: orgId,
          late_review_id: review.externalId,
          platform: review.platform,
          account_id: review.accountId,
          account_username: null,
          reviewer_name: review.reviewerName,
          reviewer_profile_image: review.reviewerProfileImage,
          rating: review.rating,
          review_text: review.text,
          review_created_at: review.created,
          has_reply: review.hasReply,
          reply_id: null,
          reply_text: review.replyText,
          reply_created_at: review.replyCreatedAt,
          review_url: review.reviewUrl,
          sla_breached: slaBreached,
          escalated,
          assigned_to_user_id: matchedRule?.assign_to_user_id || null,
          priority: escalated ? "urgent" : (matchedRule?.priority || "normal"),
          requires_approval: matchedRule?.requires_manual_approval || false,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from("reputation_reviews")
          .upsert(reviewRow, { onConflict: "org_id,late_review_id" });

        if (upsertError) {
          syncErrors.push(`Failed to upsert ${review.externalId}: ${upsertError.message}`);
          continue;
        }

        upserted++;

        if (review.replyText) {
          const { data: savedReview } = await supabase
            .from("reputation_reviews")
            .select("id")
            .eq("org_id", orgId)
            .eq("late_review_id", review.externalId)
            .maybeSingle();

          if (savedReview) {
            const { data: existingReply } = await supabase
              .from("reputation_review_replies")
              .select("id")
              .eq("review_id", savedReview.id)
              .eq("source", "sync")
              .maybeSingle();

            if (!existingReply) {
              await supabase.from("reputation_review_replies").insert({
                org_id: orgId,
                review_id: savedReview.id,
                late_reply_id: null,
                reply_text: review.replyText,
                reply_created_at: review.replyCreatedAt,
                source: "sync",
                status: "published",
              });
            }
          }
        }
      } catch (err) {
        syncErrors.push(`Error processing ${review.externalId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const { data: currentStatus } = await supabase
      .from("reputation_integration_status")
      .select("sync_success_count, sync_failure_count")
      .eq("org_id", orgId)
      .eq("provider", "late")
      .maybeSingle();

    const prevSuccess = currentStatus?.sync_success_count ?? 0;
    const prevFailure = currentStatus?.sync_failure_count ?? 0;
    const overallSuccess = syncErrors.length === 0;

    await supabase.from("reputation_integration_status").upsert(
      {
        org_id: orgId,
        provider: "late",
        connected: true,
        last_sync_at: new Date().toISOString(),
        last_error: syncErrors.length > 0 ? syncErrors.join("; ") : null,
        sync_success_count: overallSuccess ? prevSuccess + 1 : prevSuccess,
        sync_failure_count: overallSuccess ? prevFailure : prevFailure + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider" }
    );

    if (userId) {
      await supabase.from("reputation_actions_audit").insert({
        org_id: orgId,
        user_id: userId,
        action: "sync_reviews",
        entity_type: "review",
        entity_id: "00000000-0000-0000-0000-000000000000",
        metadata: {
          reviews_fetched: allReviews.length,
          reviews_upserted: upserted,
          errors_count: syncErrors.length,
          platform_filter: platformFilter || "all",
          accounts_synced: connections.length,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        reviews_fetched: allReviews.length,
        reviews_upserted: upserted,
        errors: syncErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[reputation-review-sync] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
