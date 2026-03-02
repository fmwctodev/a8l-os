import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReviewReplyJob {
  id: string;
  organization_id: string;
  review_id: string;
  provider: "google" | "facebook";
  reply_text: string;
  status: string;
  retry_count: number;
  max_retries: number;
}

interface Review {
  id: string;
  organization_id: string;
  provider: string;
  provider_review_id: string;
}

interface ReviewProvider {
  id: string;
  organization_id: string;
  provider: string;
  external_location_id: string | null;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_token_expires_at: string | null;
  api_credentials: Record<string, unknown>;
}

async function refreshGoogleToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) return null;

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

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function postGoogleReply(
  provider: ReviewProvider,
  review: Review,
  replyText: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ success: boolean; external_response_id?: string; error?: string }> {
  let accessToken = provider.oauth_access_token;

  if (provider.oauth_token_expires_at) {
    const expiresAt = new Date(provider.oauth_token_expires_at);
    if (expiresAt <= new Date() && provider.oauth_refresh_token) {
      const newTokens = await refreshGoogleToken(provider.oauth_refresh_token);
      if (newTokens) {
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
  }

  if (!accessToken) {
    return { success: false, error: "Google OAuth access token not available" };
  }

  const accountId = (provider.api_credentials as Record<string, string>)?.account_id;
  const locationId = provider.external_location_id;

  if (!accountId || !locationId) {
    return { success: false, error: "Google Business Profile account or location ID not configured" };
  }

  const reviewName = review.provider_review_id;
  const replyUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${reviewName}/reply`;

  try {
    const response = await fetch(replyUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: replyText }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Google API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    return { success: true, external_response_id: data.name || reviewName };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function postFacebookReply(
  provider: ReviewProvider,
  review: Review,
  replyText: string
): Promise<{ success: boolean; external_response_id?: string; error?: string }> {
  const accessToken = provider.oauth_access_token;

  if (!accessToken) {
    return { success: false, error: "Facebook OAuth access token not available" };
  }

  const reviewId = review.provider_review_id;
  const replyUrl = `https://graph.facebook.com/v18.0/${reviewId}/comments`;

  try {
    const response = await fetch(replyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: replyText,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Facebook API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    return { success: true, external_response_id: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function processReplyJob(
  job: ReviewReplyJob,
  supabase: ReturnType<typeof createClient>
): Promise<{ success: boolean; error?: string }> {
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("*")
    .eq("id", job.review_id)
    .single();

  if (reviewError || !review) {
    return { success: false, error: "Review not found" };
  }

  const { data: provider, error: providerError } = await supabase
    .from("review_providers")
    .select("*")
    .eq("organization_id", job.organization_id)
    .eq("provider", job.provider)
    .eq("status", "connected")
    .maybeSingle();

  if (providerError || !provider) {
    return { success: false, error: "Provider not connected" };
  }

  let result: { success: boolean; external_response_id?: string; error?: string };

  switch (job.provider) {
    case "google":
      result = await postGoogleReply(provider as ReviewProvider, review as Review, job.reply_text, supabase);
      break;
    case "facebook":
      result = await postFacebookReply(provider as ReviewProvider, review as Review, job.reply_text);
      break;
    default:
      return { success: false, error: `Unknown provider: ${job.provider}` };
  }

  if (result.success) {
    await supabase
      .from("reviews")
      .update({
        response: job.reply_text,
        responded_at: new Date().toISOString(),
        external_response_id: result.external_response_id,
        reply_posted_at: new Date().toISOString(),
        reply_post_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.review_id);

    await supabase
      .from("review_reply_queue")
      .update({
        status: "posted",
        processed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  } else {
    const newRetryCount = job.retry_count + 1;
    const shouldRetry = newRetryCount < job.max_retries;

    await supabase
      .from("review_reply_queue")
      .update({
        status: shouldRetry ? "pending" : "failed",
        retry_count: newRetryCount,
        last_error: result.error,
        processed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (!shouldRetry) {
      await supabase
        .from("reviews")
        .update({
          reply_post_error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.review_id);
    }
  }

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method === "POST") {
      const body = await req.json();
      const { review_id, reply_text, organization_id, provider, user_id } = body;

      if (!review_id || !reply_text || !organization_id || !provider) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: job, error: jobError } = await supabase
        .from("review_reply_queue")
        .insert({
          organization_id,
          review_id,
          provider,
          reply_text,
          status: "pending",
          created_by: user_id || null,
        })
        .select()
        .single();

      if (jobError) {
        return new Response(
          JSON.stringify({ error: jobError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await processReplyJob(job as ReviewReplyJob, supabase);

      return new Response(
        JSON.stringify({
          success: result.success,
          job_id: job.id,
          error: result.error,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: pendingJobs, error: jobsError } = await supabase
      .from("review_reply_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (jobsError) throw jobsError;

    const results: Array<{ job_id: string; success: boolean; error?: string }> = [];

    for (const job of pendingJobs || []) {
      await supabase
        .from("review_reply_queue")
        .update({ status: "processing" })
        .eq("id", job.id);

      const result = await processReplyJob(job as ReviewReplyJob, supabase);
      results.push({ job_id: job.id, ...result });
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Review reply post error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
