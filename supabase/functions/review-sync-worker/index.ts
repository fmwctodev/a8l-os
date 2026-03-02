import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReviewProvider {
  id: string;
  organization_id: string;
  provider: "google";
  external_location_id: string | null;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_token_expires_at: string | null;
  api_credentials: Record<string, unknown>;
  sync_enabled: boolean;
  last_sync_at: string | null;
}

interface ExternalReview {
  provider_review_id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  reviewer_email: string | null;
  received_at: string;
}

async function refreshGoogleToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.error("Google OAuth credentials not configured");
    return null;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error("Failed to refresh Google token:", await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error refreshing Google token:", error);
    return null;
  }
}

async function fetchGoogleReviews(
  provider: ReviewProvider,
  supabase: ReturnType<typeof createClient>
): Promise<ExternalReview[]> {
  let accessToken = provider.oauth_access_token;
  const locationId = provider.external_location_id;

  if (!locationId) {
    throw new Error("Google Business Profile location ID not configured");
  }

  if (provider.oauth_token_expires_at) {
    const expiresAt = new Date(provider.oauth_token_expires_at);
    if (expiresAt <= new Date()) {
      if (!provider.oauth_refresh_token) {
        throw new Error("Google OAuth token expired and no refresh token available");
      }
      const newTokens = await refreshGoogleToken(provider.oauth_refresh_token);
      if (!newTokens) {
        throw new Error("Failed to refresh Google OAuth token");
      }
      accessToken = newTokens.access_token;
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

      await supabase
        .from("review_providers")
        .update({
          oauth_access_token: accessToken,
          oauth_token_expires_at: newExpiresAt.toISOString(),
        })
        .eq("id", provider.id);
    }
  }

  if (!accessToken) {
    throw new Error("Google OAuth access token not available");
  }

  const accountId = (provider.api_credentials as Record<string, string>)?.account_id;
  if (!accountId) {
    throw new Error("Google Business Profile account ID not configured");
  }

  const reviewsUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`;

  const response = await fetch(reviewsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const reviews: ExternalReview[] = [];

  if (data.reviews) {
    for (const review of data.reviews) {
      const ratingMap: Record<string, number> = {
        FIVE: 5,
        FOUR: 4,
        THREE: 3,
        TWO: 2,
        ONE: 1,
      };

      reviews.push({
        provider_review_id: review.reviewId || review.name,
        rating: ratingMap[review.starRating] || 5,
        comment: review.comment || null,
        reviewer_name: review.reviewer?.displayName || "Anonymous",
        reviewer_email: null,
        received_at: review.createTime || new Date().toISOString(),
      });
    }
  }

  return reviews;
}

async function syncProviderReviews(
  provider: ReviewProvider,
  supabase: ReturnType<typeof createClient>
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let reviews: ExternalReview[] = [];

  try {
    switch (provider.provider) {
      case "google":
        reviews = await fetchGoogleReviews(provider, supabase);
        break;
      default:
        throw new Error(`Unknown provider: ${provider.provider}`);
    }
  } catch (error) {
    errors.push(`Failed to fetch reviews: ${error instanceof Error ? error.message : String(error)}`);
    return { synced: 0, errors };
  }

  let synced = 0;

  for (const review of reviews) {
    try {
      const { data: existing } = await supabase
        .from("reviews")
        .select("id")
        .eq("organization_id", provider.organization_id)
        .eq("provider", provider.provider)
        .eq("provider_review_id", review.provider_review_id)
        .maybeSingle();

      if (existing) {
        continue;
      }

      const { data: newReview, error: insertError } = await supabase
        .from("reviews")
        .insert({
          organization_id: provider.organization_id,
          provider: provider.provider,
          provider_review_id: review.provider_review_id,
          rating: review.rating,
          comment: review.comment,
          reviewer_name: review.reviewer_name,
          reviewer_email: review.reviewer_email,
          received_at: review.received_at,
          published: true,
        })
        .select()
        .single();

      if (insertError) {
        errors.push(`Failed to insert review ${review.provider_review_id}: ${insertError.message}`);
        continue;
      }

      synced++;

      await supabase.from("event_outbox").insert({
        org_id: provider.organization_id,
        event_type: "review.received",
        entity_type: "review",
        entity_id: newReview.id,
        payload: {
          review_id: newReview.id,
          rating: review.rating,
          provider: provider.provider,
          is_negative: review.rating <= 3,
        },
      });

    } catch (error) {
      errors.push(`Error processing review ${review.provider_review_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await supabase
    .from("review_providers")
    .update({
      last_sync_at: new Date().toISOString(),
      sync_error: errors.length > 0 ? errors.join("; ") : null,
      total_reviews_synced: (provider.total_reviews_synced || 0) + synced,
    })
    .eq("id", provider.id);

  return { synced, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing authorization" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: authError } = await anonClient.auth.getUser(token);
      if (authError) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const providerId = url.searchParams.get("provider_id");
    const orgId = url.searchParams.get("org_id");

    let providers: ReviewProvider[];

    if (providerId) {
      const { data, error } = await supabase
        .from("review_providers")
        .select("*")
        .eq("id", providerId)
        .eq("status", "connected")
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Provider not found or not connected" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      providers = [data as ReviewProvider];
    } else if (orgId) {
      const { data, error } = await supabase
        .from("review_providers")
        .select("*")
        .eq("organization_id", orgId)
        .eq("status", "connected")
        .eq("sync_enabled", true);

      if (error) throw error;
      providers = (data || []) as ReviewProvider[];
    } else {
      const { data, error } = await supabase
        .from("review_providers")
        .select("*")
        .eq("status", "connected")
        .eq("sync_enabled", true);

      if (error) throw error;
      providers = (data || []) as ReviewProvider[];
    }

    const results: Array<{
      provider_id: string;
      provider: string;
      synced: number;
      errors: string[];
    }> = [];

    for (const provider of providers) {
      if (provider.provider === "internal") continue;

      const { data: syncJob } = await supabase
        .from("review_sync_queue")
        .insert({
          organization_id: provider.organization_id,
          provider_id: provider.id,
          status: "processing",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      try {
        const result = await syncProviderReviews(provider, supabase);
        results.push({
          provider_id: provider.id,
          provider: provider.provider,
          ...result,
        });

        if (syncJob) {
          await supabase
            .from("review_sync_queue")
            .update({
              status: result.errors.length > 0 ? "failed" : "completed",
              completed_at: new Date().toISOString(),
              reviews_synced: result.synced,
              error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
            })
            .eq("id", syncJob.id);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          provider_id: provider.id,
          provider: provider.provider,
          synced: 0,
          errors: [errorMessage],
        });

        if (syncJob) {
          await supabase
            .from("review_sync_queue")
            .update({
              status: "failed",
              completed_at: new Date().toISOString(),
              error_message: errorMessage,
            })
            .eq("id", syncJob.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        providers_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Review sync worker error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
